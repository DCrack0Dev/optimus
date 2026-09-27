import { NextResponse, type NextRequest } from "next/server";
import { createSTTProvider } from "@optimus/lib/providers/voice";

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

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "expected multipart/form-data" }, { status: 400 });
  }

  const formData = await req.formData();
  const audioFile = formData.get("audio") as File | null;

  if (!audioFile) {
    return NextResponse.json({ ok: false, error: "no audio file" }, { status: 400 });
  }

  const sttProvider = createSTTProvider();

  try {
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const result = await sttProvider.transcribe(audioBuffer, audioFile.type, {
      language: "en",
      responseFormat: "verbose_json",
    });

    return NextResponse.json({
      ok: true,
      text: result.text.trim(),
      confidence: result.confidence ?? 1,
      language: result.language ?? "en",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("STT error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";