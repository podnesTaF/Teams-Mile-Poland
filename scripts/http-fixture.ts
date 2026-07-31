/**
 * Throwaway HTTP-verification fixture for #32. NOT committed.
 *
 *   npx tsx --env-file=.env.local scripts/http-fixture.ts
 *   npx tsx --env-file=.env.local scripts/http-fixture.ts --teardown
 *
 * Seeds one confirmed runner + one published heat with room on `mile-2026-08-15`
 * and prints the signed ticket path plus a locally-minted admin session cookie
 * (the same value `adminLogin` sets, signed with this machine's SESSION_SECRET),
 * so the ticket page can be driven both signed-out and as an admin.
 */
import { eq, inArray, like } from "drizzle-orm";

import { eventHeats, eventRegistrations, users } from "../src/db/schema";
import { getDb } from "../src/lib/db";
import { signEventTicket } from "../src/features/ticket/sign";
import { signSessionPayload } from "../src/lib/auth/session";
import { createHeats, getEventHeats } from "../src/features/admin/heats-data";

const SLUG = "mile-2026-08-15";
const PREFIX = "http-";

async function teardown() {
  const db = getDb();
  const rows = await db.select({ id: users.id }).from(users).where(like(users.id, `${PREFIX}%`));
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(eventRegistrations).where(inArray(eventRegistrations.userId, ids));
  }
  const heats = await db
    .select({ id: eventHeats.id })
    .from(eventHeats)
    .where(eq(eventHeats.eventSlug, SLUG));
  if (heats.length > 0) {
    await db.delete(eventHeats).where(
      inArray(
        eventHeats.id,
        heats.map((h) => h.id),
      ),
    );
  }
  if (ids.length > 0) await db.delete(users).where(inArray(users.id, ids));
  console.log(`removed ${ids.length} fixture users and ${heats.length} heats on ${SLUG}`);
}

async function main() {
  if (process.argv.includes("--teardown")) {
    await teardown();
    process.exit(0);
  }

  const db = getDb();
  await db.insert(users).values({
    id: `${PREFIX}1`,
    name: "Hotel Hhh",
    firstName: "Hotel",
    lastName: "Hhh",
    email: `hotel.${PREFIX}@example.invalid`,
    emailVerified: true,
    club: "Fixture AC",
    sex: "F",
  });
  const [reg] = await db
    .insert(eventRegistrations)
    .values({
      eventSlug: SLUG,
      userId: `${PREFIX}1`,
      status: "confirmed",
      terms: true,
      locale: "pl",
    })
    .returning({ id: eventRegistrations.id });

  await createHeats(SLUG, {
    count: 1,
    capacity: 4,
    firstStart: new Date("2026-08-15T08:15:00.000Z"),
    intervalMinutes: 10,
  });
  const [heat] = await getEventHeats(SLUG);
  await db.update(eventHeats).set({ publishedAt: new Date() }).where(eq(eventHeats.id, heat.id));

  const exp = Math.floor(Date.now() / 1000) + 3600;
  console.log(
    JSON.stringify(
      {
        registrationId: reg.id,
        ticketPath: `/tickets/${encodeURIComponent(reg.id)}?s=${encodeURIComponent(signEventTicket(reg.id))}`,
        adminCookie: `tm_admin_session=${signSessionPayload({ admin: true, exp })}`,
        slug: SLUG,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

void main();
