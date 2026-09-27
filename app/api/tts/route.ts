import { NextResponse, type NextRequest } from "next/server";
import { createTTSProvider } from "@optimus/lib/providers/voice";

function actorFromHeaders(req: NextRequest): { uid: string; isAdmin: boolean } {
  const uid = req.headers.get("x-auth-uid") ?? "SYSTEM";
  const isAdmin = req.headers.get("x-auth-admin") === "1";
  return { uid, isAdmin };
}

export async function POST(req: NextRequest) {
  const { uid, isAdmin } = actorFromHeaders(req);
  if (!isAdmin && uid !== "SYSTEM") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: { text: string; voiceId?: string; responseFormat?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.text || body.text.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
  }

  const ttsProvider = createTTSProvider();

  try {
    const result = await ttsProvider.synthesize(body.text, {
      voice: body.voiceId,
      responseFormat: body.responseFormat as any,
    });

    // Convert Node.js Buffer to ArrayBuffer for NextResponse compatibility
    const arrayBuffer = result.audioBuffer.buffer.slice(
      result.audioBuffer.byteOffset,
      result.audioBuffer.byteOffset + result.audioBuffer.byteLength
    ) as ArrayBuffer;
    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": result.mimeType,
        "Content-Length": arrayBuffer.byteLength.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("TTS error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";