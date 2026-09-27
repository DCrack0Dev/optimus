"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";

const NAV_ITEMS = [
  { href: "/dashboard/command", label: "Command", icon: "🏠" },
  { href: "/dashboard/optimus", label: "Optimus", icon: "🤖" },
  { href: "/dashboard/email", label: "Email", icon: "📧" },
  { href: "/dashboard/calls", label: "Calls", icon: "📞" },
  { href: "/dashboard/whatsapp", label: "WhatsApp", icon: "💬" },
  { href: "/dashboard/leads", label: "Leads", icon: "👥" },
  { href: "/dashboard/quotes", label: "Quotes", icon: "💰" },
  { href: "/dashboard/bookings", label: "Bookings", icon: "📅" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📊" },
  { href: "/dashboard/ai", label: "AI Activity", icon: "🤖" },
] as const;

const SETTINGS_ITEMS = [
  { href: "/dashboard/settings/budgets", label: "Budgets & Limits" },
  { href: "/dashboard/settings/suppressions", label: "Suppressions" },
  { href: "/dashboard/settings/availability", label: "Tebogo Availability" },
  { href: "/dashboard/settings/providers", label: "Providers" },
  { href: "/dashboard/settings/audit", label: "Audit Logs" },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { initialising: loading } = useFirebaseUser();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mode, setMode] = useState<"AI" | "HUMAN" | "PAUSED">("AI");
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);

  useEffect(() => {
    async function fetchSystemState() {
      try {
        const res = await fetch("/api/system/summary", {
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ok) {
            setMode(data.mode);
            setEmergencyStop(data.emergencyStop);
          }
        }
      } catch {
        // ignore
      }
    }
    fetchSystemState();
    const interval = setInterval(fetchSystemState, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleModeChange = async (newMode: "AI" | "HUMAN" | "PAUSED") => {
    try {
      const res = await fetch("/api/system/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setMode(newMode);
      }
    } catch {
      // ignore
    }
  };

  const handleEmergencyStop = async () => {
    try {
      const res = await fetch("/api/system/emergency-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Manual emergency stop from dashboard" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.stopped) {
          setEmergencyStop(true);
          setShowStopConfirm(false);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleResume = async () => {
    try {
      const res = await fetch("/api/system/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Resume from dashboard" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.resumed) {
          setEmergencyStop(false);
          setMode("AI");
          setShowResumeConfirm(false);
        }
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="dash-layout">
        <aside className="dash-sidebar" />
        <section className="dash-main">
          <div className="order-card opacity-60">Loading dashboard…</div>
        </section>
      </div>
    );
  }

  const isAdminRoute = pathname.startsWith("/dashboard/command") ||
    pathname.startsWith("/dashboard/email") ||
    pathname.startsWith("/dashboard/calls") ||
    pathname.startsWith("/dashboard/whatsapp") ||
    pathname.startsWith("/dashboard/leads") ||
    pathname.startsWith("/dashboard/quotes") ||
    pathname.startsWith("/dashboard/bookings") ||
    pathname.startsWith("/dashboard/analytics") ||
    pathname.startsWith("/dashboard/ai") ||
    pathname.startsWith("/dashboard/settings");

  if (!isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <div className="dash-layout">
      <aside
        className={`dash-sidebar ${sidebarOpen ? "open" : ""}`}
        role="navigation"
        aria-label="Command Center navigation"
      >
        <div className="sidebar-header">
          <Link href="/dashboard/command" className="sidebar-brand" aria-label="DemiTech Command Center">
            <span className="brand-icon" aria-hidden="true">🤖</span>
            <span className="brand-text">AI Command Center</span>
          </Link>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <ul className="nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`nav-link ${pathname === item.href ? "active" : ""}`}
                  aria-current={pathname === item.href ? "page" : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="nav-divider" />

          <ul className="nav-list settings-list">
            <li className="nav-section-title">Settings</li>
            {SETTINGS_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`nav-link ${pathname === item.href ? "active" : ""}`}
                  aria-current={pathname === item.href ? "page" : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">⚙️</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              </li>
            ))}
            <li>
              <Link href="/dashboard/projects" className="nav-link">
                <span className="nav-icon" aria-hidden="true">👤</span>
                <span className="nav-label">Client Portal</span>
              </Link>
            </li>
            <li>
              <a href="/api/auth/logout" className="nav-link logout-link">
                <span className="nav-icon" aria-hidden="true">🚪</span>
                <span className="nav-label">Logout</span>
              </a>
            </li>
          </ul>

          <div className="sidebar-footer">
            <div className="budget-widget" aria-label="Budget summary">
              <div className="widget-title">Budgets (30d)</div>
              <BudgetWidget />
            </div>
          </div>
        </nav>
      </aside>

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <section className="dash-main">
        <header className="dash-topbar" role="banner">
          <button
            type="button"
            className="hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
            aria-controls="sidebar"
          >
            <span className="hamburger-line" aria-hidden="true" />
            <span className="hamburger-line" aria-hidden="true" />
            <span className="hamburger-line" aria-hidden="true" />
          </button>

          <div className="topbar-center">
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <Link href="/dashboard/command" className="breadcrumb-item">
                Command
              </Link>
              {pathname !== "/dashboard/command" && (
                <>
                  <span className="breadcrumb-sep" aria-hidden="true">/</span>
                  <span className="breadcrumb-item current" aria-current="page">
                    {NAV_ITEMS.find((i) => pathname.startsWith(i.href))?.label ?? "Dashboard"}
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="topbar-right">
            <ModeToggle
              mode={mode}
              onChange={handleModeChange}
              disabled={emergencyStop}
            />
            <EmergencyStopButton
              active={emergencyStop}
              onClickStop={() => setShowStopConfirm(true)}
              onClickResume={() => setShowResumeConfirm(true)}
            />
          </div>
        </header>

        {emergencyStop && (
          <div className="emergency-banner" role="alert" aria-live="assertive">
            <div className="banner-content">
              <span className="banner-icon" aria-hidden="true">🛑</span>
              <span className="banner-text">EMERGENCY STOP ACTIVE — All outbound communications halted</span>
              <button
                type="button"
                className="btn btn-gold btn-sm"
                onClick={() => setShowResumeConfirm(true)}
              >
                Resume
              </button>
            </div>
          </div>
        )}

        <main className="dash-content">{children}</main>
      </section>

      {showStopConfirm && (
        <ConfirmDialog
          title="Activate Emergency Stop?"
          message="This will immediately halt ALL outbound communications (Email, WhatsApp, Calls, AI). Pending follow-ups will be cancelled. Budgets will be frozen. Are you sure?"
          onConfirm={handleEmergencyStop}
          onCancel={() => setShowStopConfirm(false)}
          confirmText="Yes, Stop Everything"
          confirmClass="btn-gold"
          danger
        />
      )}

      {showResumeConfirm && (
        <ConfirmDialog
          title="Resume Operations?"
          message="This will re-enable outbound communications and restore the previous mode. You will need to confirm this action."
          onConfirm={handleResume}
          onCancel={() => setShowResumeConfirm(false)}
          confirmText="Yes, Resume"
          confirmClass="btn-gold"
        />
      )}
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: "AI" | "HUMAN" | "PAUSED";
  onChange: (m: "AI" | "HUMAN" | "PAUSED") => void;
  disabled: boolean;
}) {
  const options: Array<{ value: "AI" | "HUMAN" | "PAUSED"; label: string; icon: string }> = [
    { value: "AI", label: "AI", icon: "🤖" },
    { value: "HUMAN", label: "Human", icon: "👤" },
    { value: "PAUSED", label: "Paused", icon: "⏸️" },
  ];

  return (
    <div className="mode-toggle" role="group" aria-label="System mode">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`mode-btn ${mode === opt.value ? "active" : ""} ${disabled ? "disabled" : ""}`}
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
          aria-pressed={mode === opt.value}
          title={opt.label}
        >
          <span className="mode-icon" aria-hidden="true">{opt.icon}</span>
          <span className="mode-label">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

function EmergencyStopButton({
  active,
  onClickStop,
  onClickResume,
}: {
  active: boolean;
  onClickStop: () => void;
  onClickResume: () => void;
}) {
  return (
    <button
      type="button"
      className={`emergency-btn ${active ? "active" : ""}`}
      onClick={active ? onClickResume : onClickStop}
      aria-pressed={active}
      aria-label={active ? "Resume operations (requires confirmation)" : "Emergency stop (requires confirmation)"}
    >
      <span className="emergency-icon" aria-hidden="true">🛑</span>
      <span className="emergency-label">{active ? "RESUME" : "STOP"}</span>
    </button>
  );
}

function BudgetWidget() {
  const [budgets, setBudgets] = useState<Record<string, { used: number; limit: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBudgets() {
      try {
        const res = await fetch("/api/system/summary");
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.budgets) {
            const b: Record<string, { used: number; limit: number }> = {};
            for (const [channel, budget] of Object.entries(data.budgets)) {
              const bud = budget as { usedDollars?: number; limitDollars?: number } | undefined;
              if (bud) {
                b[channel] = { used: bud.usedDollars ?? 0, limit: bud.limitDollars ?? 0 };
              }
            }
            setBudgets(b);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchBudgets();
  }, []);

  if (loading || Object.keys(budgets).length === 0) {
    return <div className="widget-loading">Loading budgets…</div>;
  }

  const channels = ["AI", "EMAIL", "VOICE", "WHATSAPP", "TOTAL_OUTREACH"] as const;

  return (
    <div className="widget-bars">
      {channels.map((ch) => {
        const b = budgets[ch];
        if (!b || b.limit === 0) return null;
        const pct = Math.min(100, Math.round((b.used / b.limit) * 100));
        return (
          <div key={ch} className="budget-bar">
            <div className="budget-bar-header">
              <span className="budget-channel">{ch}</span>
              <span className="budget-values">${b.used.toFixed(2)} / ${b.limit.toFixed(2)}</span>
            </div>
            <div className="budget-bar-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${ch} budget ${pct}% used`}>
              <div
                className="budget-bar-fill"
                style={{ width: `${pct}%`, backgroundColor: pct >= 90 ? "#ef4444" : pct >= 70 ? "#D4A017" : "#3b82f6" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  confirmClass = "btn-gold",
  danger = false,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  confirmClass?: string;
  danger?: boolean;
}) {
  return (
    <div className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 id="modal-title" className="modal-title">{title}</h2>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${confirmClass} ${danger ? "btn-danger" : ""}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}