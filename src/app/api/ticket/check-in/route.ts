import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { loadTicketByRunnerId, markCheckedIn, verifyTicket } from "@/features/ticket";

/**
 * DEPRECATED — slated for removal.
 *
 * The legacy machine-to-machine check-in endpoint for the frozen team event
 * (warsaw-2026): a `CHECKIN_API_KEY` bearer token plus a signed `runnerId`.
 *
 * **Nothing in this application calls it.** Race-morning check-in for the mile
 * series goes through the admin desk and the QR scanner
 * (`/admin/events/[slug]/checkin`, `/admin/scan`), which authenticate as a
 * signed-in admin holding the `checkin` capability (`src/lib/auth/roles.ts`) —
 * not as an API key — and act on `event_registrations`, which this route does
 * not touch at all.
 *
 * It is left in place only because an external scanner or hardware integration
 * may still hold the key. Confirm with the event owner that no such client
 * exists, then delete this route and retire `CHECKIN_API_KEY` from the
 * environment (it is referenced nowhere else). Do not build anything new on it.
 */

type CheckInBody = {
  runnerId?: unknown;
  sig?: unknown;
};

function isAuthorized(request: Request): boolean {
  const expected = process.env.CHECKIN_API_KEY;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const provided = match[1];
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

function summary(view: Awaited<ReturnType<typeof loadTicketByRunnerId>>, checkedInAt: Date) {
  if (!view) {
    return { checkedInAt: checkedInAt.toISOString() };
  }
  return {
    runnerId: view.view.runnerId,
    fullName: view.view.fullName,
    teamCode: view.view.teamCode,
    teamName: view.view.teamName,
    checkedInAt: checkedInAt.toISOString(),
  };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CheckInBody;
  try {
    body = (await request.json()) as CheckInBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const runnerId = typeof body.runnerId === "string" ? body.runnerId : "";
  const sig = typeof body.sig === "string" ? body.sig : "";

  if (!runnerId || !sig) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (!verifyTicket(runnerId, sig)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  }

  const loaded = await loadTicketByRunnerId(runnerId);
  if (!loaded) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (loaded.checkedInAt) {
    return NextResponse.json({
      status: "already_checked_in",
      ...summary(loaded, loaded.checkedInAt),
    });
  }

  const checkedInAt = await markCheckedIn(runnerId);
  if (!checkedInAt) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({
    status: "checked_in",
    ...summary(loaded, checkedInAt),
  });
}
