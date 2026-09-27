"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";
import type { AuditLog, AuditLogId } from "@shared/types";

type ListResponse = {
  ok: boolean;
  items: Array<AuditLog & { id: AuditLogId }>;
  nextCursor?: string | null;
  error?: string;
};

export default function AuditSettings() {
  const { user, initialising: loading } = useFirebaseUser();
  const [items, setItems] = useState<Array<AuditLog & { id: AuditLogId }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [event, setEvent] = useState<string>("ALL");
  const [actor, setActor] = useState<string>("ALL");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const events = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.event) s.add(it.event);
    return Array.from(s).sort();
  }, [items]);

  const actors = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.actorUid) s.add(it.actorUid);
    return Array.from(s).sort();
  }, [items]);

  async function load(reset: boolean) {
    setBusy(reset);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const params = new URLSearchParams();
      params.set("sort", "createdAt");
      params.set("sortDir", sortDir);
      if (event !== "ALL") params.set("event", event);
      if (actor !== "ALL") params.set("actor", actor);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", String(50));
      if (!reset && nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/settings/audit?${params.toString()}`, {
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
  }, [user, loading, event, actor, sortDir, q]);

  if (loading || busy) {
    return <div className="order-card opacity-60">Loading audit logs…</div>;
  }

  return (
    <div className="order-card">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <div className="section-tag">Settings / Audit Logs</div>
          <h1 className="text-2xl font-title text-white mt-1">Audit Trail</h1>
          <p className="opacity-70 text-sm mt-1">Complete history of all system actions, AI operations, and administrative changes.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 items-center">
          <input
            type="search"
            placeholder="Search detail, data…"
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm w-60 max-w-full text-white placeholder:text-white/40"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          >
            <option value="ALL">All events</option>
            {events.map((e) => (
              <option key={e} value={e}>
                {e.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
          >
            <option value="ALL">All actors</option>
            {actors.map((a) => (
              <option key={a} value={a}>
                {a}
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

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 p-3 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="hidden md:grid grid-cols-[120px_120px_minmax(200px,1fr)_100px_120px_100px] gap-3 px-4 py-3 bg-white/5 text-xs uppercase tracking-wider opacity-70 border-b border-white/10">
          <div>Event</div>
          <div>Actor</div>
          <div>Detail</div>
          <div>Lead</div>
          <div>IP</div>
          <div>Time</div>
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center opacity-60 border-t border-white/5">
            No audit logs yet. Logs appear here for all system actions.
          </div>
        ) : (
          <ul>
            {items.map((it) => (
              <li
                key={it.id}
                className="grid md:grid-cols-[120px_120px_minmax(200px,1fr)_100px_120px_100px] gap-3 px-4 py-3 border-b border-white/5 items-center hover:bg-white/[0.03]"
              >
                <div className="text-xs font-mono">{it.event.replace(/_/g, " ")}</div>
                <div className="text-xs">{it.actorUid ?? "—"}</div>
                <div className="text-xs truncate opacity-80">{it.detail ?? "—"}</div>
                <div className="text-xs opacity-75">{it.leadId ?? "—"}</div>
                <div className="text-xs opacity-60 truncate max-w-[80px]">{it.ip ?? "—"}</div>
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
    </div>
  );
}