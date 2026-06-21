import LandingPage from "@/components/LandingPage";
import { waitlistModeEnabled } from "@/lib/waitlist";

// Read at request time so the landing CTAs always match the live WAITLIST_MODE
// gate enforced by the proxy — flipping the env var (and redeploying) updates the
// buttons without a stale static cache showing the wrong copy/routes.
export const dynamic = "force-dynamic";

export default function Page() {
  return <LandingPage waitlistMode={waitlistModeEnabled()} />;
}
