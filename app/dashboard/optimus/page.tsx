"use client";

import { useEffect, useRef, useState } from "react";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: Array<{ tool: string; args: any; result: any; ok: boolean }>;
};

export default function OptimusDashboard() {
  const { user, initialising: loading } = useFirebaseUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || busy) return;
    const userMsg: Message = { id: `msg_${Date.now()}`, role: "user", content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);
    setInput("");

    try {
      const token = user ? await user.getIdToken(true) : null;
      const res = await fetch("/api/optimus/run", {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversationId, message: text, voiceMode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed");
      setConversationId(data.conversationId);
      const assistantMsg: Message = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data.reply,
        timestamp: Date.now(),
        toolCalls: data.toolCalls,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (voiceMode && data.reply) {
        await speakText(data.reply);
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { id: `msg_${Date.now()}`, role: "assistant", content: `Error: ${e.message}`, timestamp: Date.now() }]);
    } finally {
      setBusy(false);
    }
  }

  async function speakText(text: string) {
    setSpeaking(true);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        await audio.play();
      }
    } catch (e) {
      console.error("TTS error:", e);
    } finally {
      setSpeaking(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  async function startListening() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        await sendAudio(blob);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setListening(true);
    } catch (e) {
      console.error("Microphone error:", e);
      alert("Microphone access denied");
    }
  }

  function stopListening() {
    mediaRecorder?.stop();
    mediaRecorder?.stream.getTracks().forEach((t) => t.stop());
    setListening(false);
  }

  async function sendAudio(blob: Blob) {
    setBusy(true);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("conversationId", conversationId ?? "");
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "STT failed");
      if (data.text) {
        sendMessage(data.text);
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { id: `msg_${Date.now()}`, role: "assistant", content: `Voice error: ${e.message}`, timestamp: Date.now() }]);
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  if (loading) {
    return <div className="order-card opacity-60">Loading Optimus…</div>;
  }

  return (
    <div className="order-card flex flex-col h-[calc(100vh-200px)] min-h-[600px]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="section-tag">Optimus</div>
          <h1 className="text-2xl font-title text-white mt-1">AI Operating System</h1>
          <p className="opacity-70 text-sm mt-1">Internal business operator for planning, execution, and intelligence.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn ${voiceMode ? "btn-gold" : "btn-outline"}`}
            onClick={() => setVoiceMode(!voiceMode)}
          >
            🎙️ Voice
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => { setMessages([]); setConversationId(null); }}
          >
            🔄 New Chat
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4" style={{ minHeight: 300 }}>
        {messages.length === 0 ? (
          <div className="text-center opacity-50 py-10">
            <div className="text-4xl mb-3">🤖</div>
            <div className="text-lg font-title">Optimus Ready</div>
            <div className="text-sm opacity-70 mt-2 max-w-md mx-auto">
              Ask me to research prospects, plan your quarter, schedule your week, create tasks, check business metrics, or brainstorm strategies.
            </div>
            <div className="mt-4 space-y-1 text-xs opacity-60 text-left max-w-md mx-auto">
              <div>• "Find 50 restaurants in Durban that need websites"</div>
              <div>• "Build me a 3-month growth plan for DemiTech"</div>
              <div>• "Schedule my week: Mon-Fri 8-5, study 2hrs evening"</div>
              <div>• "What should I focus on today?"</div>
              <div>• "Create a recurring Monday morning briefing"</div>
              <div>• "Remind me in 3 months to review ChainLegacy"</div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl p-4 ${
                  msg.role === "user"
                    ? "bg-[var(--gold)]/20 border border-[var(--gold)]/30 text-white"
                    : "bg-black/30 border border-white/10"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <details className="mt-2 text-xs opacity-70">
                    <summary>🔧 Tool calls ({msg.toolCalls.length})</summary>
                    <pre className="mt-1 p-2 bg-black/40 rounded overflow-auto">
                      {JSON.stringify(msg.toolCalls, null, 2)}
                    </pre>
                  </details>
                )}
                <div className="text-xs opacity-50 mt-1 text-right">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {(busy || listening || speaking) && (
        <div className="px-4 py-2 text-center text-sm opacity-70">
          {listening && "🎙️ Listening… (click to stop)"}
          {speaking && "🔊 Speaking…"}
          {busy && !listening && !speaking && "🤔 Thinking…"}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={voiceMode ? "Type or use voice…" : "Message Optimus…"}
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 resize-none"
            style={{ minHeight: 52, maxHeight: 150 }}
            disabled={busy || listening}
            rows={1}
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={`btn ${listening ? "btn-gold" : "btn-outline"} !py-2`}
              onClick={listening ? stopListening : startListening}
              disabled={busy || speaking}
              title={listening ? "Stop listening" : "Start voice input"}
            >
              {listening ? "⏹️ Stop" : "🎤"}
            </button>
            <button
              type="submit"
              className="btn btn-gold !py-2"
              disabled={busy || !input.trim()}
            >
              ➤
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}