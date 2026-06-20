import { NextResponse } from "next/server";

// Where waitlist signups are sent. Set this in .env.local to a webhook that
// appends a row to your spreadsheet, e.g. a Google Apps Script web app bound to
// a Google Sheet, a SheetDB/Sheety endpoint, or a Microsoft Power Automate flow
// connected to an Excel workbook. See the README / setup notes for details.
const WAITLIST_WEBHOOK_URL = process.env.WAITLIST_WEBHOOK_URL;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const record = {
    email,
    submittedAt: new Date().toISOString(),
  };

  // If no webhook is configured yet, accept the signup so the UI keeps working
  // during development. Wire up WAITLIST_WEBHOOK_URL to actually persist rows.
  if (!WAITLIST_WEBHOOK_URL) {
    console.log("[waitlist] signup (no webhook configured):", record);
    return NextResponse.json({ ok: true });
  }

  try {
    const res = await fetch(WAITLIST_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });

    if (!res.ok) {
      throw new Error(`Webhook responded ${res.status}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[waitlist] failed to forward signup:", err);
    return NextResponse.json(
      { error: "We couldn't save your spot just now. Please try again." },
      { status: 502 },
    );
  }
}
