"use client";

import { useEffect, useState } from "react";
import { useFirebaseUser } from "@optimus/components/providers/FirebaseClientProvider";

type EmailStatus = { configured: boolean; provider?: string; senderEmail?: string; senderName?: string };
type LLMStatus = { configured: boolean; provider?: string; model?: string; baseUrl?: string };
type WhatsAppStatus = { configured: boolean; provider?: string };
type VoiceStatus = { configured: boolean; provider?: string; stt?: string; tts?: string };

type ProviderStatus = {
  email: EmailStatus;
  llm: LLMStatus;
  whatsapp: WhatsAppStatus;
  voice: VoiceStatus;
};

type ProviderConfig = {
  key: string;
  label: string;
  icon: string;
  status: EmailStatus | LLMStatus | WhatsAppStatus | VoiceStatus;
  envVars: string[];
  description: string;
};

export default function ProvidersSettings() {
  const { user, initialising: loading } = useFirebaseUser();
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  async function load() {
    setBusy(true);
    try {
      const token = user ? await user.getIdToken(true) : null;
      const res = await fetch("/api/settings/providers", {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
        },
      });
      const body = (await res.json()) as { ok: boolean; status: ProviderStatus; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "load failed");
      setStatus(body.status);
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
  }, [user, loading]);

  if (loading || busy) {
    return <div className="order-card opacity-60">Loading provider status…</div>;
  }

  const providers: ProviderConfig[] = [
    {
      key: "email",
      label: "Email Provider",
      icon: "📧",
      status: status?.email!,
      envVars: ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME"],
      description: "Brevo (Sendinblue) for transactional and marketing emails",
    },
    {
      key: "llm",
      label: "LLM Provider",
      icon: "🤖",
      status: status?.llm!,
      envVars: ["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"],
      description: "OpenAI-compatible API (Groq, OpenAI, Together, etc.) for AI intelligence",
    },
    {
      key: "whatsapp",
      label: "WhatsApp Provider",
      icon: "💬",
      status: status?.whatsapp!,
      envVars: ["WHATSAPP_PROVIDER", "WHATSAPP_API_KEY", "WHATSAPP_PHONE_NUMBER_ID"],
      description: "WhatsApp Business API provider (Twilio, Meta, etc.)",
    },
    {
      key: "voice",
      label: "Voice Provider",
      icon: "📞",
      status: status?.voice!,
      envVars: ["VOICE_PROVIDER", "VOICE_API_KEY", "STT_PROVIDER", "TTS_PROVIDER"],
      description: "Voice calling with STT/TTS (Twilio, Vonage, Plivo, etc.)",
    },
  ];

  return (
    <div className="order-card">
      <div className="mb-6">
        <div className="section-tag">Settings / Providers</div>
        <h1 className="text-2xl font-title text-white mt-1">Provider Configuration</h1>
        <p className="opacity-70 text-sm mt-1">
          All provider credentials are configured via environment variables on the server.
          This page shows the current connection status and required environment variables.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 p-3 text-sm mb-6">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((p) => (
          <div key={p.key} className="p-5 bg-black/30 border border-white/10 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{p.icon}</span>
              <div>
                <h3 className="font-title text-lg">{p.label}</h3>
                <p className="text-sm opacity-70">{p.description}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm opacity-70">Status</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  p.status?.configured
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 border"
                    : "bg-red-500/20 text-red-300 border-red-500/30 border"
                }`}
              >
                {p.status?.configured ? "✅ Connected" : "❌ Not Configured"}
              </span>
            </div>

            {p.status?.configured && (
              <div className="space-y-2 text-sm mb-4">
                {p.status.provider && <div><span className="opacity-60">Provider:</span> <span className="ml-2 font-mono">{p.status.provider}</span></div>}
                {"model" in p.status && p.status.model && <div><span className="opacity-60">Model:</span> <span className="ml-2 font-mono">{p.status.model}</span></div>}
                {"baseUrl" in p.status && p.status.baseUrl && <div><span className="opacity-60">Base URL:</span> <span className="ml-2 font-mono truncate max-w-[200px]">{p.status.baseUrl}</span></div>}
                {"senderEmail" in p.status && p.status.senderEmail && <div><span className="opacity-60">Sender:</span> <span className="ml-2">{p.status.senderEmail} {("senderName" in p.status && p.status.senderName) ? `(${p.status.senderName})` : ""}</span></div>}
                {"stt" in p.status && p.status.stt && <div><span className="opacity-60">STT:</span> <span className="ml-2">{p.status.stt}</span></div>}
                {"tts" in p.status && p.status.tts && <div><span className="opacity-60">TTS:</span> <span className="ml-2">{p.status.tts}</span></div>}
              </div>
            )}

            <div className="border-t border-white/10 pt-4">
              <h4 className="text-sm font-medium mb-2 opacity-70">Required Environment Variables</h4>
              <div className="space-y-1 text-xs font-mono">
                {p.envVars.map((v) => (
                  <div key={v} className="flex items-center gap-2">
                    <code className="bg-black/40 px-2 py-0.5 rounded">{v}</code>
                    <span className="text-xs opacity-50">={process.env[v] ? "***SET***" : "❌ MISSING"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-5 bg-black/30 border border-white/10 rounded-xl">
        <h3 className="font-title text-lg mb-3">Environment Variable Reference</h3>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 text-sm">
          <div className="bg-black/40 p-3 rounded-lg">
            <h4 className="font-medium mb-2 text-[var(--gold)]">Email (Brevo)</h4>
            <div className="space-y-1 text-xs">
              <code>BREVO_API_KEY</code> — API key from Brevo dashboard
              <br /><code>BREVO_SENDER_EMAIL</code> — Verified sender email
              <br /><code>BREVO_SENDER_NAME</code> — Sender display name
            </div>
          </div>
          <div className="bg-black/40 p-3 rounded-lg">
            <h4 className="font-medium mb-2 text-[var(--gold)]">LLM (OpenAI Compatible)</h4>
            <div className="space-y-1 text-xs">
              <code>LLM_API_KEY</code> — API key for LLM provider
              <br /><code>LLM_BASE_URL</code> — Base URL (default: https://api.groq.com/openai/v1)
              <br /><code>LLM_MODEL</code> — Model name (default: llama-3.3-70b-versatile)
            </div>
          </div>
          <div className="bg-black/40 p-3 rounded-lg">
            <h4 className="font-medium mb-2 text-[var(--gold)]">WhatsApp</h4>
            <div className="space-y-1 text-xs">
              <code>WHATSAPP_PROVIDER</code> — Provider name (twilio, meta, etc.)
              <br /><code>WHATSAPP_API_KEY</code> — API key/token
              <br /><code>WHATSAPP_PHONE_NUMBER_ID</code> — Business phone number ID
            </div>
          </div>
          <div className="bg-black/40 p-3 rounded-lg">
            <h4 className="font-medium mb-2 text-[var(--gold)]">Voice</h4>
            <div className="space-y-1 text-xs">
              <code>VOICE_PROVIDER</code> — Provider (twilio, vonage, plivo)
              <br /><code>VOICE_API_KEY</code> — API credentials
              <br /><code>STT_PROVIDER</code> — Speech-to-text (openai-whisper, deepgram, etc.)
              <br /><code>TTS_PROVIDER</code> — Text-to-speech (elevenlabs, openai, etc.)
            </div>
          </div>
          <div className="bg-black/40 p-3 rounded-lg">
            <h4 className="font-medium mb-2 text-[var(--gold)]">Firebase Admin</h4>
            <div className="space-y-1 text-xs">
              <code>FIREBASE_SERVICE_ACCOUNT_JSON</code> — Full service account JSON (recommended)
              <br /><code>FIREBASE_ADMIN_PROJECT_ID</code> — Project ID
              <br /><code>FIREBASE_ADMIN_PRIVATE_KEY</code> — Private key
              <br /><code>FIREBASE_ADMIN_CLIENT_EMAIL</code> — Client email
            </div>
          </div>
          <div className="bg-black/40 p-3 rounded-lg">
            <h4 className="font-medium mb-2 text-[var(--gold)]">Business</h4>
            <div className="space-y-1 text-xs">
              <code>BUSINESS_EMAIL</code> — Business contact email
              <br /><code>BUSINESS_PHONE_E164</code> — Business phone
              <br /><code>TEBOGO_PHONE_E164</code> — Tebogo's phone for handoffs
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}