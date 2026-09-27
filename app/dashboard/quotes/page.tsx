"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";
import type { Quote, QuoteId, QuoteStatus } from "@shared/types";

type ListResponse = {
  ok: boolean;
  items: Array<Quote & { id: QuoteId }>;
  nextCursor?: string | null;
  error?: string;
};

export default function QuotesDashboard() {
  const { user, initialising: loading } = useFirebaseUser();
  const [items, setItems] = useState<Array<Quote & { id: QuoteId }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [sort, setSort] = useState<"createdAt" | "sentAt" | "acceptedAt" | "wonAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedQuote, setSelectedQuote] = useState<Quote & { id: QuoteId } | null>(null);

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
      params.set("sort", sort);
      params.set("sortDir", sortDir);
      if (status !== "ALL") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", String(50));
      if (!reset && nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/quotes?${params.toString()}`, {
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
  }, [user, loading, status, sort, sortDir, q]);

  const STATUS_COLORS: Record<QuoteStatus, string> = {
    DRAFT: "bg-gray-500/15 text-gray-300 border-gray-500/30",
    SENT: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    VIEWED: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    ACCEPTED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    NEGOTIATING: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
    REJECTED: "bg-red-500/15 text-red-300 border-red-500/30",
    WON: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    LOST: "bg-red-500/15 text-red-300 border-red-500/30",
    EXPIRED: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  };

  const chips = useMemo(() => {
    const base = [{ key: "ALL", label: "All", count: items.length, cls: "bg-white/10 text-white border-white/20" }];
    for (const s of statuses) {
      const c = items.filter((it) => it.status === s).length;
      base.push({ key: s, label: s, count: c, cls: STATUS_COLORS[s as QuoteStatus] ?? "bg-white/10 text-white border-white/20" });
    }
    return base;
  }, [items, statuses]);

  function formatCurrency(cents: number, currency = "ZAR"): string {
    return `${currency} ${(cents / 100).toLocaleString()}`;
  }

  if (loading || (busy && items.length === 0)) {
    return <div className="order-card opacity-60">Loading quotes…</div>;
  }

  return (
    <div className="order-card">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <div className="section-tag">Quotes</div>
          <div className="text-2xl font-title text-white mt-1">Deals Pipeline</div>
          <div className="opacity-70 text-sm mt-1">
            Track all quotes from draft to won/lost. Range-based pricing only.
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 items-center">
          <input
            type="search"
            placeholder="Search title, lead, amount…"
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm w-60 max-w-full text-white placeholder:text-white/40"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
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
          <select
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
          >
            <option value="createdAt">Created</option>
            <option value="sentAt">Sent</option>
            <option value="acceptedAt">Accepted</option>
            <option value="wonAt">Won</option>
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
            onClick={() => setStatus(c.key)}
            className={`rounded-full border px-3 py-1 text-xs ${c.cls} ${
              status === c.key ? "ring-2 ring-offset-2 ring-offset-black ring-[var(--gold)]/70" : "opacity-85"
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
        <div className="hidden md:grid grid-cols-[minmax(220px,1.4fr)_140px_120px_120px_100px_100px] gap-3 px-4 py-3 bg-white/5 text-xs uppercase tracking-wider opacity-70 border-b border-white/10">
          <div>Title / Lead</div>
          <div>Status</div>
          <div>Range</div>
          <div>Created</div>
          <div>Sent / Won</div>
          <div>By</div>
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center opacity-60 border-t border-white/5">
            No quotes yet. Quotes are created by AI or manually from the dashboard.
          </div>
        ) : (
          <ul>
            {items.map((it) => (
              <li
                key={it.id}
                className="grid md:grid-cols-[minmax(220px,1.4fr)_140px_120px_120px_100px_100px] gap-3 px-4 py-3 border-b border-white/5 items-center hover:bg-white/[0.03] cursor-pointer"
                onClick={() => setSelectedQuote(it)}
              >
                <div>
                  <div className="font-medium truncate">{it.title}</div>
                  <div className="text-xs opacity-70 mt-1">Lead: {it.leadId.slice(0, 12)}…</div>
                </div>
                <div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${STATUS_COLORS[it.status]}`}>
                    {it.status}
                  </span>
                </div>
                <div className="text-sm font-mono text-[var(--gold)]">
                  {formatCurrency(it.rangeLowCents, it.currency)} – {formatCurrency(it.rangeHighCents, it.currency)}
                </div>
                <div className="text-xs">{new Date(it.createdAt).toLocaleDateString()}</div>
                <div className="text-xs">
                  {it.sentAt ? <div>Sent: {new Date(it.sentAt).toLocaleDateString()}</div> : <div className="opacity-50">Not sent</div>}
                  {it.wonAt ? <div className="text-[var(--gold)] mt-1">Won: {new Date(it.wonAt).toLocaleDateString()}</div> : null}
                </div>
                <div className="text-xs opacity-75">{it.createdBy ?? "—"}</div>
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

      {selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedQuote(null)}>
          <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-title">{selectedQuote.title}</h3>
              <button onClick={() => setSelectedQuote(null)} className="text-white/60 hover:text-white text-2xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="opacity-60">Status:</span> <span className="ml-2">{selectedQuote.status}</span></div>
                <div><span className="opacity-60">Currency:</span> <span className="ml-2">{selectedQuote.currency}</span></div>
                <div><span className="opacity-60">Range:</span> <span className="ml-2">{formatCurrency(selectedQuote.rangeLowCents, selectedQuote.currency)} – {formatCurrency(selectedQuote.rangeHighCents, selectedQuote.currency)}</span></div>
                <div><span className="opacity-60">Exact Total:</span> <span className="ml-2">{selectedQuote.exactTotalCents ? formatCurrency(selectedQuote.exactTotalCents, selectedQuote.currency) : "—"}</span></div>
                <div><span className="opacity-60">Lead:</span> <span className="ml-2">{selectedQuote.leadId}</span></div>
                <div><span className="opacity-60">Created By:</span> <span className="ml-2">{selectedQuote.createdBy ?? "—"}</span></div>
                <div><span className="opacity-60">Created:</span> <span className="ml-2">{new Date(selectedQuote.createdAt).toLocaleString()}</span></div>
                <div><span className="opacity-60">Valid Until:</span> <span className="ml-2">{selectedQuote.validUntil ? new Date(selectedQuote.validUntil).toLocaleString() : "—"}</span></div>
                <div><span className="opacity-60">Sent:</span> <span className="ml-2">{selectedQuote.sentAt ? new Date(selectedQuote.sentAt).toLocaleString() : "—"}</span></div>
                <div><span className="opacity-60">Viewed:</span> <span className="ml-2">{selectedQuote.viewedAt ? new Date(selectedQuote.viewedAt).toLocaleString() : "—"}</span></div>
                <div><span className="opacity-60">Accepted:</span> <span className="ml-2">{selectedQuote.acceptedAt ? new Date(selectedQuote.acceptedAt).toLocaleString() : "—"}</span></div>
                <div><span className="opacity-60">Won:</span> <span className="ml-2">{selectedQuote.wonAt ? new Date(selectedQuote.wonAt).toLocaleString() : "—"}</span></div>
              </div>
              {selectedQuote.notes && (
                <div className="border-t border-white/10 pt-4">
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm opacity-80">{selectedQuote.notes}</p>
                </div>
              )}
              {selectedQuote.terms && (
                <div className="border-t border-white/10 pt-4">
                  <h4 className="font-medium mb-2">Terms</h4>
                  <p className="text-sm opacity-80">{selectedQuote.terms}</p>
                </div>
              )}
              <div className="border-t border-white/10 pt-4">
                <h4 className="font-medium mb-2">Line Items</h4>
                <div className="space-y-2">
                  {selectedQuote.items.map((item, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-sm p-3 bg-black/30 rounded-lg">
                      <div className="font-medium">{item.label}</div>
                      <div className="opacity-70">{item.description ?? "—"}</div>
                      <div>Qty: {item.quantity}</div>
                      <div className="text-[var(--gold)] font-mono">{formatCurrency(item.unitRangeLowCents, item.currency)} – {formatCurrency(item.unitRangeHighCents, item.currency)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}