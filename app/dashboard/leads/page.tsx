import { Suspense } from "react";
import LeadsListClient from "./leads-list-client";

export default function LeadsListPage() {
  return (
    <main className="dash-layout">
      <aside className="dash-sidebar">
        <div className="section-tag">Command</div>
        <div className="font-title text-2xl mb-2">AI Command Center</div>
        <ul className="text-sm opacity-80 space-y-2 mt-6">
          <li>
            <a className="hover:text-[var(--gold)]" href="/dashboard/command">
              ↩ Back to command
            </a>
          </li>
          <li>
            <a className="hover:text-[var(--gold)]" href="/dashboard/projects">
              Client projects
            </a>
          </li>
        </ul>
        <div className="mt-10 opacity-60 text-xs">
          DemiTech Web Services — Internal Admin
        </div>
      </aside>
      <section className="dash-main">
        <Suspense fallback={<div className="opacity-60 order-card">Loading leads…</div>}>
          <LeadsListClient />
        </Suspense>
      </section>
    </main>
  );
}
