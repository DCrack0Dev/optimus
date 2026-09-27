"use client";

import { useEffect, useState } from "react";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";
import type { Budget, BudgetChannel } from "@shared/types";

type SetBudgetResponse = {
  ok: boolean;
  budget?: Budget;
  error?: string;
};

export default function BudgetsSettings() {
  const { user, initialising: loading } = useFirebaseUser();
  const [budgets, setBudgets] = useState<Record<BudgetChannel, Budget>>({} as any);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const channels: BudgetChannel[] = ["AI", "EMAIL", "VOICE", "WHATSAPP", "TOTAL_OUTREACH"];

  async function load() {
    setBusy(true);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const res = await fetch("/api/settings/budgets", {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? "load failed");
      setBudgets(body.budgets);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "load failed");
    } finally {
      setBusy(false);
    }
  }

  async function save(channel: BudgetChannel, limitDollars: number, stopAtBudget: boolean) {
    setSaving(channel);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const res = await fetch("/api/settings/budgets", {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel, limitDollars, stopAtBudget }),
      });
      const body = (await res.json()) as SetBudgetResponse;
      if (!res.ok || !body.ok || !body.budget) throw new Error(body.error ?? "save failed");
      setBudgets((prev) => ({ ...prev, [channel]: body.budget! }));
    } catch (e: any) {
      alert(e?.message ?? "save failed");
    } finally {
      setSaving(null);
    }
  }

  useEffect(() => {
    if (!user && !loading) return;
    if (loading) return;
    void load();
  }, [user, loading]);

  function getPct(b: Budget): number {
    if (b.limitDollars === 0) return 0;
    return Math.min(100, Math.round((b.usedDollars / b.limitDollars) * 100));
  }

  if (loading || busy) {
    return <div className="order-card opacity-60">Loading budgets…</div>;
  }

  return (
    <div className="order-card">
      <div className="mb-6">
        <div className="section-tag">Settings / Budgets</div>
        <h1 className="text-2xl font-title text-white mt-1">Budgets & Limits</h1>
        <p className="opacity-70 text-sm mt-1">Configure monthly spending limits per channel. Used dollars reset monthly.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 p-3 text-sm mb-6">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {channels.map((channel) => {
          const b = budgets[channel];
          if (!b) return null;
          const pct = getPct(b);
          return (
            <div key={channel} className="p-5 bg-black/30 border border-white/10 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-title text-lg">{channel}</h3>
                <span className={`text-xs font-mono ${pct >= 90 ? "text-red-400" : pct >= 70 ? "text-[var(--gold)]" : "text-emerald-400"}`}>
                  {pct}%
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: pct >= 90 ? "#ef4444" : pct >= 70 ? "#D4A017" : "#3b82f6",
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <div className="opacity-60">Used</div>
                  <div className="font-mono">${b.usedDollars.toFixed(2)}</div>
                </div>
                <div>
                  <div className="opacity-60">Limit</div>
                  <div className="font-mono">${b.limitDollars.toFixed(2)}</div>
                </div>
                <div>
                  <div className="opacity-60">Remaining</div>
                  <div className="font-mono">${Math.max(0, b.limitDollars - b.usedDollars).toFixed(2)}</div>
                </div>
                <div>
                  <div className="opacity-60">Stop at limit</div>
                  <div className="font-mono">{b.stopAtBudget ? "Yes" : "No"}</div>
                </div>
              </div>
              <BudgetForm
                channel={channel}
                initialLimit={b.limitDollars}
                initialStop={b.stopAtBudget}
                onSave={save}
                saving={saving === channel}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BudgetForm({
  channel,
  initialLimit,
  initialStop,
  onSave,
  saving,
}: {
  channel: BudgetChannel;
  initialLimit: number;
  initialStop: boolean;
  onSave: (ch: BudgetChannel, limit: number, stop: boolean) => void;
  saving: boolean;
}) {
  const [limit, setLimit] = useState(initialLimit);
  const [stop, setStop] = useState(initialStop);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(channel, limit, stop);
      }}
      className="flex flex-wrap gap-2"
    >
      <input
        type="number"
        min="0"
        step="1"
        value={limit}
        onChange={(e) => setLimit(Number(e.target.value))}
        className="flex-1 min-w-[100px] bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/40"
        placeholder="Limit $"
        disabled={saving}
      />
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={stop}
          onChange={(e) => setStop(e.target.checked)}
          className="accent-[var(--gold)]"
          disabled={saving}
        />
        Stop at limit
      </label>
      <button
        type="submit"
        className="btn btn-gold !py-2 !px-3 text-xs"
        disabled={saving}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}