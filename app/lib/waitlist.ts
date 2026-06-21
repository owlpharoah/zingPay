// Single source of truth for the waitlist gate.
//
// Waitlist mode gates the whole app down to the landing ("/") and waitlist
// ("/waitlist") pages — every other route is redirected to the waitlist by the
// proxy (see proxy.ts). The landing page also reads this to decide whether its
// CTAs say "Join waitlist" (gated) or "Open App"/"Try it now" (open).
//
// Controlled by the WAITLIST_MODE env var. It is ON by default and only turns
// OFF when the value is explicitly "false" (or "0" / "off" / "no"). Failing safe
// this way means a missing or mistyped value keeps the app gated rather than
// accidentally exposing unfinished routes.
//
// WAITLIST_MODE is a server-only env var (no NEXT_PUBLIC_ prefix), so this must
// only be called from server contexts (middleware/proxy or server components).
const WAITLIST_OFF = new Set(["false", "0", "off", "no"]);

export function waitlistModeEnabled(): boolean {
  const value = (process.env.WAITLIST_MODE ?? "").trim().toLowerCase();
  return !WAITLIST_OFF.has(value);
}
