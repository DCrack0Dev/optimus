"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";
import type { CallDoc, CallId } from "@shared/types";

type ListResponse = {
  ok: boolean;
  items: Array<CallDoc & { id: CallId }>;
  nextCursor?: string | null;
  error?: string;
};

export default function CallsDashboard() {
  const { user, initialising: loading } = useFirebaseUser();
  const [items, setItems] = useState<Array<CallDoc & { id: CallId }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [outcome, setOutcome] = useState<string>("ALL");
  const [direction, setDirection] = useState<string>("ALL");
  const [sort, setSort] = useState<"createdAt" | "answeredAt" | "endedAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedCall, setSelectedCall] = useState<CallDoc & { id: CallId } | null>(null);

  const outcomes = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.outcome) s.add(it.outcome);
    return Array.from(s).sort();
  }, [items]);

  async function load(reset: boolean) {
    setBusy(reset);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const params = new URLSearchParams();
      params.set("sort", sort);
      params.set("sortDir", sortDir);
      if (outcome !== "ALL") params.set("outcome", outcome);
      if (direction !== "ALL") params.set("direction", direction);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", String(50));
      if (!reset && nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/calls?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
      });
      const body = (await res.json()) as ListResponse;
      if (!res.ok || !body.ok) throw new Error(body.error ?? "load failed");
      if (reset) setItems(body.items);
      else setItems((prev) => [...prev, ...body.items]);
      setNextCursor(body.nextCursor ?? null);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "load failed");
    } finally {
      setBusy(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!user && !loading) return;
    if (loading) return;
    void load(true);
  }, [user, loading, outcome, direction, sort, sortDir, q]);

  const OUTCOME_COLORS: Record<string, string> = {
    ANSWERED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    MISSED: "bg-red-500/15 text-red-300 border-red-500/30",
    NO_ANSWER: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    BUSY: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    FAILED: "bg-red-500/15 text-red-300 border-red-500/30",
    CANCELLED: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    HANGUP_BEFORE_CONNECT: "bg-red-500/15 text-red-300 border-red-500/30",
  };

  const DIRECTION_COLORS: Record<string, string> = {
    INBOUND: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    OUTBOUND: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  };

  const chips = useMemo(() => {
    const base = [{ key: "ALL", label: "All", count: items.length, cls: "bg-white/10 text-white border-white/20" }];
    for (const s of outcomes) {
      const c = items.filter((it) => it.outcome === s).length;
      base.push({ key: s, label: s.replace(/_/g, " "), count: c, cls: OUTCOME_COLORS[s] ?? "bg-white/10 text-white border-white/20" });
    }
    return base;
  }, [items, outcomes]);

  if (loading || (busy && items.length === 0)) {
    return <div className="order-card opacity-60">Loading calls…</div>;
  }

  return (
    <div className="order-card">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <div className="section-tag">Calls</div>
          <div className="text-2xl font-title text-white mt-1">Voice Outreach</div>
          <div className="opacity-70 text-sm mt-1">
            Track all inbound and outbound calls, outcomes, durations, and handoffs.
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 items-center">
          <input
            type="search"
            placeholder="Search number, lead, summary…"
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm w-60 max-w-full text-white placeholder:text-white/40"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          >
            <option value="ALL">All outcomes</option>
            {outcomes.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="ALL">All directions</option>
            <option value="INBOUND">Inbound</option>
            <option value="OUTBOUND">Outbound</option>
          </select>
          <select
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
          >
            <option value="createdAt">Created</option>
            <option value="answeredAt">Started</option>
            <option value="endedAt">Ended</option>
          </select>
          <button
            type="button"
            className="btn-outline !py-2 !px-3 text-xs"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          >
            {sortDir === "desc" ? "Newest first" : "Oldest first"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setOutcome(c.key)}
            className={`rounded-full border px-3 py-1 text-xs ${c.cls} ${
              outcome === c.key ? "ring-2 ring-offset-2 ring-offset-black ring-[var(--gold)]/70" : "opacity-85"
            }`}
          >
            {c.label}
            {typeof c.count === "number" ? ` · ${c.count}` : ""}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 p-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="hidden md:grid grid-cols-[minmax(180px,1.2fr)_100px_100px_100px_100px_100px_120px] gap-3 px-4 py-3 bg-white/5 text-xs uppercase tracking-wider opacity-70 border-b border-white/10">
          <div>Number / Lead</div>
          <div>Direction</div>
          <div>Outcome</div>
          <div>Duration</div>
          <div>Started</div>
          <div>Ended</div>
          <div>Handoff</div>
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center opacity-60 border-t border-white/5">
            No calls yet. Calls appear here when made or received via the AI or dashboard.
          </div>
        ) : (
          <ul>
            {items.map((it) => (
              <li
                key={it.id}
                className="grid md:grid-cols-[minmax(180px,1.2fr)_100px_100px_100px_100px_100px_120px] gap-3 px-4 py-3 border-b border-white/5 items-center hover:bg-white/[0.03] cursor-pointer"
                onClick={() => setSelectedCall(it)}
              >
                <div>
                  <div className="font-medium truncate">
                    {it.toE164} {it.leadId ? `· Lead: ${it.leadId.slice(0, 10)}…` : ""}
                  </div>
                </div>
                <div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${DIRECTION_COLORS[it.direction] ?? "bg-white/10 text-white border-white/20"}`}>
                    {it.direction}
                  </span>
                </div>
                <div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${OUTCOME_COLORS[it.outcome ?? ""] ?? "bg-white/10 text-white border-white/20"}`}>
                    {it.outcome?.replace(/_/g, " ") ?? "—"}
                  </span>
                </div>
                <div className="text-xs">
                  {it.durationSeconds != null ? `${Math.floor(it.durationSeconds / 60)}m ${it.durationSeconds % 60}s` : "—"}
                </div>
                <div className="text-xs">
                  {it.answeredAt ? new Date(it.answeredAt).toLocaleTimeString() : it.createdAt ? new Date(it.createdAt).toLocaleTimeString() : "—"}
                </div>
                <div className="text-xs">
                  {it.endedAt ? new Date(it.endedAt).toLocaleTimeString() : "—"}
                </div>
                <div className="text-xs">
                  {it.humanHandoff?.requested ? (it.humanHandoff.tebogoAnswered ? "✅ Answered" : it.humanHandoff.triedConference ? "🔄 Tried" : "⏳ Pending") : "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-xs opacity-60">{items.length} shown</div>
        <button
          type="button"
          className="btn btn-outline !py-2"
          disabled={!nextCursor || loadingMore}
          onClick={() => {
            setLoadingMore(true);
            void load(false);
          }}
        >
          {loadingMore ? "Loading…" : nextCursor ? "Load more" : "End of list"}
        </button>
      </div>

      {selectedCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedCall(null)}>
          <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-title">Call Details</h3>
              <button onClick={() => setSelectedCall(null)} className="text-white/60 hover:text-white text-2xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="opacity-60">Direction:</span> <span className="ml-2">{selectedCall.direction}</span></div>
                <div><span className="opacity-60">Outcome:</span> <span className="ml-2">{selectedCall.outcome ?? "—"}</span></div>
                <div><span className="opacity-60">From:</span> <span className="ml-2">{selectedCall.fromE164}</span></div>
                <div><span className="opacity-60">To:</span> <span className="ml-2">{selectedCall.toE164}</span></div>
                <div><span className="opacity-60">Provider:</span> <span className="ml-2">{selectedCall.provider}</span></div>
                <div><span className="opacity-60">Duration:</span> <span className="ml-2">{selectedCall.durationSeconds != null ? `${Math.floor(selectedCall.durationSeconds / 60)}m ${selectedCall.durationSeconds % 60}s` : "—"}</span></div>
                <div><span className="opacity-60">Answered:</span> <span className="ml-2">{selectedCall.answeredAt ? new Date(selectedCall.answeredAt).toLocaleString() : selectedCall.createdAt ? new Date(selectedCall.createdAt).toLocaleString() : "—"}</span></div>
                <div><span className="opacity-60">Ended:</span> <span className="ml-2">{selectedCall.endedAt ? new Date(selectedCall.endedAt).toLocaleString() : "—"}</span></div>
                <div><span className="opacity-60">Lead:</span> <span className="ml-2">{selectedCall.leadId ?? "—"}</span></div>
              </div>
              {selectedCall.humanHandoff && (
                <div className="border-t border-white/10 pt-4">
                  <h4 className="font-medium mb-2">Handoff Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="opacity-60">Requested:</span> <span className="ml-2">{selectedCall.humanHandoff.requested ? "Yes" : "No"}</span></div>
                    <div><span className="opacity-60">Tried Conference:</span> <span className="ml-2">{selectedCall.humanHandoff.triedConference ? "Yes" : "No"}</span></div>
                    <div><span className="opacity-60">Tebogo Answered:</span> <span className="ml-2">{selectedCall.humanHandoff.tebogoAnswered ? "Yes" : "No"}</span></div>
                    <div><span className="opacity-60">Booked Booking:</span> <span className="ml-2">{selectedCall.humanHandoff.bookedBookingId ?? "—"}</span></div>
                    <div><span className="opacity-60">Reason:</span> <span className="ml-2">{selectedCall.humanHandoff.handoffReason ?? "—"}</span></div>
                  </div>
                </div>
              )}
              {selectedCall.transcript && selectedCall.transcript.length > 0 && (
                <div className="border-t border-white/10 pt-4">
                  <h4 className="font-medium mb-2">Transcript</h4>
                  <div className="space-y-2 text-sm max-h-60 overflow-auto">
                    {selectedCall.transcript.map((chunk, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="font-mono text-xs opacity-50 w-24 shrink-0">{new Date(chunk.at).toLocaleTimeString()}</span>
                        <span className="px-2 py-0.5 rounded bg-white/10 text-xs">{chunk.role}</span>
                        <span>{chunk.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedCall.summary && (
                <div className="border-t border-white/10 pt-4">
                  <h4 className="font-medium mb-2">AI Summary</h4>
                  <p className="text-sm opacity-80">{selectedCall.summary}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}