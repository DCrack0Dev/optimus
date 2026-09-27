import { NextResponse, type NextRequest } from "next/server";
import type { Uid, UserRole } from "@shared/types";

function actorFromHeaders(req: NextRequest): { uid: Uid; role: UserRole; isAdmin: boolean } {
  const uid = (req.headers.get("x-auth-uid") ?? "SYSTEM") as Uid;
  const role = (req.headers.get("x-auth-role") ?? "client") as UserRole;
  const isAdmin = role === "admin" || req.headers.get("x-auth-admin") === "1";
  return { uid, role, isAdmin };
}

function checkEnvVar(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && v.length > 0);
}

export async function GET(req: NextRequest) {
  const { isAdmin } = actorFromHeaders(req);
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "forbidden_admin_only" }, { status: 403 });
  }

  const emailConfigured = checkEnvVar("BREVO_API_KEY") && checkEnvVar("BREVO_SENDER_EMAIL");
  const llmConfigured = checkEnvVar("LLM_API_KEY");
  const whatsappConfigured = checkEnvVar("WHATSAPP_API_KEY") && checkEnvVar("WHATSAPP_PHONE_NUMBER_ID");
  const voiceConfigured = checkEnvVar("VOICE_API_KEY");

  const status = {
    email: {
      configured: emailConfigured,
      provider: "Brevo",
      senderEmail: process.env.BREVO_SENDER_EMAIL ?? undefined,
      senderName: process.env.BREVO_SENDER_NAME ?? undefined,
    },
    llm: {
      configured: llmConfigured,
      provider: "OpenAI Compatible",
      model: process.env.LLM_MODEL ?? "llama-3.3-70b-versatile",
      baseUrl: process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1",
    },
    whatsapp: {
      configured: whatsappConfigured,
      provider: process.env.WHATSAPP_PROVIDER ?? "Not configured",
    },
    voice: {
      configured: voiceConfigured,
      provider: process.env.VOICE_PROVIDER ?? "Not configured",
      stt: process.env.STT_PROVIDER ?? "Not configured",
      tts: process.env.TTS_PROVIDER ?? "Not configured",
    },
  };

  return NextResponse.json({ ok: true, status });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";