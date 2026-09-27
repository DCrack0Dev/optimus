"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";
import type { Booking, BookingId, BookingStatus, BookingType } from "@shared/types";

type ListResponse = {
  ok: boolean;
  items: Array<Booking & { id: BookingId }>;
  nextCursor?: string | null;
  error?: string;
};

export default function BookingsDashboard() {
  const { user, initialising: loading } = useFirebaseUser();
  const [items, setItems] = useState<Array<Booking & { id: BookingId }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [type, setType] = useState<string>("ALL");
  const [sort, setSort] = useState<"createdAt" | "startAt">("startAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedBooking, setSelectedBooking] = useState<Booking & { id: BookingId } | null>(null);

  const statuses = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.status) s.add(it.status);
    return Array.from(s).sort();
  }, [items]);

  const types = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.type) s.add(it.type);
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
      if (type !== "ALL") params.set("type", type);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", String(50));
      if (!reset && nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/bookings?${params.toString()}`, {
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
  }, [user, loading, status, type, sort, sortDir, q]);

  const STATUS_COLORS: Record<BookingStatus, string> = {
    PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    CONFIRMED: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    CANCELLED_BY_CUSTOMER: "bg-red-500/15 text-red-300 border-red-500/30",
    CANCELLED_BY_STAFF: "bg-red-500/15 text-red-300 border-red-500/30",
    NO_SHOW: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    COMPLETED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  };

  const TYPE_COLORS: Record<BookingType, string> = {
    CALLBACK: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    VIDEO: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    IN_PERSON: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  };

  const chips = useMemo(() => {
    const base = [{ key: "ALL", label: "All", count: items.length, cls: "bg-white/10 text-white border-white/20" }];
    for (const s of statuses) {
      const c = items.filter((it) => it.status === s).length;
      base.push({ key: s, label: s.replace(/_/g, " "), count: c, cls: STATUS_COLORS[s as BookingStatus] ?? "bg-white/10 text-white border-white/20" });
    }
    return base;
  }, [items, statuses]);

  if (loading || (busy && items.length === 0)) {
    return <div className="order-card opacity-60">Loading bookings…</div>;
  }

  return (
    <div className="order-card">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <div className="section-tag">Bookings</div>
          <div className="text-2xl font-title text-white mt-1">Appointments</div>
          <div className="opacity-70 text-sm mt-1">
            Manage callbacks, video meetings, and in-person appointments.
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 items-center">
          <input
            type="search"
            placeholder="Search title, lead, attendee…"
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
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="ALL">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
          >
            <option value="startAt">Start Time</option>
            <option value="createdAt">Created</option>
          </select>
          <button
            type="button"
            className="btn-outline !py-2 !px-3 text-xs"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          >
            {sortDir === "asc" ? "Upcoming first" : "Past first"}
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
        <div className="hidden md:grid grid-cols-[minmax(200px,1.3fr)_100px_100px_120px_120px_100px_100px] gap-3 px-4 py-3 bg-white/5 text-xs uppercase tracking-wider opacity-70 border-b border-white/10">
          <div>Title / Lead</div>
          <div>Type</div>
          <div>Status</div>
          <div>Start</div>
          <div>Duration</div>
          <div>Attendees</div>
          <div>Source</div>
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center opacity-60 border-t border-white/5">
            No bookings yet. Bookings are created via the website, AI, or manually.
          </div>
        ) : (
          <ul>
            {items.map((it) => (
              <li
                key={it.id}
                className="grid md:grid-cols-[minmax(200px,1.3fr)_100px_100px_120px_120px_100px_100px] gap-3 px-4 py-3 border-b border-white/5 items-center hover:bg-white/[0.03] cursor-pointer"
                onClick={() => setSelectedBooking(it)}
              >
                <div>
                  <div className="font-medium truncate">{it.title}</div>
                  <div className="text-xs opacity-70 mt-1">Lead: {it.leadId?.slice(0, 10) ?? "—"}…</div>
                </div>
                <div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${TYPE_COLORS[it.type]}`}>
                    {it.type}
                  </span>
                </div>
                <div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${STATUS_COLORS[it.status]}`}>
                    {it.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-sm">{new Date(it.startAt).toLocaleString()}</div>
                <div className="text-xs">{it.durationMinutes} min</div>
                <div className="text-xs">
                  {it.attendees.map((a) => a.name).join(", ")}
                </div>
                <div className="text-xs opacity-60">{it.source}</div>
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

      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedBooking(null)}>
          <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-title">{selectedBooking.title}</h3>
              <button onClick={() => setSelectedBooking(null)} className="text-white/60 hover:text-white text-2xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="opacity-60">Type:</span> <span className="ml-2">{selectedBooking.type}</span></div>
                <div><span className="opacity-60">Status:</span> <span className="ml-2">{selectedBooking.status.replace(/_/g, " ")}</span></div>
                <div><span className="opacity-60">Start:</span> <span className="ml-2">{new Date(selectedBooking.startAt).toLocaleString()}</span></div>
                <div><span className="opacity-60">Duration:</span> <span className="ml-2">{selectedBooking.durationMinutes} min</span></div>
                <div><span className="opacity-60">Timezone:</span> <span className="ml-2">{selectedBooking.timezoneIana ?? "—"}</span></div>
                <div><span className="opacity-60">Source:</span> <span className="ml-2">{selectedBooking.source}</span></div>
                <div><span className="opacity-60">Created By:</span> <span className="ml-2">{selectedBooking.createdBy ?? "—"}</span></div>
                <div><span className="opacity-60">Lead:</span> <span className="ml-2">{selectedBooking.leadId ?? "—"}</span></div>
                <div><span className="opacity-60">Video URL:</span> <span className="ml-2 text-xs truncate max-w-[150px]">{selectedBooking.videoMeetingUrl ?? "—"}</span></div>
                <div><span className="opacity-60">Phone:</span> <span className="ml-2">{selectedBooking.phoneCallNumber ?? "—"}</span></div>
                <div><span className="opacity-60">Location:</span> <span className="ml-2">{selectedBooking.location ?? "—"}</span></div>
              </div>
              <div className="border-t border-white/10 pt-4">
                <h4 className="font-medium mb-2">Attendees</h4>
                <div className="space-y-2">
                  {selectedBooking.attendees.map((a, i) => (
                    <div key={i} className="flex gap-3 text-sm p-2 bg-black/30 rounded-lg">
                      <span className="font-medium">{a.name}</span>
                      <span className="opacity-70">{a.kind}</span>
                      {a.email && <span className="opacity-60">{a.email}</span>}
                      {a.phoneE164 && <span className="opacity-60">{a.phoneE164}</span>}
                    </div>
                  ))}
                </div>
              </div>
              {selectedBooking.notes && (
                <div className="border-t border-white/10 pt-4">
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm opacity-80">{selectedBooking.notes}</p>
                </div>
              )}
              {selectedBooking.cancelledReason && (
                <div className="border-t border-white/10 pt-4 text-red-300">
                  <h4 className="font-medium mb-2">Cancellation Reason</h4>
                  <p className="text-sm">{selectedBooking.cancelledReason}</p>
                </div>
              )}
              {selectedBooking.completedNotes && (
                <div className="border-t border-white/10 pt-4 text-emerald-300">
                  <h4 className="font-medium mb-2">Completion Notes</h4>
                  <p className="text-sm">{selectedBooking.completedNotes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}