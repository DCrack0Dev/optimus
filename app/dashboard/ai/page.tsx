"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";
import type { AIConversation, AIConversationId, AIAction } from "@shared/types";

type ConversationsResponse = {
  ok: boolean;
  items: Array<AIConversation & { id: AIConversationId }>;
  nextCursor?: string | null;
  error?: string;
};

type ActionsResponse = {
  ok: boolean;
  items: Array<AIAction & { id: string }>;
  error?: string;
};

export default function AIActivityDashboard() {
  const { user, initialising: loading } = useFirebaseUser();
  const [conversations, setConversations] = useState<Array<AIConversation & { id: AIConversationId }>>([]);
  const [actions, setActions] = useState<Array<AIAction & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [selectedConvo, setSelectedConvo] = useState<AIConversation & { id: AIConversationId } | null>(null);

  const statuses = useMemo(() => {
    const s = new Set<string>();
    for (const it of conversations) if (it.status) s.add(it.status);
    return Array.from(s).sort();
  }, [conversations]);

  async function load(reset: boolean) {
    setBusy(reset);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const params = new URLSearchParams();
      if (status !== "ALL") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", String(50));
      if (!reset && nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/ai/conversations?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
      });
      const body = (await res.json()) as ConversationsResponse;
      if (!res.ok || !body.ok) throw new Error(body.error ?? "load failed");
      if (reset) setConversations(body.items);
      else setConversations((prev) => [...prev, ...body.items]);
      setNextCursor(body.nextCursor ?? null);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "load failed");
    } finally {
      setBusy(false);
      setLoadingMore(false);
    }
  }

  async function loadActions(conversationId: AIConversationId) {
    try {
      const token = user ? await user.getIdToken(true) : null;
      const res = await fetch(`/api/ai/conversations/${conversationId}/actions`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
      });
      const body = (await res.json()) as ActionsResponse;
      if (!res.ok || !body.ok) throw new Error(body.error ?? "load failed");
      setActions(body.items);
    } catch (e: any) {
      console.error("Failed to load actions:", e);
    }
  }

  useEffect(() => {
    if (!user && !loading) return;
    if (loading) return;
    void load(true);
  }, [user, loading, status, q]);

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    PAUSED: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    HUMAN_HANDOFF: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
    ENDED: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  };

  const chips = useMemo(() => {
    const base = [{ key: "ALL", label: "All", count: conversations.length, cls: "bg-white/10 text-white border-white/20" }];
    for (const s of statuses) {
      const c = conversations.filter((it) => it.status === s).length;
      base.push({ key: s, label: s.replace(/_/g, " "), count: c, cls: STATUS_COLORS[s] ?? "bg-white/10 text-white border-white/20" });
    }
    return base;
  }, [conversations, statuses]);

  if (loading || (busy && conversations.length === 0)) {
    return <div className="order-card opacity-60">Loading AI activity…</div>;
  }

  return (
    <div className="order-card">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <div className="section-tag">AI Activity</div>
          <div className="text-2xl font-title text-white mt-1">Automation & Conversations</div>
          <div className="opacity-70 text-sm mt-1">
            Monitor all AI conversations, tool calls, and automated actions.
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 items-center">
          <input
            type="search"
            placeholder="Search trigger, lead, summary…"
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

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 p-3 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="hidden md:grid grid-cols-[minmax(180px,1.2fr)_100px_100px_100px_100px_100px_120px] gap-3 px-4 py-3 bg-white/5 text-xs uppercase tracking-wider opacity-70 border-b border-white/10">
          <div>Trigger / Lead</div>
          <div>Channel</div>
          <div>Status</div>
          <div>Turns</div>
          <div>Tool Calls</div>
          <div>Tokens</div>
          <div>Updated</div>
        </div>
        {conversations.length === 0 ? (
          <div className="p-10 text-center opacity-60 border-t border-white/5">
            No AI conversations yet. Conversations start when the AI engages with leads.
          </div>
        ) : (
          <ul>
            {conversations.map((it) => (
              <li
                key={it.id}
                className="grid md:grid-cols-[minmax(180px,1.2fr)_100px_100px_100px_100px_100px_120px] gap-3 px-4 py-3 border-b border-white/5 items-center hover:bg-white/[0.03] cursor-pointer"
                onClick={() => { setSelectedConvo(it); loadActions(it.id); }}
              >
                <div>
                  <div className="font-medium truncate">{it.trigger}</div>
                  <div className="text-xs opacity-70 mt-1">Lead: {it.leadId?.slice(0, 10) ?? "—"}…</div>
                </div>
                <div className="text-xs opacity-75">{it.channel}</div>
                <div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${STATUS_COLORS[it.status] ?? "bg-white/10 text-white border-white/20"}`}>
                    {it.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-xs">{it.humanTurns + it.customerTurns}</div>
                <div className="text-xs">{it.toolCalls}</div>
                <div className="text-xs">{it.promptTokens + it.completionTokens}</div>
                <div className="text-xs">{new Date(it.updatedAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-xs opacity-60">{conversations.length} shown</div>
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

      {selectedConvo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedConvo(null)}>
          <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-title">AI Conversation: {selectedConvo.trigger}</h3>
              <button onClick={() => setSelectedConvo(null)} className="text-white/60 hover:text-white text-2xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="opacity-60">ID:</span> <span className="ml-2 font-mono text-xs">{selectedConvo.id}</span></div>
                <div><span className="opacity-60">Channel:</span> <span className="ml-2">{selectedConvo.channel}</span></div>
                <div><span className="opacity-60">Lead:</span> <span className="ml-2">{selectedConvo.leadId ?? "—"}</span></div>
                <div><span className="opacity-60">Status:</span> <span className="ml-2">{selectedConvo.status.replace(/_/g, " ")}</span></div>
                <div><span className="opacity-60">Model:</span> <span className="ml-2">{selectedConvo.model ?? "—"}</span></div>
                <div><span className="opacity-60">Human Turns:</span> <span className="ml-2">{selectedConvo.humanTurns}</span></div>
                <div><span className="opacity-60">Customer Turns:</span> <span className="ml-2">{selectedConvo.customerTurns}</span></div>
                <div><span className="opacity-60">Tool Calls:</span> <span className="ml-2">{selectedConvo.toolCalls}</span></div>
                <div><span className="opacity-60">Total Tokens:</span> <span className="ml-2">{selectedConvo.promptTokens + selectedConvo.completionTokens}</span></div>
                <div><span className="opacity-60">Created:</span> <span className="ml-2">{new Date(selectedConvo.createdAt).toLocaleString()}</span></div>
                <div><span className="opacity-60">Updated:</span> <span className="ml-2">{new Date(selectedConvo.updatedAt).toLocaleString()}</span></div>
                <div><span className="opacity-60">Handoff Requested:</span> <span className="ml-2">{selectedConvo.handoffRequested ? "Yes" : "No"}</span></div>
                <div><span className="opacity-60">Handoff Booking:</span> <span className="ml-2">{selectedConvo.handoffBookingId ?? "—"}</span></div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <h4 className="font-medium mb-3">Messages</h4>
                <div className="space-y-3 max-h-60 overflow-auto">
                  {selectedConvo.messages.map((msg, i) => (
                    <div key={i} className="p-3 bg-black/30 rounded-lg text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded bg-white/10 text-xs font-mono">{msg.role}</span>
                        <span className="px-2 py-0.5 rounded bg-white/10 text-xs">{msg.participant.kind === "AI" ? "🤖 AI" : msg.participant.kind === "HUMAN" ? "👤 Human" : "👤 Customer"}</span>
                        <span className="text-xs opacity-50">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                      </div>
                      {msg.content && <div className="whitespace-pre-wrap">{msg.content}</div>}
                      {msg.toolName && (
                        <div className="mt-2 text-xs opacity-70">
                          <strong>Tool:</strong> {msg.toolName}
                          {msg.toolArgs && <pre className="mt-1 text-xs opacity-60 overflow-auto">{JSON.stringify(msg.toolArgs, null, 2)}</pre>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {actions.length > 0 && (
                <div className="border-t border-white/10 pt-4">
                  <h4 className="font-medium mb-3">Tool Actions</h4>
                  <div className="space-y-2">
                    {actions.map((action, i) => (
                      <div key={i} className="p-3 bg-black/30 rounded-lg text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{action.toolName}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${action.ok ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                            {action.ok ? "Success" : "Failed"}
                          </span>
                          <span className="text-xs opacity-50">{new Date(action.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <pre className="text-xs opacity-70 overflow-auto">{JSON.stringify(action.args, null, 2)}</pre>
                        {!action.ok && action.deniedByMiddlewareCode && (
                          <div className="mt-1 text-red-300 text-xs">Denied: {action.deniedByMiddlewareCode}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedConvo.summary && (
                <div className="border-t border-white/10 pt-4">
                  <h4 className="font-medium mb-2">AI Summary</h4>
                  <p className="text-sm opacity-80">{selectedConvo.summary}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}