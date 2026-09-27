"use client";

import { useMemo, useState } from "react";
import type { TimelineEvent } from "@shared/types";

type Props = {
  events: TimelineEvent[];
  loading?: boolean;
  emptyMessage?: string;
  onOpenLeadRef?: (kind: "email" | "call" | "whatsapp" | "quote" | "booking" | "followup" | "website_event" | "audit", id: string) => void;
};

const typeLabels: Record<string, string> = {
  website_event: "Website Event",
  email_sent: "Email Sent",
  email_delivered: "Email Delivered",
  email_opened: "Email Opened",
  email_clicked: "Email Clicked",
  email_replied: "Email Reply",
  email_failed: "Email Failed",
  whatsapp_sent: "WhatsApp Sent",
  whatsapp_received: "WhatsApp Received",
  call_started: "Call Started",
  call_completed: "Call Completed",
  call_missed: "Call Missed",
  quote_created: "Quote Created",
  quote_sent: "Quote Sent",
  quote_accepted: "Quote Accepted",
  quote_won: "Quote Won",
  quote_lost: "Quote Lost",
  booking_created: "Booking Created",
  booking_confirmed: "Booking Confirmed",
  booking_completed: "Booking Completed",
  booking_cancelled: "Booking Cancelled",
  followup_scheduled: "Follow-up Scheduled",
  followup_sent: "Follow-up Sent",
  followup_cancelled: "Follow-up Cancelled",
  ai_summary: "AI Summary",
  ai_action: "AI Action",
  ai_handoff: "AI Handoff",
  status_change: "Status Changed",
  note_added: "Note Added",
  manual: "Manual",
};

function refKind(
  ids: TimelineEvent["refIds"]
): { kind: TimelineTypeKind; id: string } | null {
  if (ids.emailId) return { kind: "email", id: String(ids.emailId) };
  if (ids.callId) return { kind: "call", id: String(ids.callId) };
  if (ids.whatsappId) return { kind: "whatsapp", id: String(ids.whatsappId) };
  if (ids.quoteId) return { kind: "quote", id: String(ids.quoteId) };
  if (ids.bookingId) return { kind: "booking", id: String(ids.bookingId) };
  if (ids.followupId) return { kind: "followup", id: String(ids.followupId) };
  if (ids.websiteEventId) return { kind: "website_event", id: String(ids.websiteEventId) };
  return null;
}

type TimelineTypeKind =
  | "email"
  | "call"
  | "whatsapp"
  | "quote"
  | "booking"
  | "followup"
  | "website_event"
  | "audit";

export default function UnifiedTimeline({
  events,
  loading,
  emptyMessage = "No activity yet for this lead.",
  onOpenLeadRef,
}: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    if (filter === "ALL") return events;
    return events.filter((e) => e.type === filter);
  }, [events, filter]);

  const typeSet = useMemo(() => {
    const s = new Set<string>();
    for (const e of events) s.add(e.type);
    return Array.from(s).sort();
  }, [events]);

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="order-card dash-tile-body">
        <div className="opacity-60">Loading timeline…</div>
      </div>
    );
  }

  return (
    <div className="order-card dash-tile-body">
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="section-tag">Timeline</div>
        <select
          className="bg-black/40 border border-white/10 rounded-md px-2 py-1 text-sm text-white"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">All events ({events.length})</option>
          {typeSet.map((t) => (
            <option key={t} value={t}>
              {typeLabels[t] ?? t}
            </option>
          ))}
        </select>
        <div className="text-sm opacity-70 ml-auto">
          Showing {filtered.length} of {events.length}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="p-8 text-center opacity-60 border border-dashed border-white/10 rounded-xl">
          {emptyMessage}
        </div>
      ) : (
        <ol className="relative border-l border-white/10 ml-2 space-y-5">
          {filtered.map((e) => {
            const isOpen = openIds.has(e.id);
            const ref = refKind(e.refIds);
            return (
              <li key={e.id} className="ml-5">
                <span className="absolute -left-[11px] mt-1 h-6 w-6 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/40 flex items-center justify-center text-xs">
                  <span>{e.icon ?? "•"}</span>
                </span>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs uppercase tracking-wider opacity-60">
                        {typeLabels[e.type] ?? e.type}
                      </div>
                      <div className="text-xs opacity-50">
                        {new Date(e.at).toLocaleString()}
                      </div>
                      {e.actorUid && e.actorUid !== "SYSTEM" && e.actorUid !== "AI" ? (
                        <div className="text-xs opacity-50">· by {e.actorUid.slice(0, 8)}</div>
                      ) : e.actorUid === "AI" ? (
                        <div className="text-xs opacity-50">· by AI</div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="mt-1 text-left w-full hover:underline decoration-white/20 underline-offset-2"
                      onClick={() => toggleOpen(e.id)}
                    >
                      <div className="text-[15px] leading-snug">{e.summary}</div>
                    </button>
                    {(e.detail || ref) && isOpen && (
                      <div className="mt-2 p-3 rounded-lg bg-black/30 border border-white/10 text-sm">
                        {ref && onOpenLeadRef ? (
                          <div className="mb-2">
                            <button
                              type="button"
                              onClick={() => onOpenLeadRef(ref.kind, ref.id)}
                              className="btn btn-gold !py-1 !px-3 text-xs"
                            >
                              Open {ref.kind.replace("_", " ")} detail
                            </button>
                          </div>
                        ) : null}
                        {e.detail ? (
                          <pre className="whitespace-pre-wrap break-words opacity-80 text-xs">
                            {JSON.stringify(e.detail, null, 2)}
                          </pre>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <div className="opacity-50 text-xs">{isOpen ? "▲" : "▼"}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
