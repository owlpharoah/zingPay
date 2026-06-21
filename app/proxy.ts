import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { waitlistModeEnabled } from "@/lib/waitlist";

// Waitlist mode gates the whole app down to the landing ("/") and waitlist
// ("/waitlist") pages. Every other route (send, register, modify, history,
// claim, flow, etc.) is redirected to the waitlist. The gate itself lives in
// lib/waitlist so the landing page shares the exact same WAITLIST_MODE check.
//
// This is a Next.js "proxy" (the successor to middleware). To flip the gate,
// change WAITLIST_MODE and rebuild/redeploy (no code change needed). On hosts
// like Vercel, changing the env var and redeploying applies it automatically.
const ALLOWED = new Set(["/", "/waitlist"]);

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
