import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { clearOptimusSessionCookieUsingStore } from "@optimus/lib/auth/session";

export async function POST(_req: NextRequest) {
  const store = cookies();
  clearOptimusSessionCookieUsingStore(store);
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  return NextResponse.json({ ok: true, loggedOut: true }, { status: 200, headers });
}
