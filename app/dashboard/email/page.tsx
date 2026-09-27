"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";
import type { EmailDoc, EmailId } from "@shared/types";

type ListResponse = {
  ok: boolean;
  items: Array<EmailDoc & { id: EmailId }>;
  nextCursor?: string | null;
  error?: string;
};

export default function EmailDashboard() {
  const { user, initialising: loading } = useFirebaseUser();
  const [items, setItems] = useState<Array<EmailDoc & { id: EmailId }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [sort, setSort] = useState<"createdAt" | "sentAt" | "replyAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedEmail, setSelectedEmail] = useState<EmailDoc & { id: EmailId } | null>(null);

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
      const res = await fetch(`/api/emails?${params.toString()}`, {
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

  const STATUS_COLORS: Record<string, string> = {
    SENT: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    DELIVERED: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    OPENED: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    CLICKED: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    REPLIED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    FAILED: "bg-red-500/15 text-red-300 border-red-500/30",
    BOUNCE_SOFT: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    BOUNCE_HARD: "bg-red-500/15 text-red-300 border-red-500/30",
    UNSUBSCRIBED: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    COMPLAINT: "bg-red-500/15 text-red-300 border-red-500/30",
    DRAFT: "bg-gray-500/15 text-gray-300 border-gray-500/30",
    QUEUED: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  };

  const chips = useMemo(() => {
    const base = [{ key: "ALL", label: "All", count: items.length, cls: "bg-white/10 text-white border-white/20" }];
    for (const s of statuses) {
      const c = items.filter((it) => it.status === s).length;
      base.push({ key: s, label: s.replace(/_/g, " "), count: c, cls: STATUS_COLORS[s] ?? "bg-white/10 text-white border-white/20" });
    }
    return base;
  }, [items, statuses]);

  if (loading || (busy && items.length === 0)) {
    return <div className="order-card opacity-60">Loading emails…</div>;
  }

  return (
    <div className="order-card">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <div className="section-tag">Email</div>
          <div className="text-2xl font-title text-white mt-1">Outreach & Replies</div>
          <div className="opacity-70 text-sm mt-1">
            Track all outbound emails, delivery status, opens, clicks, and replies.
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 items-center">
          <input
            type="search"
            placeholder="Search subject, recipient, email…"
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
                {s.replace(/_/g, " ")}
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
            <option value="replyAt">Reply</option>
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
        <div className="hidden md:grid grid-cols-[minmax(280px,1.6fr)_140px_140px_120px_120px_100px] gap-3 px-4 py-3 bg-white/5 text-xs uppercase tracking-wider opacity-70 border-b border-white/10">
          <div>Subject / Recipient</div>
          <div>Status</div>
          <div>Lead</div>
          <div>Sent / Reply</div>
          <div>Opened / Clicked</div>
          <div>Provider</div>
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center opacity-60 border-t border-white/5">
            No emails yet. Emails appear here when sent via the AI, dashboard, campaigns, or follow-ups.
          </div>
        ) : (
          <ul>
            {items.map((it) => (
              <li
                key={it.id}
                className="grid md:grid-cols-[minmax(280px,1.6fr)_140px_140px_120px_120px_100px] gap-3 px-4 py-3 border-b border-white/5 items-center hover:bg-white/[0.03] cursor-pointer"
                onClick={() => setSelectedEmail(it)}
              >
                <div>
                  <div className="font-medium truncate">{it.subject ?? "(no subject)"}</div>
                  <div className="text-xs opacity-70 mt-1">
                    → {it.toEmail} {it.toName ? `(${it.toName})` : ""}
                  </div>
                </div>
                <div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${STATUS_COLORS[it.status] ?? "bg-white/10 text-white border-white/20"}`}>
                    {it.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-xs opacity-75">
                  {it.leadId ? `Lead: ${it.leadId.slice(0, 12)}…` : "—"}
                </div>
                <div className="text-xs">
                  {it.sentAt ? (
                    <div>Sent: {new Date(it.sentAt).toLocaleDateString()}</div>
                  ) : (
                    <div className="opacity-50">Not sent</div>
                  )}
                  {it.replyAt ? (
                    <div className="mt-1 text-[var(--gold)]">Replied: {new Date(it.replyAt).toLocaleDateString()}</div>
                  ) : null}
                </div>
                <div className="text-xs opacity-75">
                  {it.openedAt ? `Opened: ${new Date(it.openedAt).toLocaleDateString()}` : "Not opened"}
                  {it.clickedAt ? <div className="mt-1">Clicked: {new Date(it.clickedAt).toLocaleDateString()}</div> : null}
                </div>
                <div className="text-xs opacity-60">{it.provider}</div>
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

      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedEmail(null)}>
          <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-title">{selectedEmail.subject ?? "(no subject)"}</h3>
              <button onClick={() => setSelectedEmail(null)} className="text-white/60 hover:text-white text-2xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="opacity-60">To:</span> <span className="ml-2">{selectedEmail.toEmail} {selectedEmail.toName ? `(${selectedEmail.toName})` : ""}</span></div>
                <div><span className="opacity-60">From:</span> <span className="ml-2">{selectedEmail.fromEmail} {selectedEmail.fromName ? `(${selectedEmail.fromName})` : ""}</span></div>
                <div><span className="opacity-60">Status:</span> <span className="ml-2">{selectedEmail.status}</span></div>
                <div><span className="opacity-60">Provider:</span> <span className="ml-2">{selectedEmail.provider}</span></div>
                <div><span className="opacity-60">Created:</span> <span className="ml-2">{new Date(selectedEmail.createdAt).toLocaleString()}</span></div>
                <div><span className="opacity-60">Sent:</span> <span className="ml-2">{selectedEmail.sentAt ? new Date(selectedEmail.sentAt).toLocaleString() : "—"}</span></div>
                <div><span className="opacity-60">Opened:</span> <span className="ml-2">{selectedEmail.openedAt ? new Date(selectedEmail.openedAt).toLocaleString() : "—"}</span></div>
                <div><span className="opacity-60">Clicked:</span> <span className="ml-2">{selectedEmail.clickedAt ? new Date(selectedEmail.clickedAt).toLocaleString() : "—"}</span></div>
                <div><span className="opacity-60">Replied:</span> <span className="ml-2">{selectedEmail.replyAt ? new Date(selectedEmail.replyAt).toLocaleString() : "—"}</span></div>
                <div><span className="opacity-60">Lead:</span> <span className="ml-2">{selectedEmail.leadId ?? "—"}</span></div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Events</h4>
                <div className="space-y-2 text-sm">
                  {selectedEmail.events?.map((ev, i) => (
                    <div key={i} className="flex gap-3 text-xs opacity-80">
                      <span className="font-mono opacity-50">{new Date(ev.at).toLocaleString()}</span>
                      <span className="px-2 py-0.5 rounded bg-white/10">{ev.status}</span>
                      <span>{ev.detail ?? ""}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-white/10 pt-4">
                <h4 className="font-medium mb-2">HTML Preview</h4>
                <div className="bg-black/30 rounded-lg p-4 max-h-60 overflow-auto text-sm" dangerouslySetInnerHTML={{ __html: selectedEmail.html ?? "<em>No HTML content</em>" }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}