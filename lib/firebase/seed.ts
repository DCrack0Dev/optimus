import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type {
  BudgetChannel,
  ProtectedPricing,
  SystemSettings,
  TebogoAvailabilityRule,
  UserRole
} from "@shared/types";

export async function seedFirebase(opts: {
  adminEmail?: string;
  mode: "DEV_ONLY";
}): Promise<{ applied: boolean }> {
  if (opts.mode !== "DEV_ONLY") {
    throw new Error("seedFirebase only runs in dev mode");
  }
  if (!isAdminConfigured()) {
    return { applied: false };
  }
  const db = getAdminDb();
  const applied: string[] = [];

  const settingsRef = db.collection("settings").doc("system");
  const settingsSnap = await settingsRef.get();
  if (!settingsSnap.exists) {
    const seed: SystemSettings = {
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
      businessHoursUtc: [
        { day: 1, openUtcMin: 6 * 60, closeUtcMin: 17 * 60 },
        { day: 2, openUtcMin: 6 * 60, closeUtcMin: 17 * 60 },
        { day: 3, openUtcMin: 6 * 60, closeUtcMin: 17 * 60 },
        { day: 4, openUtcMin: 6 * 60, closeUtcMin: 17 * 60 },
        { day: 5, openUtcMin: 6 * 60, closeUtcMin: 17 * 60 }
      ],
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
    await settingsRef.set(seed);
    applied.push("settings/system");
  }

  const defaultBudgets: Array<{ channel: BudgetChannel; limitDollars: number }> = [
    { channel: "AI", limitDollars: Number(process.env.BUDGET_AI_LIMIT_USD ?? 10) },
    { channel: "EMAIL", limitDollars: Number(process.env.BUDGET_EMAIL_LIMIT_USD ?? 0) },
    { channel: "VOICE", limitDollars: Number(process.env.BUDGET_VOICE_LIMIT_USD ?? 5) },
    { channel: "WHATSAPP", limitDollars: Number(process.env.BUDGET_WHATSAPP_LIMIT_USD ?? 5) },
    { channel: "TOTAL_OUTREACH", limitDollars: Number(process.env.BUDGET_TOTAL_LIMIT_USD ?? 25) }
  ];
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
  for (const b of defaultBudgets) {
    const docId = `default_${b.channel}`;
    const ref = db.collection("budgets").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        id: docId,
        channel: b.channel,
        limitDollars: b.limitDollars,
        usedDollars: 0,
        usedTokens: null,
        usedMinutes: null,
        usedMessages: null,
        stopAtBudget: true,
        periodStart: start.getTime(),
        periodEnd: end.getTime(),
        updatedAt: Date.now()
      });
      applied.push(`budgets/${docId}`);
    }
  }

  const defaultRules: TebogoAvailabilityRule[] = [
    {
      id: "default_weekday",
      enabled: true,
      dayOfWeek: 1,
      startUtcMin: 6 * 60,
      endUtcMin: 17 * 60,
      timezoneIana: "Africa/Johannesburg",
      note: "Default weekday (UTC offsets not applied; business rules use IANA)",
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];
  for (const r of defaultRules) {
    const ref = db.collection("tebogo_availability").doc(r.id);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set(r);
      applied.push(`tebogo_availability/${r.id}`);
    }
  }

  const pricing: Array<ProtectedPricing & { id: string }> = [
    {
      id: "price_website",
      service: "WEBSITE",
      slug: "website",
      label: "Business Website",
      currency: "ZAR",
      publicRangeLowCents: 3500 * 100,
      publicRangeHighCents: 15000 * 100,
      internalLowCents: null,
      internalHighCents: null,
      defaultTimelineDaysLow: 7,
      defaultTimelineDaysHigh: 21,
      description: "Standard marketing websites, portfolios, landing pages.",
      updatedAt: Date.now()
    },
    {
      id: "price_webapp",
      service: "WEB_APP",
      slug: "webapp",
      label: "Custom Web App",
      currency: "ZAR",
      publicRangeLowCents: 10000 * 100,
      publicRangeHighCents: 60000 * 100,
      internalLowCents: null,
      internalHighCents: null,
      defaultTimelineDaysLow: 30,
      defaultTimelineDaysHigh: 90,
      description: "Dashboards, internal tools, portals, SaaS MVPs.",
      updatedAt: Date.now()
    },
    {
      id: "price_mobile",
      service: "MOBILE_APP",
      slug: "mobile-app",
      label: "Mobile App",
      currency: "ZAR",
      publicRangeLowCents: 10000 * 100,
      publicRangeHighCents: 80000 * 100,
      internalLowCents: null,
      internalHighCents: null,
      defaultTimelineDaysLow: 45,
      defaultTimelineDaysHigh: 120,
      description: "iOS + Android apps, MVPs, customer booking apps.",
      updatedAt: Date.now()
    },
    {
      id: "price_seo",
      service: "SEO",
      slug: "seo",
      label: "SEO / Marketing",
      currency: "ZAR",
      publicRangeLowCents: 2000 * 100,
      publicRangeHighCents: 8000 * 100,
      internalLowCents: null,
      internalHighCents: null,
      defaultTimelineDaysLow: 30,
      defaultTimelineDaysHigh: 90,
      description: "Local SEO, citations, on-page optimisation, content.",
      updatedAt: Date.now()
    },
    {
      id: "price_booking_system",
      service: "BOOKING_SYSTEM",
      slug: "booking-system",
      label: "Booking / Scheduling System",
      currency: "ZAR",
      publicRangeLowCents: 8000 * 100,
      publicRangeHighCents: 30000 * 100,
      internalLowCents: null,
      internalHighCents: null,
      defaultTimelineDaysLow: 21,
      defaultTimelineDaysHigh: 60,
      description: "Salons, spas, hotels, gyms, self-catering bookings.",
      updatedAt: Date.now()
    },
    {
      id: "price_crm_dashboard",
      service: "CRM_DASHBOARD",
      slug: "crm-dashboard",
      label: "CRM / Dashboard",
      currency: "ZAR",
      publicRangeLowCents: 12000 * 100,
      publicRangeHighCents: 70000 * 100,
      internalLowCents: null,
      internalHighCents: null,
      defaultTimelineDaysLow: 30,
      defaultTimelineDaysHigh: 120,
      description: "Operations command centers, CRMs, admin panels.",
      updatedAt: Date.now()
    },
    {
      id: "price_ecommerce",
      service: "ECOMMERCE",
      slug: "ecommerce",
      label: "E-commerce Store",
      currency: "ZAR",
      publicRangeLowCents: 10000 * 100,
      publicRangeHighCents: 45000 * 100,
      internalLowCents: null,
      internalHighCents: null,
      defaultTimelineDaysLow: 21,
      defaultTimelineDaysHigh: 75,
      description: "Product & service stores, PayFast integrations.",
      updatedAt: Date.now()
    },
    {
      id: "price_custom",
      service: "CUSTOM",
      slug: "custom",
      label: "Custom Project",
      currency: "ZAR",
      publicRangeLowCents: 10000 * 100,
      publicRangeHighCents: 100000 * 100,
      internalLowCents: null,
      internalHighCents: null,
      defaultTimelineDaysLow: 30,
      defaultTimelineDaysHigh: 180,
      description: "Anything not covered above — bespoke.",
      updatedAt: Date.now()
    }
  ];
  for (const p of pricing) {
    const ref = db.collection("protected_pricing").doc(p.id);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set(p);
      applied.push(`protected_pricing/${p.id}`);
    }
  }

  if (opts.adminEmail && process.env.NODE_ENV !== "production") {
    const auth = (await import("@/lib/firebase/admin")).getAdminAuth();
    try {
      const user = await auth.getUserByEmail(opts.adminEmail);
      await auth.setCustomUserClaims(user.uid, { role: "admin" as UserRole, admin: true });
      const profileRef = db.collection("profiles").doc(user.uid);
      const profileSnap = await profileRef.get();
      if (!profileSnap.exists) {
        await profileRef.set({
          uid: user.uid,
          email: user.email ?? null,
          role: "admin",
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      } else {
        await profileRef.set({ role: "admin", updatedAt: Date.now() }, { merge: true });
      }
      applied.push(`profiles/${user.uid} [admin-claim]`);
    } catch {
      // ignore if admin email doesn't exist yet
    }
  }

  return { applied: applied.length > 0 };
}
