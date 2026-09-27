"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TileData = {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
  primaryMetric: { label: string; value: string | number };
  secondaryMetric?: { label: string; value: string | number };
  tertiaryMetric?: { label: string; value: string | number };
  href: string;
  color: string;
};

type SummaryResponse = {
  ok: boolean;
  tiles?: Record<string, any>;
  error?: string;
};

const TILE_CONFIG: TileData[] = [
  {
    key: "email",
    icon: "📧",
    title: "Email",
    subtitle: "Outreach & replies",
    primaryMetric: { label: "Sent (30d)", value: "—" },
    secondaryMetric: { label: "Replied", value: "—" },
    tertiaryMetric: { label: "Open rate", value: "—" },
    href: "/dashboard/email",
    color: "bg-sky-500/15 border-sky-500/30",
  },
  {
    key: "calls",
    icon: "📞",
    title: "Calls",
    subtitle: "Voice outreach",
    primaryMetric: { label: "Total (30d)", value: "—" },
    secondaryMetric: { label: "Answered", value: "—" },
    tertiaryMetric: { label: "Interested", value: "—" },
    href: "/dashboard/calls",
    color: "bg-indigo-500/15 border-indigo-500/30",
  },
  {
    key: "whatsapp",
    icon: "💬",
    title: "WhatsApp",
    subtitle: "Messaging",
    primaryMetric: { label: "Sent (30d)", value: "—" },
    secondaryMetric: { label: "Replied", value: "—" },
    tertiaryMetric: { label: "Conv. rate", value: "—" },
    href: "/dashboard/whatsapp",
    color: "bg-green-500/15 border-green-500/30",
  },
  {
    key: "leads",
    icon: "👥",
    title: "Leads",
    subtitle: "Pipeline",
    primaryMetric: { label: "Total", value: "—" },
    secondaryMetric: { label: "Hot", value: "—" },
    tertiaryMetric: { label: "New this week", value: "—" },
    href: "/dashboard/leads",
    color: "bg-violet-500/15 border-violet-500/30",
  },
  {
    key: "quotes",
    icon: "💰",
    title: "Quotes",
    subtitle: "Deals",
    primaryMetric: { label: "Total", value: "—" },
    secondaryMetric: { label: "Sent", value: "—" },
    tertiaryMetric: { label: "Won / Lost", value: "—" },
    href: "/dashboard/quotes",
    color: "bg-amber-500/15 border-amber-500/30",
  },
  {
    key: "bookings",
    icon: "📅",
    title: "Bookings",
    subtitle: "Appointments",
    primaryMetric: { label: "Upcoming", value: "—" },
    secondaryMetric: { label: "Completed", value: "—" },
    tertiaryMetric: { label: "Pending", value: "—" },
    href: "/dashboard/bookings",
    color: "bg-emerald-500/15 border-emerald-500/30",
  },
  {
    key: "analytics",
    icon: "📊",
    title: "Analytics",
    subtitle: "Full reports",
    primaryMetric: { label: "Leads (30d)", value: "—" },
    secondaryMetric: { label: "Pipeline Est.", value: "—" },
    tertiaryMetric: { label: "Conversion", value: "—" },
    href: "/dashboard/analytics",
    color: "bg-fuchsia-500/15 border-fuchsia-500/30",
  },
  {
    key: "ai",
    icon: "🤖",
    title: "AI Activity",
    subtitle: "Automation",
    primaryMetric: { label: "Active convos", value: "—" },
    secondaryMetric: { label: "Follow-ups queued", value: "—" },
    tertiaryMetric: { label: "Hot leads found", value: "—" },
    href: "/dashboard/ai",
    color: "bg-[var(--gold)]/15 border-[var(--gold)]/30",
  },
];

export default function CommandCenterPage() {
  const [tiles, setTiles] = useState<TileData[]>(TILE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch("/api/analytics/summary?range=30d");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = (await res.json()) as SummaryResponse;
        if (!data.ok || !data.tiles) throw new Error(data.error ?? "Invalid response");

        setTiles((prev) =>
          prev.map((t) => {
            const d = data.tiles?.[t.key];
            if (!d) return t;
            return {
              ...t,
              primaryMetric: { ...t.primaryMetric, value: d.primaryMetric?.value ?? t.primaryMetric.value },
              secondaryMetric: { ...t.secondaryMetric!, value: d.secondaryMetric?.value ?? t.secondaryMetric?.value },
              tertiaryMetric: { ...t.tertiaryMetric!, value: d.tertiaryMetric?.value ?? t.tertiaryMetric?.value },
            };
          })
        );
      } catch (e: any) {
        setError(e?.message ?? "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="command-center">
        <div className="command-header">
          <div>
            <span className="section-tag">Overview</span>
            <h1 className="page-title">AI Command Center</h1>
            <p className="page-desc">Single control center for all outreach, leads, and automation</p>
          </div>
        </div>
        <div className="tile-grid" role="list" aria-label="Command center tiles">
          {TILE_CONFIG.map((t) => (
            <TileSkeleton key={t.key} config={t} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="command-center">
        <div className="command-header">
          <div>
            <span className="section-tag">Overview</span>
            <h1 className="page-title">AI Command Center</h1>
            <p className="page-desc">Single control center for all outreach, leads, and automation</p>
          </div>
        </div>
        <div className="tile-grid" role="list" aria-label="Command center tiles">
          {TILE_CONFIG.map((t) => (
            <TileSkeleton key={t.key} config={t} />
          ))}
        </div>
        <div className="error-banner" role="alert">
          ⚠️ {error} — Showing empty states. Data will appear once events are recorded.
        </div>
      </div>
    );
  }

  return (
    <div className="command-center">
      <div className="command-header">
        <div>
          <span className="section-tag">Overview</span>
          <h1 className="page-title">AI Command Center</h1>
          <p className="page-desc">Single control center for all outreach, leads, and automation</p>
        </div>
        <div className="header-actions">
          <Link href="/dashboard/leads" className="btn btn-gold">
            ➕ New Lead
          </Link>
          <Link href="/dashboard/bookings" className="btn btn-outline">
            📅 New Booking
          </Link>
        </div>
      </div>
      <div className="tile-grid" role="list" aria-label="Command center tiles">
        {tiles.map((t) => (
          <Tile key={t.key} config={t} />
        ))}
      </div>
    </div>
  );
}

function Tile({ config }: { config: TileData }) {
  return (
    <Link href={config.href} className="tile" role="listitem">
      <div className={`tile-icon-wrapper ${config.color}`} aria-hidden="true">
        <span className="tile-icon">{config.icon}</span>
      </div>
      <div className="tile-content">
        <div className="tile-header">
          <h3 className="tile-title">{config.title}</h3>
          <span className="tile-subtitle">{config.subtitle}</span>
        </div>
        <div className="tile-metrics">
          <div className="metric primary">
            <span className="metric-value">{config.primaryMetric.value}</span>
            <span className="metric-label">{config.primaryMetric.label}</span>
          </div>
          {config.secondaryMetric && (
            <div className="metric secondary">
              <span className="metric-value">{config.secondaryMetric.value}</span>
              <span className="metric-label">{config.secondaryMetric.label}</span>
            </div>
          )}
          {config.tertiaryMetric && (
            <div className="metric tertiary">
              <span className="metric-value">{config.tertiaryMetric.value}</span>
              <span className="metric-label">{config.tertiaryMetric.label}</span>
            </div>
          )}
        </div>
      </div>
      <span className="tile-arrow" aria-hidden="true">→</span>
    </Link>
  );
}

function TileSkeleton({ config }: { config: TileData }) {
  return (
    <div className="tile skeleton" role="listitem" aria-busy="true">
      <div className={`tile-icon-wrapper ${config.color}`} aria-hidden="true">
        <span className="tile-icon">{config.icon}</span>
      </div>
      <div className="tile-content">
        <div className="tile-header">
          <div className="skeleton-text title" />
          <div className="skeleton-text subtitle" />
        </div>
        <div className="tile-metrics">
          <div className="metric primary">
            <div className="skeleton-metric" />
            <div className="skeleton-text small" />
          </div>
          <div className="metric secondary">
            <div className="skeleton-metric" />
            <div className="skeleton-text small" />
          </div>
          <div className="metric tertiary">
            <div className="skeleton-metric" />
            <div className="skeleton-text small" />
          </div>
        </div>
      </div>
      <span className="tile-arrow" aria-hidden="true">→</span>
    </div>
  );
}