import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedSummary: {
  data: TileSummaryData;
  expiresAt: number;
} | null = null;

export type TileSummaryData = {
  email: TileMetrics;
  calls: TileMetrics;
  whatsapp: TileMetrics;
  leads: TileMetrics;
  quotes: TileMetrics;
  bookings: TileMetrics;
  analytics: TileMetrics;
  ai: TileMetrics;
};

export type TileMetrics = {
  primaryMetric: { label: string; value: string | number };
  secondaryMetric?: { label: string; value: string | number };
  tertiaryMetric?: { label: string; value: string | number };
};

function now(): number {
  return Date.now();
}

function rangeStart(days: number): number {
  return now() - days * 24 * 60 * 60 * 1000;
}

async function countEmails(since: number): Promise<{ sent: number; replied: number; opened: number; delivered: number }> {
  if (!isAdminConfigured()) return { sent: 0, replied: 0, opened: 0, delivered: 0 };
  const db = getAdminDb();
  const snap = await db
    .collection("emails")
    .where("createdAt", ">=", since)
    .get();
  let sent = 0, replied = 0, opened = 0, delivered = 0;
  for (const d of snap.docs) {
    const r = d.data() as any;
    if (r.status === "SENT" || r.status === "DELIVERED" || r.status === "OPENED" || r.status === "CLICKED" || r.status === "REPLIED") sent++;
    if (r.status === "REPLIED") replied++;
    if (r.status === "OPENED") opened++;
    if (r.status === "DELIVERED") delivered++;
    for (const ev of r.events ?? []) {
      if (ev.status === "REPLIED") replied++;
      if (ev.status === "OPENED") opened++;
      if (ev.status === "DELIVERED") delivered++;
    }
  }
  return { sent, replied, opened, delivered };
}

async function countCalls(since: number): Promise<{ total: number; answered: number; interested: number }> {
  if (!isAdminConfigured()) return { total: 0, answered: 0, interested: 0 };
  const db = getAdminDb();
  const snap = await db
    .collection("calls")
    .where("createdAt", ">=", since)
    .get();
  let total = 0, answered = 0, interested = 0;
  for (const d of snap.docs) {
    total++;
    const r = d.data() as any;
    if (r.outcome === "ANSWERED") answered++;
    if (r.interested === true) interested++;
  }
  return { total, answered, interested };
}

async function countWhatsApp(since: number): Promise<{ sent: number; received: number; replied: number }> {
  if (!isAdminConfigured()) return { sent: 0, received: 0, replied: 0 };
  const db = getAdminDb();
  const snap = await db
    .collection("whatsapp")
    .where("createdAt", ">=", since)
    .get();
  let sent = 0, received = 0, replied = 0;
  for (const d of snap.docs) {
    const r = d.data() as any;
    if (r.direction === "OUTBOUND") sent++;
    else received++;
    if (r.direction === "INBOUND") replied++;
  }
  return { sent, received, replied };
}

async function countLeads(): Promise<{ total: number; hot: number; newThisWeek: number }> {
  if (!isAdminConfigured()) return { total: 0, hot: 0, newThisWeek: 0 };
  const db = getAdminDb();
  const weekAgo = now() - 7 * 24 * 60 * 60 * 1000;

  const [totalSnap, hotSnap, newSnap] = await Promise.all([
    db.collection("leads").get(),
    db.collection("leads").where("status", "in", ["HOT", "QUALIFIED"]).get(),
    db.collection("leads").where("createdAt", ">=", weekAgo).get(),
  ]);

  return {
    total: totalSnap.size,
    hot: hotSnap.size,
    newThisWeek: newSnap.size,
  };
}

async function countQuotes(since: number): Promise<{ total: number; sent: number; won: number; lost: number }> {
  if (!isAdminConfigured()) return { total: 0, sent: 0, won: 0, lost: 0 };
  const db = getAdminDb();
  const snap = await db
    .collection("quotes")
    .where("createdAt", ">=", since)
    .get();
  let total = 0, sent = 0, won = 0, lost = 0;
  for (const d of snap.docs) {
    total++;
    const r = d.data() as any;
    if (r.status === "SENT" || r.status === "VIEWED" || r.status === "ACCEPTED" || r.status === "NEGOTIATING" || r.status === "WON") sent++;
    if (r.status === "WON") won++;
    if (r.status === "LOST") lost++;
  }
  return { total, sent, won, lost };
}

async function countBookings(): Promise<{ upcoming: number; completed: number; pending: number }> {
  if (!isAdminConfigured()) return { upcoming: 0, completed: 0, pending: 0 };
  const db = getAdminDb();
  const ts = now();
  const [upcomingSnap, completedSnap, pendingSnap] = await Promise.all([
    db.collection("bookings").where("status", "in", ["PENDING", "CONFIRMED"]).where("startAt", ">=", ts).get(),
    db.collection("bookings").where("status", "==", "COMPLETED").get(),
    db.collection("bookings").where("status", "==", "PENDING").get(),
  ]);
  return {
    upcoming: upcomingSnap.size,
    completed: completedSnap.size,
    pending: pendingSnap.size,
  };
}

async function countAnalytics(since: number): Promise<{ leads30d: number; pipelineEstimate: number; conversion: number }> {
  if (!isAdminConfigured()) return { leads30d: 0, pipelineEstimate: 0, conversion: 0 };
  const db = getAdminDb();
  const [leadsSnap, quotesSnap] = await Promise.all([
    db.collection("leads").where("createdAt", ">=", since).get(),
    db.collection("quotes").where("status", "==", "WON").get(),
  ]);

  let pipelineEstimate = 0;
  for (const d of quotesSnap.docs) {
    const r = d.data() as any;
    if (r.rangeHighCents) pipelineEstimate += r.rangeHighCents;
  }

  const leads30d = leadsSnap.size;
  const wonQuotes = quotesSnap.size;
  const conversion = leads30d > 0 ? (wonQuotes / leads30d) * 100 : 0;

  return { leads30d, pipelineEstimate: pipelineEstimate / 100, conversion };
}

async function countAI(): Promise<{ activeConvos: number; followupsQueued: number; hotLeadsFound: number }> {
  if (!isAdminConfigured()) return { activeConvos: 0, followupsQueued: 0, hotLeadsFound: 0 };
  const db = getAdminDb();
  const [convosSnap, followupsSnap, hotLeadsSnap] = await Promise.all([
    db.collection("ai_conversations").where("status", "in", ["ACTIVE", "PAUSED", "HUMAN_HANDOFF"]).get(),
    db.collection("followups").where("status", "in", ["PENDING", "SCHEDULED"]).get(),
    db.collection("leads").where("status", "==", "HOT").get(),
  ]);
  return {
    activeConvos: convosSnap.size,
    followupsQueued: followupsSnap.size,
    hotLeadsFound: hotLeadsSnap.size,
  };
}

export async function getTileSummary(rangeDays = 30): Promise<TileSummaryData> {
  if (cachedSummary && cachedSummary.expiresAt > now()) {
    return cachedSummary.data;
  }

  const since = rangeStart(rangeDays);

  const [
    emailCounts,
    callCounts,
    waCounts,
    leadCounts,
    quoteCounts,
    bookingCounts,
    analyticsCounts,
    aiCounts,
  ] = await Promise.all([
    countEmails(since),
    countCalls(since),
    countWhatsApp(since),
    countLeads(),
    countQuotes(since),
    countBookings(),
    countAnalytics(since),
    countAI(),
  ]);

  const data: TileSummaryData = {
    email: {
      primaryMetric: { label: "Sent (30d)", value: emailCounts.sent },
      secondaryMetric: { label: "Replied", value: emailCounts.replied },
      tertiaryMetric: { label: "Open rate", value: emailCounts.sent > 0 ? `${((emailCounts.opened / emailCounts.sent) * 100).toFixed(1)}%` : "0%" },
    },
    calls: {
      primaryMetric: { label: "Total (30d)", value: callCounts.total },
      secondaryMetric: { label: "Answered", value: callCounts.answered },
      tertiaryMetric: { label: "Interested", value: callCounts.interested },
    },
    whatsapp: {
      primaryMetric: { label: "Sent (30d)", value: waCounts.sent },
      secondaryMetric: { label: "Replied", value: waCounts.replied },
      tertiaryMetric: { label: "Conv. rate", value: waCounts.sent > 0 ? `${((waCounts.replied / waCounts.sent) * 100).toFixed(1)}%` : "0%" },
    },
    leads: {
      primaryMetric: { label: "Total", value: leadCounts.total },
      secondaryMetric: { label: "Hot", value: leadCounts.hot },
      tertiaryMetric: { label: "New this week", value: leadCounts.newThisWeek },
    },
    quotes: {
      primaryMetric: { label: "Total", value: quoteCounts.total },
      secondaryMetric: { label: "Sent", value: quoteCounts.sent },
      tertiaryMetric: { label: "Won / Lost", value: `${quoteCounts.won} / ${quoteCounts.lost}` },
    },
    bookings: {
      primaryMetric: { label: "Upcoming", value: bookingCounts.upcoming },
      secondaryMetric: { label: "Completed", value: bookingCounts.completed },
      tertiaryMetric: { label: "Pending", value: bookingCounts.pending },
    },
    analytics: {
      primaryMetric: { label: "Leads (30d)", value: analyticsCounts.leads30d },
      secondaryMetric: { label: "Pipeline Est.", value: `R${analyticsCounts.pipelineEstimate.toLocaleString()}` },
      tertiaryMetric: { label: "Conversion", value: `${analyticsCounts.conversion.toFixed(1)}%` },
    },
    ai: {
      primaryMetric: { label: "Active convos", value: aiCounts.activeConvos },
      secondaryMetric: { label: "Follow-ups queued", value: aiCounts.followupsQueued },
      tertiaryMetric: { label: "Hot leads found", value: aiCounts.hotLeadsFound },
    },
  };

  cachedSummary = { data, expiresAt: now() + CACHE_TTL_MS };
  return data;
}

export function invalidateSummaryCache(): void {
  cachedSummary = null;
}