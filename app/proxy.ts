import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Waitlist mode gates the whole app down to the landing ("/") and waitlist
// ("/waitlist") pages. Every other route (send, register, modify, history,
// claim, flow, etc.) is redirected to the waitlist.
//
// Controlled by the WAITLIST_MODE env var. It is ON by default and only turns
// OFF when the value is explicitly "false" (or "0" / "off" / "no"). Failing
// safe this way means a missing or mistyped value keeps the app gated rather
// than accidentally exposing unfinished routes.
//
// This is a Next.js "proxy" (the successor to middleware). To flip the gate,
// change WAITLIST_MODE and rebuild/redeploy (no code change needed). On hosts
// like Vercel, changing the env var and redeploying applies it automatically.
const WAITLIST_OFF = new Set(["false", "0", "off", "no"]);
const ALLOWED = new Set(["/", "/waitlist"]);

function waitlistModeEnabled() {
  const value = (process.env.WAITLIST_MODE ?? "").trim().toLowerCase();
  return !WAITLIST_OFF.has(value);
}

export default function proxy(request: NextRequest) {
  // Waitlist mode off: behave like a normal app, every route is reachable.
  if (!waitlistModeEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (ALLOWED.has(pathname)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/waitlist";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Run on everything except: the waitlist API, Next.js internals, the
    // favicon, and any file with an extension (svg/png/etc. in /public).
    "/((?!api/waitlist|_next/static|_next/image|favicon.svg|.*\\..*).*)",
  ],
};
