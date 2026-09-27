import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { SystemMode, SystemSettings, Uid, UserRole } from "@shared/types";
import { writeAudit } from "@optimus/lib/audit/writer";

export type ModeChangeResult = {
  ok: boolean;
  reason?: string;
  mode?: SystemMode;
};

export type EmergencyStopResult = {
  ok: boolean;
  reason?: string;
  stopped?: boolean;
  cancelledFollowups?: number;
};

export async function getSystemMode(): Promise<{ mode: SystemMode; emergencyStop: boolean }> {
  const fallback = { mode: "AI" as SystemMode, emergencyStop: false };
  if (!isAdminConfigured()) return fallback;
  try {
    const db = getAdminDb();
    const snap = await db.collection("settings").doc("system").get();
    if (!snap.exists) return fallback;
    const s = snap.data() as Partial<SystemSettings> | undefined;
    return {
      mode: s?.systemMode ?? "AI",
      emergencyStop: Boolean(s?.emergencyStop)
    };
  } catch {
    return fallback;
  }
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const fallback: SystemSettings = {
    id: "system",
    systemMode: "AI",
    emergencyStop: false,
    emergencyStopAt: null,
    emergencyStopBy: null,
    emergencyStopReason: null,
    tebogoDefaultPhoneE164: process.env.TEBOGO_PHONE_E164 ?? null,
    defaultTimezoneIana: "Africa/Johannesburg",
    dailyEmailMax: 300,
    dailyWhatsAppMax: 100,
    dailyCallMinutesMax: 120,
    businessHoursUtc: [],
    businessName: "DemiTech Web Services",
    businessEmail: process.env.BUSINESS_EMAIL ?? null,
    businessPhoneE164: process.env.BUSINESS_PHONE_E164 ?? null,
    aiDefaultModel: process.env.LLM_MODEL ?? null,
    aiDisclosurePolicy: "AFTER_INTRO",
    videoMeetingPlatform: "JITSI",
    videoMeetingBaseUrl: null,
    updatedAt: Date.now(),
    updatedBy: "SYSTEM"
  };
  if (!isAdminConfigured()) return fallback;
  const db = getAdminDb();
  const snap = await db.collection("settings").doc("system").get();
  if (!snap.exists) return fallback;
  const data = snap.data() as Partial<SystemSettings> | undefined;
  return { ...fallback, ...data };
}

export async function setMode(
  actor: { uid: Uid; role: UserRole },
  mode: SystemMode,
  opts?: { req?: unknown; reason?: string | null }
): Promise<ModeChangeResult> {
  if (actor.role !== "admin") return { ok: false, reason: "forbidden_admin_only" };
  if (!isAdminConfigured()) {
    return { ok: true, mode };
  }
  const db = getAdminDb();
  await db.collection("settings").doc("system").set(
    {
      systemMode: mode,
      updatedAt: Date.now(),
      updatedBy: actor.uid
    },
    { merge: true }
  );
  await writeAudit({
    actorUid: actor.uid,
    event: "MODE_CHANGE",
    detail: opts?.reason ?? `mode=${mode}`,
    data: { mode, reason: opts?.reason ?? null }
  });
  return { ok: true, mode };
}

export async function triggerEmergencyStop(
  actor: { uid: Uid | "SYSTEM"; role?: UserRole | null },
  opts?: { req?: unknown; reason?: string | null }
): Promise<EmergencyStopResult> {
  const isAdmin = actor.role === "admin" || actor.uid === "SYSTEM";
  if (!isAdmin) return { ok: false, reason: "forbidden_admin_or_system", stopped: false };
  if (!isAdminConfigured()) {
    await writeAudit({
      actorUid: actor.uid,
      event: "EMERGENCY_STOP",
      detail: opts?.reason ?? "emergency stop (dev mode, no admin SDK)"
    });
    return { ok: true, stopped: true, cancelledFollowups: 0 };
  }
  const db = getAdminDb();
  let cancelledFollowups = 0;
  const ts = Date.now();
  await db.runTransaction(async (txn) => {
    const ref = db.collection("settings").doc("system");
    const snap = await txn.get(ref);
    const existing = snap.exists ? (snap.data() as Partial<SystemSettings>) : null;
    if (existing?.emergencyStop) return;
    txn.set(
      ref,
      {
        emergencyStop: true,
        emergencyStopAt: ts,
        emergencyStopBy: actor.uid,
        emergencyStopReason: opts?.reason ?? null,
        updatedAt: ts,
        updatedBy: actor.uid
      },
      { merge: true }
    );
    const followupsRef = db.collection("followups");
    const q = followupsRef
      .where("status", "in", ["PENDING", "SCHEDULED"])
      .limit(500);
    const fsnap = await txn.get(q);
    const updates: Promise<void>[] = [];
    fsnap.forEach((d) => {
      updates.push(
        (async () => {
          txn.update(d.ref, {
            status: "CANCELLED_EMERGENCY_STOP",
            reasonSkipped: "emergency_stop",
            updatedAt: ts
          });
        })()
      );
    });
    cancelledFollowups = fsnap.size;
    await Promise.all(updates);
  });
  await writeAudit({
    actorUid: actor.uid,
    event: "EMERGENCY_STOP",
    detail: opts?.reason ?? "emergency stop activated",
    data: { cancelledFollowups, reason: opts?.reason ?? null }
  });
  return { ok: true, stopped: true, cancelledFollowups };
}

export async function resumeSystem(
  actor: { uid: Uid; role: UserRole },
  opts?: { req?: unknown; reason?: string | null }
): Promise<{ ok: boolean; reason?: string; resumed?: boolean }> {
  if (actor.role !== "admin") return { ok: false, reason: "forbidden_admin_only", resumed: false };
  if (!isAdminConfigured()) {
    await writeAudit({
      actorUid: actor.uid,
      event: "EMERGENCY_RESUME",
      detail: opts?.reason ?? "resume (dev mode, no admin SDK)"
    });
    return { ok: true, resumed: true };
  }
  const db = getAdminDb();
  const ts = Date.now();
  await db.collection("settings").doc("system").set(
    {
      emergencyStop: false,
      emergencyStopAt: null,
      emergencyStopBy: null,
      emergencyStopReason: null,
      updatedAt: ts,
      updatedBy: actor.uid
    },
    { merge: true }
  );
  await writeAudit({
    actorUid: actor.uid,
    event: "EMERGENCY_RESUME",
    detail: opts?.reason ?? "resumed",
    data: { reason: opts?.reason ?? null }
  });
  return { ok: true, resumed: true };
}
