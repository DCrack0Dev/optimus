"use client";

import { useEffect, useState } from "react";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";
import type { Suppression, SuppressionId, SuppressionReason } from "@shared/types";

type ListResponse = {
  ok: boolean;
  items: Array<Suppression & { id: SuppressionId }>;
  nextCursor?: string | null;
  error?: string;
};

type CreateResponse = {
  ok: boolean;
  suppression?: Suppression & { id: SuppressionId };
  error?: string;
};

export default function SuppressionsSettings() {
  const { user, initialising: loading } = useFirebaseUser();
  const [items, setItems] = useState<Array<Suppression & { id: SuppressionId }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createChannel, setCreateChannel] = useState<"EMAIL" | "WHATSAPP" | "CALL" | "ALL">("ALL");
  const [createReason, setCreateReason] = useState<SuppressionReason>("OPT_OUT_MANUAL");
  const [createNote, setCreateNote] = useState("");
  const [creating, setCreating] = useState(false);

  const reasons: SuppressionReason[] = [
    "UNSUBSCRIBE",
    "BOUNCE_HARD",
    "COMPLAINT",
    "OPT_OUT_MANUAL",
    "LEAD_REQUESTED",
    "GLOBAL_BLACKLIST",
  ];

  const channels = ["EMAIL", "WHATSAPP", "CALL", "ALL"] as const;

  async function load(reset: boolean) {
    setBusy(reset);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const params = new URLSearchParams();
      params.set("limit", String(50));
      if (!reset && nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/settings/suppressions?${params.toString()}`, {
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

  async function createSuppression() {
    if (!createEmail && !createPhone) {
      alert("Email or phone is required");
      return;
    }
    setCreating(true);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const res = await fetch("/api/settings/suppressions", {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: createEmail || null,
          phoneE164: createPhone || null,
          channel: createChannel,
          reason: createReason,
          note: createNote || null,
        }),
      });
      const body = (await res.json()) as CreateResponse;
      if (!res.ok || !body.ok || !body.suppression) throw new Error(body.error ?? "create failed");
      setItems((prev) => [body.suppression!, ...prev]);
      setShowCreate(false);
      setCreateEmail("");
      setCreatePhone("");
      setCreateNote("");
    } catch (e: any) {
      alert(e?.message ?? "create failed");
    } finally {
      setCreating(false);
    }
  }

  async function removeSuppression(id: SuppressionId) {
    if (!confirm("Remove this suppression?")) return;
    try {
      const token = user ? await user.getIdToken(true) : null;
      const res = await fetch(`/api/settings/suppressions/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "remove failed");
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (e: any) {
      alert(e?.message ?? "remove failed");
    }
  }

  useEffect(() => {
    if (!user && !loading) return;
    if (loading) return;
    void load(true);
  }, [user, loading]);

  const REASON_COLORS: Record<SuppressionReason, string> = {
    UNSUBSCRIBE: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    BOUNCE_HARD: "bg-red-500/15 text-red-300 border-red-500/30",
    COMPLAINT: "bg-red-500/15 text-red-300 border-red-500/30",
    OPT_OUT_MANUAL: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    LEAD_REQUESTED: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    GLOBAL_BLACKLIST: "bg-red-500/15 text-red-300 border-red-500/30",
  };

  if (loading || busy) {
    return <div className="order-card opacity-60">Loading suppressions…</div>;
  }

  return (
    <div className="order-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="section-tag">Settings / Suppressions</div>
          <h1 className="text-2xl font-title text-white mt-1">Suppression Lists</h1>
          <p className="opacity-70 text-sm mt-1">Manage emails and phone numbers suppressed from outbound communications.</p>
        </div>
        <button
          type="button"
          className="btn btn-gold"
          onClick={() => setShowCreate(true)}
        >
          ➕ Add Suppression
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 p-3 text-sm mb-6">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="hidden md:grid grid-cols-[minmax(200px,1.5fr)_140px_100px_100px_100px_120px] gap-3 px-4 py-3 bg-white/5 text-xs uppercase tracking-wider opacity-70 border-b border-white/10">
          <div>Email / Phone</div>
          <div>Channel</div>
          <div>Reason</div>
          <div>Lead</div>
          <div>Created</div>
          <div>Actions</div>
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center opacity-60 border-t border-white/5">
            No suppressions yet. Add emails or phone numbers to prevent outbound messages.
          </div>
        ) : (
          <ul>
            {items.map((it) => (
              <li
                key={it.id}
                className="grid md:grid-cols-[minmax(200px,1.5fr)_140px_100px_100px_100px_120px] gap-3 px-4 py-3 border-b border-white/5 items-center"
              >
                <div className="font-mono text-sm">{it.email ?? it.phoneE164 ?? "—"}</div>
                <div className="text-xs opacity-75">{it.channel}</div>
                <div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${REASON_COLORS[it.reason]}`}>
                    {it.reason.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-xs opacity-75">{it.leadId ?? "—"}</div>
                <div className="text-xs">{new Date(it.createdAt).toLocaleDateString()}</div>
                <div>
                  <button
                    type="button"
                    className="btn btn-outline !py-1 !px-2 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                    onClick={() => removeSuppression(it.id)}
                  >
                    Remove
                  </button>
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

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-title">Add Suppression</h3>
              <button onClick={() => setShowCreate(false)} className="text-white/60 hover:text-white text-2xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm opacity-70 mb-1">Email</label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/40"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm opacity-70 mb-1">Phone (E.164)</label>
                <input
                  type="tel"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/40"
                  placeholder="+27830001234"
                />
              </div>
              <div>
                <label className="block text-sm opacity-70 mb-1">Channel</label>
                <select
                  value={createChannel}
                  onChange={(e) => setCreateChannel(e.target.value as any)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {channels.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm opacity-70 mb-1">Reason</label>
                <select
                  value={createReason}
                  onChange={(e) => setCreateReason(e.target.value as any)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {reasons.map((r) => (
                    <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm opacity-70 mb-1">Note</label>
                <textarea
                  value={createNote}
                  onChange={(e) => setCreateNote(e.target.value)}
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/40"
                  placeholder="Optional note"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="button" className="btn btn-gold" onClick={createSuppression} disabled={creating}>
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}