"use client";

import { useEffect, useState } from "react";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";
import type { TebogoAvailabilityRule, TebogoAvailabilityRuleId } from "@shared/types";

type ListResponse = {
  ok: boolean;
  items: Array<TebogoAvailabilityRule & { id: TebogoAvailabilityRuleId }>;
  error?: string;
};

type CreateResponse = {
  ok: boolean;
  rule?: TebogoAvailabilityRule & { id: TebogoAvailabilityRuleId };
  error?: string;
};

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMins(time: string): number {
  const parts = time.split(":");
  const h = Number(parts[0] ?? "0");
  const m = Number(parts[1] ?? "0");
  return h * 60 + m;
}

export default function AvailabilitySettings() {
  const { user, initialising: loading } = useFirebaseUser();
  const [items, setItems] = useState<Array<TebogoAvailabilityRule & { id: TebogoAvailabilityRuleId }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createDay, setCreateDay] = useState(1);
  const [createStart, setCreateStart] = useState("09:00");
  const [createEnd, setCreateEnd] = useState("17:00");
  const [createNote, setCreateNote] = useState("");
  const [createEnabled, setCreateEnabled] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const res = await fetch("/api/settings/availability", {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
      });
      const body = (await res.json()) as ListResponse;
      if (!res.ok || !body.ok) throw new Error(body.error ?? "load failed");
      setItems(body.items);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "load failed");
    } finally {
      setBusy(false);
    }
  }

  async function createRule() {
    setCreating(true);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const res = await fetch("/api/settings/availability", {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dayOfWeek: createDay,
          startUtcMin: timeToMins(createStart),
          endUtcMin: timeToMins(createEnd),
          enabled: createEnabled,
          note: createNote || null,
        }),
      });
      const body = (await res.json()) as CreateResponse;
      if (!res.ok || !body.ok || !body.rule) throw new Error(body.error ?? "create failed");
      setItems((prev) => [...prev, body.rule!].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startUtcMin - b.startUtcMin));
      setShowCreate(false);
      setCreateNote("");
    } catch (e: any) {
      alert(e?.message ?? "create failed");
    } finally {
      setCreating(false);
    }
  }

  async function updateRule(id: TebogoAvailabilityRuleId, patch: Partial<TebogoAvailabilityRule>) {
    try {
      const token = user ? await user.getIdToken(true) : null;
      const res = await fetch(`/api/settings/availability/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "update failed");
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    } catch (e: any) {
      alert(e?.message ?? "update failed");
    }
  }

  async function deleteRule(id: TebogoAvailabilityRuleId) {
    if (!confirm("Delete this availability rule?")) return;
    try {
      const token = user ? await user.getIdToken(true) : null;
      const res = await fetch(`/api/settings/availability/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "delete failed");
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (e: any) {
      alert(e?.message ?? "delete failed");
    }
  }

  useEffect(() => {
    if (!user && !loading) return;
    if (loading) return;
    void load();
  }, [user, loading]);

  if (loading || busy) {
    return <div className="order-card opacity-60">Loading availability…</div>;
  }

  return (
    <div className="order-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="section-tag">Settings / Availability</div>
          <h1 className="text-2xl font-title text-white mt-1">Tebogo Availability</h1>
          <p className="opacity-70 text-sm mt-1">Define when Tebogo is available for callbacks, video meetings, and handoffs.</p>
        </div>
        <button
          type="button"
          className="btn btn-gold"
          onClick={() => setShowCreate(true)}
        >
          ➕ Add Rule
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 p-3 text-sm mb-6">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="hidden md:grid grid-cols-[100px_120px_120px_100px_120px_100px] gap-3 px-4 py-3 bg-white/5 text-xs uppercase tracking-wider opacity-70 border-b border-white/10">
          <div>Day</div>
          <div>Start (UTC)</div>
          <div>End (UTC)</div>
          <div>Enabled</div>
          <div>Note</div>
          <div>Actions</div>
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center opacity-60 border-t border-white/5">
            No availability rules yet. Add rules to define when Tebogo is available for handoffs.
          </div>
        ) : (
          <ul>
            {items.map((it) => (
              <li
                key={it.id}
                className="grid md:grid-cols-[100px_120px_120px_100px_120px_100px] gap-3 px-4 py-3 border-b border-white/5 items-center"
              >
                <div className="text-sm font-medium">{DAYS.find((d) => d.value === it.dayOfWeek)?.label ?? "Unknown"}</div>
                <div className="text-sm">{minsToTime(it.startUtcMin)} UTC</div>
                <div className="text-sm">{minsToTime(it.endUtcMin)} UTC</div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={it.enabled}
                      onChange={(e) => updateRule(it.id, { enabled: e.target.checked })}
                      className="accent-[var(--gold)]"
                    />
                    <span className="text-sm">{it.enabled ? "Yes" : "No"}</span>
                  </label>
                </div>
                <div className="text-sm opacity-75 truncate max-w-[150px]">{it.note ?? "—"}</div>
                <div>
                  <button
                    type="button"
                    className="btn btn-outline !py-1 !px-2 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                    onClick={() => deleteRule(it.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-title">Add Availability Rule</h3>
              <button onClick={() => setShowCreate(false)} className="text-white/60 hover:text-white text-2xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm opacity-70 mb-1">Day</label>
                <select
                  value={createDay}
                  onChange={(e) => setCreateDay(Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {DAYS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm opacity-70 mb-1">Start (UTC)</label>
                  <input
                    type="time"
                    value={createStart}
                    onChange={(e) => setCreateStart(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm opacity-70 mb-1">End (UTC)</label>
                  <input
                    type="time"
                    value={createEnd}
                    onChange={(e) => setCreateEnd(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createEnabled}
                    onChange={(e) => setCreateEnabled(e.target.checked)}
                    className="accent-[var(--gold)]"
                  />
                  <span className="text-sm">Enabled</span>
                </label>
              </div>
              <div>
                <label className="block text-sm opacity-70 mb-1">Note</label>
                <input
                  type="text"
                  value={createNote}
                  onChange={(e) => setCreateNote(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/40"
                  placeholder="Optional note"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="button" className="btn btn-gold" onClick={createRule} disabled={creating}>
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