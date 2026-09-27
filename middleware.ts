import { NextResponse, type NextRequest } from "next/server";
import {
  decodeHintedRole,
  looksLikeSessionCookie
} from "@shared/auth/session-edge";

export const OPTIMUS_SESSION_COOKIE_NAME = "optimus_session";

const PUBLIC_WEBHOOK_PREFIXES = [
  "/api/email/webhook",
  "/api/whatsapp/webhook",
  "/api/calls/webhook",
  "/api/stt",
  "/api/tts"
];

const WEBSITE_ORIGIN_FALLBACK = "http://localhost:3000";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|demitech-logo.svg|public|manifest|robots.txt).*)"
  ]
};

function websiteOrigin(): string {
  return process.env.NEXT_PUBLIC_WEBSITE_URL?.replace(/\/$/, "") ?? WEBSITE_ORIGIN_FALLBACK;
}

function isPublicWebhook(pathname: string): boolean {
  // Webhooks are authenticated by HMAC in the route handler, not by session cookie.
  return PUBLIC_WEBHOOK_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isAuthPage = pathname === "/login";
  const isProtectedUi =
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin");

  const rawCookie = req.cookies.get(OPTIMUS_SESSION_COOKIE_NAME)?.value ?? null;
  const session = decodeHintedRole(rawCookie);
  const hasSession = looksLikeSessionCookie(rawCookie) || Boolean(session);
  const isAdminSession = Boolean(session?.adminClaims || session?.role === "admin");

  // Redirect root to command dashboard (protected) or login.
  if (pathname === "/" && !isApi) {
    const u = req.nextUrl.clone();
    u.pathname = hasSession && isAdminSession ? "/dashboard/command" : "/login";
    return NextResponse.redirect(u, 307);
  }

  // Any legacy public website routes that reached optimus via bad DNS → bounce to website.
  const websiteOnlyUi = [
    "/pricing", "/portfolio", "/contact", "/quote", "/book", "/bookings",
    "/register", "/unsubscribed"
  ];
  if (websiteOnlyUi.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const dest = new URL(`${websiteOrigin()}${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(dest, 308);
  }

  if (isAuthPage) {
    if (hasSession && isAdminSession) {
      const u = req.nextUrl.clone();
      u.pathname = "/dashboard/command";
      return NextResponse.redirect(u, 307);
    }
    return NextResponse.next();
  }

  if (isApi) {
    if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") {
      return NextResponse.next();
    }
    if (isPublicWebhook(pathname)) {
      return NextResponse.next();
    }
    if (!hasSession) {
      return NextResponse.json(
        { ok: false, error: "unauthenticated" },
        { status: 401 }
      );
    }
    if (!isAdminSession) {
      return NextResponse.json(
        { ok: false, error: "forbidden_admin" },
        { status: 403 }
      );
    }
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-auth-role", session?.role ?? "admin");
    requestHeaders.set("x-auth-admin", "1");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (isProtectedUi) {
    if (!hasSession) {
      const u = req.nextUrl.clone();
      u.pathname = "/login";
      u.searchParams.set("next", pathname);
      return NextResponse.redirect(u, 307);
    }
    if (!isAdminSession) {
      const dest = new URL(`${websiteOrigin()}/dashboard/projects`);
      return NextResponse.redirect(dest, 307);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}
