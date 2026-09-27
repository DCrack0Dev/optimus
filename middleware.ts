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

const WEBSITE_ORIGIN_FALLBACK = "";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|demitech-logo.svg|public|manifest|robots.txt).*)"
  ]
};

function websiteOrigin(req: NextRequest): string {
  const raw = process.env.NEXT_PUBLIC_WEBSITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? WEBSITE_ORIGIN_FALLBACK;
  const cleaned = String(raw).replace(/\/$/, "");
  if (cleaned) return cleaned;
  try { return new URL("/", req.nextUrl).origin.replace(/\/$/, ""); }
  catch { return ""; }
}

function optimusOrigin(req: NextRequest): string {
  const raw = process.env.NEXT_PUBLIC_OPTIMUS_URL;
  const cleaned = String(raw ?? "").replace(/\/$/, "");
  if (cleaned) return cleaned;
  try { return new URL("/", req.nextUrl).origin.replace(/\/$/, ""); }
  catch { return ""; }
}

function isPublicWebhook(pathname: string): boolean {
  if (typeof pathname !== "string") return false;
  return PUBLIC_WEBHOOK_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function redirectTo(url: URL | string, status = 307): NextResponse {
  const target = typeof url === "string" ? new URL(url) : url;
  return NextResponse.redirect(target.toString(), status as 307 | 308);
}

export function middleware(req: NextRequest) {
  try {
    const pathname = typeof req.nextUrl?.pathname === "string" ? req.nextUrl.pathname : "/";
    const isApi = pathname.startsWith("/api/");
    const isAuthPage = pathname === "/login";
    const isProtectedUi =
      pathname === "/" ||
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/admin" ||
      pathname.startsWith("/admin/");

    const rawCookie = req.cookies.get(OPTIMUS_SESSION_COOKIE_NAME)?.value ?? null;
    let session: { role?: string; adminClaims?: boolean } | null = null;
    try {
      session = decodeHintedRole(rawCookie);
    } catch {
      session = null;
    }
    const hasSession = looksLikeSessionCookie(rawCookie) || Boolean(session);
    const isAdminSession = Boolean(session?.adminClaims || session?.role === "admin");

    if (pathname === "/" && !isApi) {
      const u = req.nextUrl.clone();
      u.pathname = hasSession && isAdminSession ? "/dashboard/command" : "/login";
      return redirectTo(u, 307);
    }

    const websiteOnlyUi = [
      "/pricing", "/portfolio", "/contact", "/quote", "/book", "/bookings",
      "/register", "/unsubscribed"
    ];
    if (websiteOnlyUi.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      try {
        const base = websiteOrigin(req);
        const dest = new URL(pathname + (req.nextUrl.search || ""), base || req.nextUrl.origin);
        return redirectTo(dest, 308);
      } catch {
        const u = req.nextUrl.clone();
        u.pathname = "/login";
        return redirectTo(u, 307);
      }
    }

    if (isAuthPage) {
      if (hasSession && isAdminSession) {
        const u = req.nextUrl.clone();
        u.pathname = "/dashboard/command";
        return redirectTo(u, 307);
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
      requestHeaders.set("x-auth-role", String(session?.role ?? "admin"));
      requestHeaders.set("x-auth-admin", "1");
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    if (isProtectedUi) {
      if (!hasSession) {
        const u = req.nextUrl.clone();
        u.pathname = "/login";
        u.searchParams.set("next", pathname);
        return redirectTo(u, 307);
      }
      if (!isAdminSession) {
        try {
          const base = websiteOrigin(req);
          const dest = new URL("/dashboard/projects", base || req.nextUrl.origin);
          return redirectTo(dest, 307);
        } catch {
          const u = req.nextUrl.clone();
          u.pathname = "/login";
          return redirectTo(u, 307);
        }
      }
      return NextResponse.next();
    }

    return NextResponse.next();
  } catch (err) {
    try {
      const u = req.nextUrl.clone();
      u.pathname = "/login";
      u.searchParams.delete("next");
      return redirectTo(u, 307);
    } catch {
      const base = optimusOrigin(req);
      return NextResponse.redirect(base + "/login", 307);
    }
  }
}
