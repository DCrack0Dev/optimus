"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";
import UnifiedTimeline from "@optimus/components/leads/UnifiedTimeline";
import type {
  BudgetRange,
  Lead,
  LeadId,
  LeadPatch,
  LeadStatus,
  ServiceInterest,
  TimelineEvent,
} from "@shared/types";
import { LeadStatusSchema } from "@shared/validation/schemas";

type LeadFull = Lead & { id: LeadId };

const LEAD_STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "REPLIED",
  "QUALIFIED",
  "HOT",
  "QUOTE_SENT",
  "NEGOTIATING",
  "WON",
  "LOST",
  "FOLLOW_UP",
];

const SERVICE_OPTIONS: ServiceInterest[] = [
  "WEBSITE",
  "WEB_APP",
  "MOBILE_APP",
  "ECOMMERCE",
  "BOOKING_SYSTEM",
  "CRM_DASHBOARD",
  "SEO",
  "CUSTOM",
];

type TimelineTabKey =
  | "overview"
  | "emails"
  | "whatsapp"
  | "calls"
  | "quotes"
  | "bookings"
  | "followups"
  | "ai"
  | "audit";

const TAB_FILTERS: Record<TimelineTabKey, { label: string; types?: TimelineEvent["type"][] }> = {
  overview: { label: "Overview" },
  emails: {
    label: "Emails",
    types: [
      "email_sent",
      "email_delivered",
      "email_opened",
      "email_clicked",
      "email_replied",
      "email_failed",
    ],
  },
  whatsapp: {
    label: "WhatsApp",
    types: ["whatsapp_sent", "whatsapp_received"],
  },
  calls: {
    label: "Calls",
    types: ["call_started", "call_completed", "call_missed"],
  },
  quotes: {
    label: "Quotes",
    types: ["quote_created", "quote_sent", "quote_accepted", "quote_won", "quote_lost"],
  },
  bookings: {
    label: "Bookings",
    types: ["booking_created", "booking_confirmed", "booking_completed", "booking_cancelled"],
  },
  followups: {
    label: "Follow-ups",
    types: ["followup_scheduled", "followup_sent", "followup_cancelled"],
  },
  ai: {
    label: "AI Activity",
    types: ["ai_summary", "ai_action", "ai_handoff"],
  },
  audit: { label: "Audit", types: ["manual"] },
};

export default function LeadDetailClient({ params }: { params: { leadId: string } }) {
  const router = useRouter();
  const { user, initialising: loading } = useFirebaseUser();
  const id = params.leadId as LeadId;
  const [lead, setLead] = useState<LeadFull | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<TimelineTabKey>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [patch, setPatch] = useState<LeadPatch>({});
  const [saveBusy, setSaveBusy] = useState(false);

  const filtered = useMemo(() => {
    const types = TAB_FILTERS[tab].types;
    if (!types) return timeline;
    return timeline.filter((e) => types.includes(e.type as any));
  }, [timeline, tab]);

  async function load() {
    setBusy(true);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const headers = {
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      };
      const [lr, tr] = await Promise.all([
        fetch(`/api/leads/${id}`, { headers }),
        fetch(`/api/leads/${id}/timeline?limit=500`, { headers }),
      ]);
      const lBody = (await lr.json()) as { ok: boolean; lead?: LeadFull; error?: string };
      if (!lr.ok || !lBody.ok || !lBody.lead) {
        throw new Error(lBody.error ?? "lead not found");
      }
      const tBody = (await tr.json()) as {
        ok: boolean;
        items?: TimelineEvent[];
        error?: string;
      };
      if (!tr.ok || !tBody.ok) throw new Error(tBody.error ?? "timeline failed");
      setLead(lBody.lead);
      setTimeline(tBody.items ?? []);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "load failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!user && !loading) return;
    if (loading) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, id]);

  function beginEdit() {
    if (!lead) return;
    setPatch({
      firstName: lead.firstName ?? undefined,
      lastName: lead.lastName ?? undefined,
      company: lead.company ?? undefined,
      email: lead.email ?? undefined,
      phoneE164: lead.phoneE164 ?? undefined,
      whatsappE164: lead.whatsappE164 ?? undefined,
      website: lead.website ?? undefined,
      status: lead.status,
      servicesInterested: lead.servicesInterested,
      budgetRange: lead.budgetRange ?? undefined,
      timeline: lead.timeline ?? undefined,
      assignedToUid: lead.assignedToUid ?? undefined,
      tags: lead.tags,
      notes: lead.notes ?? undefined,
      nextAction: lead.nextAction ?? undefined,
      nextActionAt: lead.nextActionAt ?? undefined,
      temperature: lead.temperature,
      marketingUnsubscribed: lead.marketingUnsubscribed,
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!lead || !user) return;
    setSaveBusy(true);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      const body = (await res.json()) as { ok: boolean; lead?: LeadFull; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "save failed");
      if (body.lead) setLead(body.lead);
      setEditOpen(false);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "save failed");
    } finally {
      setSaveBusy(false);
    }
  }

  if (loading || busy) {
    return <div className="order-card opacity-60">Loading lead…</div>;
  }
  if (error && !lead) {
    return (
      <div className="order-card">
        <div className="mb-4">
          <Link className="hover:text-[var(--gold)]" href="/dashboard/leads">
            ↩ Back to leads
          </Link>
        </div>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 p-3 text-sm">
          {error}
        </div>
      </div>
    );
  }

  const L = lead!;

  return (
    <div className="space-y-6">
      <div className="order-card">
        <div className="flex flex-wrap items-start gap-3 mb-4">
          <Link
            className="hover:text-[var(--gold)] text-sm opacity-80"
            href="/dashboard/leads"
          >
            ↩ Back to leads
          </Link>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline !py-2" onClick={beginEdit}>
              ✎ Edit lead
            </button>
            <a href="#timeline" className="btn btn-gold !py-2">
              ⏱ Jump to timeline
            </a>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-5">
          <div className="min-w-[260px]">
            <div className="text-xs uppercase tracking-wider opacity-60">Lead</div>
            <div className="text-2xl font-title text-white mt-1">
              {L.fullName ?? L.company ?? L.email ?? L.phoneE164 ?? "Untitled"}
            </div>
            {L.company ? <div className="opacity-70 mt-1">{L.company}</div> : null}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm flex-1 min-w-[400px]">
            <div>
              <div className="opacity-60 text-xs">Email</div>
              <div>{L.email ? <a className="hover:underline" href={`mailto:${L.email}`}>{L.email}</a> : "—"}</div>
            </div>
            <div>
              <div className="opacity-60 text-xs">Phone</div>
              <div>{L.phoneE164 ? <a className="hover:underline" href={`tel:${L.phoneE164}`}>{L.phoneE164}</a> : "—"}</div>
            </div>
            <div>
              <div className="opacity-60 text-xs">WhatsApp</div>
              <div>{L.whatsappE164 ?? "—"}</div>
            </div>
            <div>
              <div className="opacity-60 text-xs">Website</div>
              <div>{L.website ? <a target="_blank" rel="noreferrer" className="hover:underline truncate block" href={L.website}>{L.website}</a> : "—"}</div>
            </div>
            <div>
              <div className="opacity-60 text-xs">Source</div>
              <div>{(L.source ?? "—").replace(/_/g, " ")}</div>
            </div>
            <div>
              <div className="opacity-60 text-xs">Temperature</div>
              <div>{Number(L.temperature | 0)}%</div>
            </div>
            <div>
              <div className="opacity-60 text-xs">Budget</div>
              <div>{(L.budgetRange ?? "—").replace(/_/g, " ")}</div>
            </div>
            <div>
              <div className="opacity-60 text-xs">Timeline</div>
              <div>{(L.timeline ?? "—").replace(/_/g, " ")}</div>
            </div>
          </div>
          <div className="min-w-[180px]">
            <div className="opacity-60 text-xs">Status</div>
            <div className="mt-1">
              <span className="inline-block rounded-full border px-3 py-1 text-sm bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/30">
                {L.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>

        {(L.nextAction || L.nextActionAt || L.lastContactAt) ? (
          <div className="mt-5 grid md:grid-cols-3 gap-3">
            <div className="rounded-lg bg-black/30 border border-white/10 p-3">
              <div className="text-xs opacity-60">Next action</div>
              <div className="mt-1">{L.nextAction ?? "—"}</div>
              {L.nextActionAt ? (
                <div className="mt-1 text-xs text-[var(--gold)]">
                  @ {new Date(L.nextActionAt).toLocaleString()}
                </div>
              ) : null}
            </div>
            <div className="rounded-lg bg-black/30 border border-white/10 p-3">
              <div className="text-xs opacity-60">Last contact</div>
              <div className="mt-1">
                {L.lastContactAt ? new Date(L.lastContactAt).toLocaleString() : "—"}
              </div>
            </div>
            <div className="rounded-lg bg-black/30 border border-white/10 p-3">
              <div className="text-xs opacity-60">Services interested</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {L.servicesInterested && L.servicesInterested.length ? (
                  L.servicesInterested.map((s) => (
                    <span
                      key={s}
                      className="text-[11px] rounded-full px-2 py-0.5 bg-white/10 border border-white/10"
                    >
                      {s.replace(/_/g, " ")}
                    </span>
                  ))
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>
        ) : null}

        {L.notes ? (
          <div className="mt-5 rounded-lg bg-black/30 border border-white/10 p-4">
            <div className="text-xs opacity-60 mb-1">Notes</div>
            <div className="whitespace-pre-wrap leading-relaxed">{L.notes}</div>
          </div>
        ) : null}

        {L.aiSummary ? (
          <div className="mt-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-4">
            <div className="text-xs opacity-60 mb-1">🤖 AI summary</div>
            <div className="whitespace-pre-wrap leading-relaxed">{L.aiSummary}</div>
          </div>
        ) : null}
      </div>

      <div className="order-card">
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
          {(Object.keys(TAB_FILTERS) as TimelineTabKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                tab === k
                  ? "bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30"
                  : "hover:bg-white/5 text-white/75"
              }`}
            >
              {TAB_FILTERS[k].label}
              {TAB_FILTERS[k].types ? (
                <span className="ml-2 opacity-60">
                  {timeline.filter((e) => TAB_FILTERS[k].types!.includes(e.type as any)).length}
                </span>
              ) : (
                <span className="ml-2 opacity-60">{timeline.length}</span>
              )}
            </button>
          ))}
        </div>
        <div id="timeline" className="mt-4">
          <UnifiedTimeline
            events={filtered}
            emptyMessage={
              tab === "overview"
                ? "No activity yet. Timelines appear as emails, calls, WhatsApp, quotes, bookings, follow-ups and AI events are attached to this lead."
                : `No ${TAB_FILTERS[tab].label.toLowerCase()} events for this lead yet.`
            }
          />
        </div>
      </div>

      {editOpen ? (
        <LeadEditDialog
          lead={L}
          patch={patch}
          setPatch={setPatch}
          busy={saveBusy}
          error={error}
          onClose={() => setEditOpen(false)}
          onSave={saveEdit}
        />
      ) : null}
    </div>
  );
}

function LeadEditDialog(props: {
  lead: LeadFull;
  patch: LeadPatch;
  setPatch: (p: LeadPatch) => void;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const { lead, patch, setPatch, busy, error, onClose, onSave } = props;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl border border-white/10 bg-[#0b0b12] p-6 shadow-2xl">
        <div className="flex items-start gap-4 mb-4">
          <div>
            <div className="section-tag">Edit Lead</div>
            <div className="font-title text-xl text-white mt-1">
              {lead.fullName ?? lead.company ?? lead.email ?? lead.id}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto opacity-70 hover:opacity-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 p-3 text-sm">
            {error}
          </div>
        ) : null}
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="First name">
            <input
              className="dash-input"
              value={patch.firstName ?? ""}
              onChange={(e) => setPatch({ ...patch, firstName: e.target.value || undefined })}
            />
          </Field>
          <Field label="Last name">
            <input
              className="dash-input"
              value={patch.lastName ?? ""}
              onChange={(e) => setPatch({ ...patch, lastName: e.target.value || undefined })}
            />
          </Field>
          <Field label="Company">
            <input
              className="dash-input"
              value={patch.company ?? ""}
              onChange={(e) => setPatch({ ...patch, company: e.target.value || undefined })}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className="dash-input"
              value={patch.email ?? ""}
              onChange={(e) => setPatch({ ...patch, email: e.target.value || undefined })}
            />
          </Field>
          <Field label="Phone E.164">
            <input
              className="dash-input"
              placeholder="+27821234567"
              value={patch.phoneE164 ?? ""}
              onChange={(e) => setPatch({ ...patch, phoneE164: e.target.value || undefined })}
            />
          </Field>
          <Field label="WhatsApp E.164">
            <input
              className="dash-input"
              placeholder="+27821234567"
              value={patch.whatsappE164 ?? ""}
              onChange={(e) => setPatch({ ...patch, whatsappE164: e.target.value || undefined })}
            />
          </Field>
          <Field label="Website">
            <input
              className="dash-input"
              value={patch.website ?? ""}
              onChange={(e) => setPatch({ ...patch, website: e.target.value || undefined })}
            />
          </Field>
          <Field label="Status">
            <select
              className="dash-input"
              value={patch.status ?? lead.status}
              onChange={(e) =>
                setPatch({
                  ...patch,
                  status: LeadStatusSchema.parse(e.target.value),
                })
              }
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Temperature (0–100)">
            <input
              type="number"
              min={0}
              max={100}
              className="dash-input"
              value={patch.temperature ?? ""}
              onChange={(e) =>
                setPatch({
                  ...patch,
                  temperature: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label="Budget range">
            <select
              className="dash-input"
              value={patch.budgetRange ?? ""}
              onChange={(e) =>
                setPatch({
                  ...patch,
                  budgetRange: (e.target.value || undefined) as BudgetRange | undefined,
                })
              }
            >
              <option value="">—</option>
              <option value="UNDER_5K">Under R5k</option>
              <option value="BUDGET_5K_15K">R5k – R15k</option>
              <option value="MID_15K_35K">R15k – R35k</option>
              <option value="PRO_35K_75K">R35k – R75k</option>
              <option value="ENTERPRISE_75K_200K">R75k – R200k</option>
              <option value="CUSTOM_200K_PLUS">R200k+</option>
            </select>
          </Field>
          <Field label="Next action">
            <input
              className="dash-input"
              value={patch.nextAction ?? ""}
              onChange={(e) => setPatch({ ...patch, nextAction: e.target.value || undefined })}
            />
          </Field>
          <Field label="Next action at (ISO ms)">
            <input
              type="number"
              className="dash-input"
              placeholder={`e.g. ${Date.now() + 3 * 86400000}`}
              value={patch.nextActionAt ?? ""}
              onChange={(e) =>
                setPatch({
                  ...patch,
                  nextActionAt: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label="Tags (comma separated)" className="md:col-span-2">
            <input
              className="dash-input"
              value={(patch.tags ?? []).join(", ")}
              onChange={(e) =>
                setPatch({
                  ...patch,
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <Field label="Services interested" className="md:col-span-2">
            <div className="flex flex-wrap gap-2">
              {SERVICE_OPTIONS.map((s) => {
                const cur = patch.servicesInterested ?? lead.servicesInterested ?? [];
                const checked = cur.includes(s);
                return (
                  <label
                    key={s}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                      checked
                        ? "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30"
                        : "bg-white/5 text-white/75 border-white/10"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => {
                        const next = new Set(cur);
                        if (checked) next.delete(s);
                        else next.add(s);
                        setPatch({ ...patch, servicesInterested: Array.from(next) });
                      }}
                    />
                    {s.replace(/_/g, " ")}
                  </label>
                );
              })}
            </div>
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <textarea
              rows={5}
              className="dash-input"
              value={patch.notes ?? ""}
              onChange={(e) => setPatch({ ...patch, notes: e.target.value || undefined })}
            />
          </Field>
          <Field label="Unsubscribed from marketing" className="md:col-span-2">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(patch.marketingUnsubscribed)}
                onChange={(e) =>
                  setPatch({ ...patch, marketingUnsubscribed: e.target.checked })
                }
              />
              <span className="text-sm opacity-80">
                If checked, Brevo + WhatsApp + voice tools will refuse to send marketing
                communications to this lead.
              </span>
            </label>
          </Field>
        </div>
        <div className="mt-6 flex items-center gap-3 justify-end">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-gold"
            onClick={() => void onSave()}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={props.className ?? ""}>
      <div className="text-xs opacity-60 mb-1">{props.label}</div>
      {props.children}
    </div>
  );
}
