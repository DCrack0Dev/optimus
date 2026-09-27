"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";
import type { Lead, LeadId, LeadStatus, LeadSource } from "@shared/types";

type LeadRow = Lead & { id: LeadId };

const LEAD_STATUS_OPTIONS: LeadStatus[] = [
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

const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  CONTACTED: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  REPLIED: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  QUALIFIED: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  HOT: "bg-red-500/15 text-red-300 border-red-500/30",
  QUOTE_SENT: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  NEGOTIATING: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  WON: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  LOST: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  FOLLOW_UP: "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30",
};

type ListResponse = {
  ok: boolean;
  items: LeadRow[];
  nextCursor?: string | null;
  error?: string;
};

export default function LeadsListClient() {
  const { user, initialising: loading } = useFirebaseUser();
  const [items, setItems] = useState<LeadRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [source, setSource] = useState<string>("ALL");
  const [sort, setSort] = useState<"updatedAt" | "createdAt" | "lastContactAt">("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sources = useMemo(() => {
    const s = new Set<LeadSource>();
    for (const it of items) if (it.source) s.add(it.source);
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
      if (source !== "ALL") params.set("source", source);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", String(50));
      if (!reset && nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/leads?${params.toString()}`, {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, status, source, sort, sortDir, q]);

  const counts = useMemo(() => {
    const byStatus = new Map<LeadStatus, number>();
    for (const it of items) byStatus.set(it.status, (byStatus.get(it.status) ?? 0) + 1);
    return byStatus;
  }, [items]);

  const chips = useMemo(() => {
    const base: Array<{ key: string; label: string; count?: number; cls: string }> = [
      { key: "ALL", label: "All", count: items.length, cls: "bg-white/10 text-white border-white/20" },
    ];
    for (const s of LEAD_STATUS_OPTIONS) {
      const c = counts.get(s);
      if (c === undefined) continue;
      base.push({
        key: s,
        label: s.replace(/_/g, " "),
        count: c,
        cls: STATUS_COLORS[s],
      });
    }
    return base;
  }, [items, counts]);

  if (loading || (busy && items.length === 0)) {
    return <div className="order-card opacity-60">Loading leads…</div>;
  }

  return (
    <div className="order-card">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <div className="section-tag">Leads</div>
          <div className="text-2xl font-title text-white mt-1">Prospect pipeline</div>
          <div className="opacity-70 text-sm mt-1">
            Click a lead to view the unified timeline of every email, call, WhatsApp, quote, booking, follow-up, AI action and website event.
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 items-center">
          <input
            type="search"
            placeholder="Search name, email, company…"
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm w-60 max-w-full text-white placeholder:text-white/40"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="ALL">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
          >
            <option value="updatedAt">Updated</option>
            <option value="createdAt">Created</option>
            <option value="lastContactAt">Last contact</option>
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
        <div className="hidden md:grid grid-cols-[minmax(220px,1.4fr)_100px_140px_140px_120px_90px] gap-3 px-4 py-3 bg-white/5 text-xs uppercase tracking-wider opacity-70 border-b border-white/10">
          <div>Lead</div>
          <div>Temperature</div>
          <div>Services</div>
          <div>Last / Next</div>
          <div>Source</div>
          <div>Status</div>
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center opacity-60 border-t border-white/5">
            No leads match filters yet. Leads are auto-created when visitors request a quote,
            register, submit the contact form or request an app on the public site.
          </div>
        ) : (
          <ul>
            {items.map((it) => (
              <li
                key={it.id}
                className="grid md:grid-cols-[minmax(220px,1.4fr)_100px_140px_140px_120px_90px] gap-3 px-4 py-3 border-b border-white/5 items-center hover:bg-white/[0.03]"
              >
                <div>
                  <Link
                    href={`/dashboard/leads/${it.id}`}
                    className="text-white hover:underline decoration-[var(--gold)]/50 underline-offset-4"
                  >
                    <div className="font-medium">
                      {it.fullName ?? it.company ?? it.email ?? it.phoneE164 ?? "Untitled lead"}
                    </div>
                  </Link>
                  <div className="text-xs opacity-70 mt-1 space-x-3">
                    {it.email ? <span>✉ {it.email}</span> : null}
                    {it.phoneE164 ? <span>☎ {it.phoneE164}</span> : null}
                    {it.company ? <span>🏢 {it.company}</span> : null}
                  </div>
                </div>
                <div>
                  <div className="h-2 w-20 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(100, Number(it.temperature) | 0))}%`,
                        background:
                          (it.temperature ?? 0) >= 75
                            ? "linear-gradient(90deg,#fca5a5,#ef4444)"
                            : (it.temperature ?? 0) >= 45
                              ? "linear-gradient(90deg,#fde68a,#D4A017)"
                              : "linear-gradient(90deg,#93c5fd,#3b82f6)",
                      }}
                    />
                  </div>
                  <div className="text-xs opacity-60 mt-1">
                    {Number(it.temperature | 0)}%
                  </div>
                </div>
                <div>
                  {it.servicesInterested && it.servicesInterested.length ? (
                    <div className="flex flex-wrap gap-1">
                      {it.servicesInterested.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="text-[11px] rounded-full px-2 py-0.5 bg-white/10 border border-white/10"
                        >
                          {s.replace(/_/g, " ")}
                        </span>
                      ))}
                      {it.servicesInterested.length > 3 ? (
                        <span className="text-[11px] opacity-60">
                          +{it.servicesInterested.length - 3}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-xs opacity-50">—</div>
                  )}
                </div>
                <div className="text-xs">
                  {it.lastContactAt ? (
                    <div>Last: {new Date(it.lastContactAt).toLocaleDateString()}</div>
                  ) : (
                    <div className="opacity-50">Last: —</div>
                  )}
                  {it.nextActionAt ? (
                    <div className="mt-1 text-[var(--gold)]">
                      Next: {new Date(it.nextActionAt).toLocaleDateString()}
                      {it.nextAction ? <span className="opacity-70"> · {it.nextAction.slice(0, 30)}</span> : null}
                    </div>
                  ) : it.nextAction ? (
                    <div className="opacity-70 mt-1">Next: {it.nextAction.slice(0, 40)}</div>
                  ) : null}
                </div>
                <div className="text-xs opacity-75">
                  {it.source.replace(/_/g, " ")}
                  {it.sourceCampaign ? <div className="opacity-60">{it.sourceCampaign.slice(0, 20)}</div> : null}
                </div>
                <div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${STATUS_COLORS[it.status]}`}>
                    {it.status.replace(/_/g, " ")}
                  </span>
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
    </div>
  );
}
