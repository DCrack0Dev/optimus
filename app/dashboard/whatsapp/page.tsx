"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";
import type { WhatsAppMessage, WhatsAppMessageId } from "@shared/types";

type ListResponse = {
  ok: boolean;
  items: Array<WhatsAppMessage & { id: WhatsAppMessageId }>;
  nextCursor?: string | null;
  error?: string;
};

export default function WhatsAppDashboard() {
  const { user, initialising: loading } = useFirebaseUser();
  const [items, setItems] = useState<Array<WhatsAppMessage & { id: WhatsAppMessageId }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [direction, setDirection] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedMsg, setSelectedMsg] = useState<WhatsAppMessage & { id: WhatsAppMessageId } | null>(null);

  const directions = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.direction) s.add(it.direction);
    return Array.from(s).sort();
  }, [items]);

  const statuses = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.status) s.add(it.status);
    return Array.from(s).sort();
  }, [items]);

  async function load(reset: boolean) {
    setBusy(reset);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const params = new URLSearchParams();
      params.set("sort", "createdAt");
      params.set("sortDir", sortDir);
      if (direction !== "ALL") params.set("direction", direction);
      if (status !== "ALL") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", String(50));
      if (!reset && nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/whatsapp?${params.toString()}`, {
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
  }, [user, loading, direction, status, sortDir, q]);

  const DIRECTION_COLORS: Record<string, string> = {
    INBOUND: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    OUTBOUND: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  };

  const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    SENT: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    DELIVERED: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    READ: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    FAILED: "bg-red-500/15 text-red-300 border-red-500/30",
    RECEIVED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  };

  const chips = useMemo(() => {
    const base = [{ key: "ALL", label: "All", count: items.length, cls: "bg-white/10 text-white border-white/20" }];
    for (const s of directions) {
      const c = items.filter((it) => it.direction === s).length;
      base.push({ key: s, label: s, count: c, cls: DIRECTION_COLORS[s] ?? "bg-white/10 text-white border-white/20" });
    }
    return base;
  }, [items, directions]);

  if (loading || (busy && items.length === 0)) {
    return <div className="order-card opacity-60">Loading WhatsApp messages…</div>;
  }

  return (
    <div className="order-card">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <div className="section-tag">WhatsApp</div>
          <div className="text-2xl font-title text-white mt-1">Messaging</div>
          <div className="opacity-70 text-sm mt-1">
            Track all WhatsApp conversations, sent and received messages, and delivery status.
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 items-center">
          <input
            type="search"
            placeholder="Search phone, message content…"
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm w-60 max-w-full text-white placeholder:text-white/40"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
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
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
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
            onClick={() => setDirection(c.key)}
            className={`rounded-full border px-3 py-1 text-xs ${c.cls} ${
              direction === c.key ? "ring-2 ring-offset-2 ring-offset-black ring-[var(--gold)]/70" : "opacity-85"
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
        <div className="hidden md:grid grid-cols-[minmax(180px,1.2fr)_100px_100px_100px_140px_120px] gap-3 px-4 py-3 bg-white/5 text-xs uppercase tracking-wider opacity-70 border-b border-white/10">
          <div>Phone / Lead</div>
          <div>Direction</div>
          <div>Status</div>
          <div>Provider</div>
          <div>Message</div>
          <div>Time</div>
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center opacity-60 border-t border-white/5">
            No WhatsApp messages yet. Messages appear here when sent or received via the AI or dashboard.
          </div>
        ) : (
          <ul>
            {items.map((it) => (
              <li
                key={it.id}
                className="grid md:grid-cols-[minmax(180px,1.2fr)_100px_100px_100px_140px_120px] gap-3 px-4 py-3 border-b border-white/5 items-center hover:bg-white/[0.03] cursor-pointer"
                onClick={() => setSelectedMsg(it)}
              >
                <div>
                  <div className="font-medium truncate">
                    {it.fromE164} {it.leadId ? `· Lead: ${it.leadId.slice(0, 10)}…` : ""}
                  </div>
                </div>
                <div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${DIRECTION_COLORS[it.direction] ?? "bg-white/10 text-white border-white/20"}`}>
                    {it.direction}
                  </span>
                </div>
                <div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${STATUS_COLORS[it.status] ?? "bg-white/10 text-white border-white/20"}`}>
                    {it.status}
                  </span>
                </div>
                <div className="text-xs opacity-75">{it.provider}</div>
                <div className="text-xs truncate max-w-[200px] opacity-80">{it.body}</div>
                <div className="text-xs">{new Date(it.createdAt).toLocaleString()}</div>
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

      {selectedMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedMsg(null)}>
          <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-title">WhatsApp Message</h3>
              <button onClick={() => setSelectedMsg(null)} className="text-white/60 hover:text-white text-2xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="opacity-60">Direction:</span> <span className="ml-2">{selectedMsg.direction}</span></div>
                <div><span className="opacity-60">Status:</span> <span className="ml-2">{selectedMsg.status}</span></div>
                <div><span className="opacity-60">From:</span> <span className="ml-2">{selectedMsg.fromE164}</span></div>
                <div><span className="opacity-60">To:</span> <span className="ml-2">{selectedMsg.toE164}</span></div>
                <div><span className="opacity-60">Provider:</span> <span className="ml-2">{selectedMsg.provider}</span></div>
                <div><span className="opacity-60">Provider ID:</span> <span className="ml-2 text-xs truncate">{selectedMsg.providerMessageId ?? "—"}</span></div>
                <div><span className="opacity-60">Lead:</span> <span className="ml-2">{selectedMsg.leadId ?? "—"}</span></div>
                <div><span className="opacity-60">Conversation:</span> <span className="ml-2">{selectedMsg.conversationId ?? "—"}</span></div>
                <div><span className="opacity-60">Created:</span> <span className="ml-2">{new Date(selectedMsg.createdAt).toLocaleString()}</span></div>
              </div>
              <div className="border-t border-white/10 pt-4">
                <h4 className="font-medium mb-2">Message Content</h4>
                <div className="bg-black/30 rounded-lg p-4 whitespace-pre-wrap text-sm">{selectedMsg.body}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}