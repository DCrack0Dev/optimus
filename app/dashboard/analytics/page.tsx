"use client";

import { useEffect, useState } from "react";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";
import { TileSummaryData } from "@optimus/lib/analytics/summary";

type AnalyticsResponse = {
  ok: boolean;
  tiles?: TileSummaryData;
  error?: string;
};

export default function AnalyticsDashboard() {
  const { user, initialising: loading } = useFirebaseUser();
  const [data, setData] = useState<TileSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  async function load() {
    setBusy(true);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const res = await fetch(`/api/analytics/summary?range=${range}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
      });
      const body = (await res.json()) as AnalyticsResponse;
      if (!res.ok || !body.ok || !body.tiles) throw new Error(body.error ?? "load failed");
      setData(body.tiles);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "load failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!user && !loading) return;
    if (loading) return;
    void load();
  }, [user, loading, range]);

  if (loading || (busy && !data)) {
    return <div className="order-card opacity-60">Loading analytics…</div>;
  }

  if (!data) {
    return (
      <div className="order-card">
        <div className="section-tag">Analytics</div>
        <h1 className="text-2xl font-title text-white mt-1 mb-6">Full Reports</h1>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 p-3 text-sm">
          {error ?? "Failed to load analytics"}
        </div>
      </div>
    );
  }

  const tiles = [
    { key: "leads", title: "Lead Generation", icon: "👥", color: "bg-violet-500/15 border-violet-500/30" },
    { key: "quotes", title: "Quote Pipeline", icon: "💰", color: "bg-amber-500/15 border-amber-500/30" },
    { key: "bookings", title: "Bookings", icon: "📅", color: "bg-emerald-500/15 border-emerald-500/30" },
    { key: "email", title: "Email Outreach", icon: "📧", color: "bg-sky-500/15 border-sky-500/30" },
    { key: "calls", title: "Voice Outreach", icon: "📞", color: "bg-indigo-500/15 border-indigo-500/30" },
    { key: "whatsapp", title: "WhatsApp", icon: "💬", color: "bg-green-500/15 border-green-500/30" },
    { key: "analytics", title: "Business Overview", icon: "📊", color: "bg-fuchsia-500/15 border-fuchsia-500/30" },
    { key: "ai", title: "AI Activity", icon: "🤖", color: "bg-[var(--gold)]/15 border-[var(--gold)]/30" },
  ];

  return (
    <div className="order-card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <div className="section-tag">Analytics</div>
          <h1 className="text-2xl font-title text-white mt-1">Full Reports</h1>
          <p className="opacity-70 text-sm mt-1">Comprehensive business metrics across all channels.</p>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "90d"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-lg border px-4 py-2 text-sm ${
                range === r
                  ? "bg-[var(--gold)]/20 border-[var(--gold)]/50 text-[var(--gold)]"
                  : "bg-white/10 border-white/20 text-white/80 hover:border-[var(--gold)]/30"
              }`}
            >
              Last {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 p-3 text-sm mb-6">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => {
          const d = data[t.key as keyof TileSummaryData];
          return (
            <div key={t.key} className={`tile ${t.color}`}>
              <div className="tile-icon-wrapper" aria-hidden="true">
                <span className="tile-icon">{t.icon}</span>
              </div>
              <div className="tile-content">
                <h3 className="tile-title">{t.title}</h3>
                <div className="tile-metrics">
                  <div className="metric primary">
                    <span className="metric-value">{d.primaryMetric.value}</span>
                    <span className="metric-label">{d.primaryMetric.label}</span>
                  </div>
                  {d.secondaryMetric && (
                    <div className="metric secondary">
                      <span className="metric-value">{d.secondaryMetric.value}</span>
                      <span className="metric-label">{d.secondaryMetric.label}</span>
                    </div>
                  )}
                  {d.tertiaryMetric && (
                    <div className="metric tertiary">
                      <span className="metric-value">{d.tertiaryMetric.value}</span>
                      <span className="metric-label">{d.tertiaryMetric.label}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <section className="order-card">
          <h3 className="text-lg font-title mb-4">Lead Funnel</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Total Leads (period)</span> <span className="font-mono text-[var(--gold)]">{data.leads.primaryMetric.value}</span></div>
            <div className="flex justify-between"><span>Hot / Qualified</span> <span className="font-mono text-[var(--gold)]">{data.leads.secondaryMetric?.value ?? "—"}</span></div>
            <div className="flex justify-between"><span>New This Week</span> <span className="font-mono text-[var(--gold)]">{data.leads.tertiaryMetric?.value ?? "—"}</span></div>
          </div>
        </section>

        <section className="order-card">
          <h3 className="text-lg font-title mb-4">Pipeline & Conversion</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Pipeline Est. (won quotes)</span> <span className="font-mono text-[var(--gold)]">{data.analytics.secondaryMetric?.value ?? "—"}</span></div>
            <div className="flex justify-between"><span>Conversion Rate</span> <span className="font-mono text-[var(--gold)]">{data.analytics.tertiaryMetric?.value ?? "—"}</span></div>
            <div className="flex justify-between"><span>Leads in Period</span> <span className="font-mono text-[var(--gold)]">{data.analytics.primaryMetric?.value ?? "—"}</span></div>
          </div>
        </section>

        <section className="order-card">
          <h3 className="text-lg font-title mb-4">Quote Pipeline</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Total Quotes</span> <span className="font-mono text-[var(--gold)]">{data.quotes.primaryMetric.value}</span></div>
            <div className="flex justify-between"><span>Sent</span> <span className="font-mono text-[var(--gold)]">{data.quotes.secondaryMetric?.value ?? "—"}</span></div>
            <div className="flex justify-between"><span>Won / Lost</span> <span className="font-mono text-[var(--gold)]">{data.quotes.tertiaryMetric?.value ?? "—"}</span></div>
          </div>
        </section>

        <section className="order-card">
          <h3 className="text-lg font-title mb-4">Email Performance</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Sent</span> <span className="font-mono text-[var(--gold)]">{data.email.primaryMetric.value}</span></div>
            <div className="flex justify-between"><span>Replied</span> <span className="font-mono text-[var(--gold)]">{data.email.secondaryMetric?.value ?? "—"}</span></div>
            <div className="flex justify-between"><span>Open Rate</span> <span className="font-mono text-[var(--gold)]">{data.email.tertiaryMetric?.value ?? "—"}</span></div>
          </div>
        </section>

        <section className="order-card">
          <h3 className="text-lg font-title mb-4">Call Performance</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Total Calls</span> <span className="font-mono text-[var(--gold)]">{data.calls.primaryMetric.value}</span></div>
            <div className="flex justify-between"><span>Answered</span> <span className="font-mono text-[var(--gold)]">{data.calls.secondaryMetric?.value ?? "—"}</span></div>
            <div className="flex justify-between"><span>Interested</span> <span className="font-mono text-[var(--gold)]">{data.calls.tertiaryMetric?.value ?? "—"}</span></div>
          </div>
        </section>

        <section className="order-card">
          <h3 className="text-lg font-title mb-4">WhatsApp Performance</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Sent</span> <span className="font-mono text-[var(--gold)]">{data.whatsapp.primaryMetric.value}</span></div>
            <div className="flex justify-between"><span>Replied</span> <span className="font-mono text-[var(--gold)]">{data.whatsapp.secondaryMetric?.value ?? "—"}</span></div>
            <div className="flex justify-between"><span>Conv. Rate</span> <span className="font-mono text-[var(--gold)]">{data.whatsapp.tertiaryMetric?.value ?? "—"}</span></div>
          </div>
        </section>

        <section className="order-card">
          <h3 className="text-lg font-title mb-4">Bookings</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Upcoming</span> <span className="font-mono text-[var(--gold)]">{data.bookings.primaryMetric.value}</span></div>
            <div className="flex justify-between"><span>Completed</span> <span className="font-mono text-[var(--gold)]">{data.bookings.secondaryMetric?.value ?? "—"}</span></div>
            <div className="flex justify-between"><span>Pending</span> <span className="font-mono text-[var(--gold)]">{data.bookings.tertiaryMetric?.value ?? "—"}</span></div>
          </div>
        </section>

        <section className="order-card">
          <h3 className="text-lg font-title mb-4">AI Activity</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Active Conversations</span> <span className="font-mono text-[var(--gold)]">{data.ai.primaryMetric.value}</span></div>
            <div className="flex justify-between"><span>Follow-ups Queued</span> <span className="font-mono text-[var(--gold)]">{data.ai.secondaryMetric?.value ?? "—"}</span></div>
            <div className="flex justify-between"><span>Hot Leads Found</span> <span className="font-mono text-[var(--gold)]">{data.ai.tertiaryMetric?.value ?? "—"}</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}