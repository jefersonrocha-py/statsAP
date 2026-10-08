import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@lib/jwt";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/accept-invite"];
// Páginas públicas que redirecionam quem já está logado para o início.
const GUEST_ONLY_PATHS = ["/login", "/forgot-password", "/reset-password"];
const PUBLIC_FILE = /\.[^/]+$/;

function isPublic(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/api")) return true;
  if (PUBLIC_FILE.test(pathname)) return true;
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

function buildContentSecurityPolicy() {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  const connectSrc = [
    "'self'",
    "https://server.arcgisonline.com",
    "https://*.tile.openstreetmap.org",
  ];
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    "https://etheriumtech.com.br",
    "https://server.arcgisonline.com",
    "https://*.tile.openstreetmap.org",
  ];

  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
    connectSrc.push("http:", "https:", "ws:", "wss:");
  }

  const policy = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    `img-src ${imgSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
  ];

  if (!isDev) {
    policy.push("upgrade-insecure-requests");
  }

  return policy.join("; ");
}

function applySecurityHeaders(response: NextResponse, pathname: string) {
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Origin-Agent-Cluster", "?1");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (!pathname.startsWith("/api")) {
    response.headers.set("Content-Security-Policy", buildContentSecurityPolicy());
  } else {
    response.headers.set("Cache-Control", "no-store, private");
    response.headers.set("Pragma", "no-cache");
  }

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}

function nextWithHeaders(pathname: string) {
  return applySecurityHeaders(NextResponse.next(), pathname);
}

function redirectWithHeaders(target: URL) {
  return applySecurityHeaders(NextResponse.redirect(target), target.pathname);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value || null;

  if (pathname.startsWith("/api")) {
    return nextWithHeaders(pathname);
  }

  if (isPublic(pathname)) {
    if (GUEST_ONLY_PATHS.includes(pathname) && token) {
      try {
        await verifyAuthToken(token);
        return redirectWithHeaders(new URL("/", req.url));
      } catch {}
    }

    return nextWithHeaders(pathname);
  }

  if (!token) {
    return redirectWithHeaders(new URL("/login", req.url));
  }

  try {
    const user = await verifyAuthToken(token);

    if (pathname.startsWith("/admin") && user.role !== "SUPERADMIN") {
      return redirectWithHeaders(new URL("/", req.url));
    }

    if (pathname.startsWith("/settings") && user.role === "USER") {
      return redirectWithHeaders(new URL("/", req.url));
    }

    return nextWithHeaders(pathname);
  } catch {
    return redirectWithHeaders(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
};
