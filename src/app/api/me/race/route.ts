import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { placementTeamFor } from "@/features/teams/placement";
import { auth } from "@/lib/auth/better-auth";

/**
 * The signed-in visitor's race on any night with a team path (ADR 0016): the
 * placement team they are on, or none. Read by the event page's price island —
 * that page is static and cannot know who is looking at it, and a RED or BLACK
 * member must not be shown a 25 zł price for an entry that is free for them.
 *
 * Says nothing about the night: membership is the whole rule, and the register
 * page re-derives it server-side when the row is written (`raceFor`), so this
 * can only ever change what the visitor sees, never what they pay.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, must-revalidate" };

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ team: null }, { headers: NO_STORE });
  }
  const team = await placementTeamFor(session.user.id);
  return NextResponse.json(
    { team: team ? { label: team.label, slug: team.slug } : null },
    { headers: NO_STORE },
  );
}
