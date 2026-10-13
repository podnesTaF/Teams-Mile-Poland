/**
 * One-off (2026-10-13): invite every account that holds a result into one of
 * the four placement teams (ADR 0016), by the owner's rule:
 *
 *   men   → Ace Battle Mile RED Warsaw  / Ace Battle Mile BLACK Warsaw
 *   women → Ace Battle Mile-RED Warsaw  / Ace Battle Mile-BLACK Warsaw
 *   odd level (1, 3, 5 …) → BLACK, even level → RED
 *
 * "Level" is the level of the runner's best result — the same number the
 * profile, the admin user detail and the roster's season-best column show
 * (`getSeasonBests`, one pipeline). Sex is `users.sex`, falling back to the
 * sex the timing system recorded the best under when the profile has none.
 *
 * Writes exactly what `inviteByEmail` would — a pending `user_team_invitations`
 * row with a hashed token, `on_behalf = true`, invited by the organiser account
 * — and mails the same `TeamInvitationEmail` through `sendTeamMail`. Copy is
 * read from the message catalogs directly because `getTranslations` does not
 * run outside Next's request scope.
 *
 * Skips, never overrides: a runner already on a placement roster in their
 * category, and a runner who already holds a live pending invitation to the
 * target team. A pending invitation to the *other* team of the colour pair is
 * left in place and reported.
 *
 *   npx tsx --env-file=.env.local scripts/invite-rated-runners.ts            # dry run
 *   npx tsx --env-file=.env.local scripts/invite-rated-runners.ts --write    # insert + mail
 *   npx tsx --env-file=.env.local scripts/invite-rated-runners.ts --write --only a@x,b@y
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@react-email/render";
import { eq, inArray } from "drizzle-orm";

import { users } from "../src/db/schema/auth";
import {
  userTeamInvitations,
  userTeamMembers,
  userTeams,
  type UserTeamRow,
} from "../src/db/schema/user-teams";
import { getSeasonBests } from "../src/features/admin/roster-best";
import {
  PLACEMENT_TEAM_COLOURS,
  PLACEMENT_TEAM_SLUGS,
  type PlacementTeamSlug,
  type TeamCategory,
} from "../src/features/teams/config";
import { TeamInvitationEmail } from "../src/features/teams/emails/invitation";
import { invitationExpiry, newInvitationToken } from "../src/features/teams/invitations";
import {
  asTeamMailLocale,
  formatTeamDate,
  sendTeamMail,
  type TeamMailLocale,
} from "../src/features/teams/mail-invitations";
import { getAppUrl } from "../src/lib/app-url";
import { getDb } from "../src/lib/db";
import { localePath } from "../src/lib/i18n/config";

const WRITE = process.argv.includes("--write");
const onlyIdx = process.argv.indexOf("--only");
const ONLY =
  onlyIdx > -1 && process.argv[onlyIdx + 1]
    ? new Set(process.argv[onlyIdx + 1].split(",").map((e) => e.trim().toLowerCase()))
    : null;

/** The organiser account the invitations are issued by (`on_behalf`). */
const INVITER_EMAIL = "apodnes@gmail.com";

/** Resend's default rate limit is 2 requests per second. */
const SEND_GAP_MS = 650;

type Colour = "RED" | "BLACK";
const colourFor = (level: number): Colour => (level % 2 === 1 ? "BLACK" : "RED");

/* ── copy, straight from the catalogs ─────────────────────────────────── */

type Catalog = { invitation: Record<string, string>; categoryOption: Record<string, string> };
const catalogs = new Map<TeamMailLocale, Catalog>();
function catalog(locale: TeamMailLocale): Catalog {
  let c = catalogs.get(locale);
  if (!c) {
    const m = JSON.parse(
      readFileSync(join(process.cwd(), "src/messages", `${locale}.json`), "utf8"),
    );
    c = { invitation: m.teams.emails.invitation, categoryOption: m.teams.form.categoryOption };
    catalogs.set(locale, c);
  }
  return c;
}
const fill = (s: string, v: Record<string, string>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? `{${k}}`);

function buildMail(locale: TeamMailLocale, team: UserTeamRow, rawToken: string, expiresAt: Date) {
  const { invitation: t, categoryOption } = catalog(locale);
  const v = { team: team.name };
  const url = `${getAppUrl()}${localePath(locale, `/teams/invite/${rawToken}`)}`;
  return {
    subject: fill(t.subjectOnBehalf, v),
    react: TeamInvitationEmail({
      onBehalf: true,
      url,
      team: { name: team.name, category: categoryOption[team.category], region: team.region },
      copy: {
        preview: fill(t.preview, v),
        eyebrow: t.eyebrow,
        title: fill(t.title, v),
        greeting: t.greeting,
        body: fill(t.body, { ...v, inviter: "" }),
        bodyOnBehalf: fill(t.bodyOnBehalf, v),
        intro: t.intro,
        cta: t.cta,
        expiry: fill(t.expiry, { date: formatTeamDate(expiresAt, locale) }),
        ignore: t.ignore,
        labels: { team: t.teamLabel, category: t.categoryLabel, region: t.regionLabel },
      },
    }),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const db = getDb();
  const host = new URL(process.env.DATABASE_URL ?? "postgres://unset/").hostname;
  console.log(
    `${WRITE ? "WRITE" : "dry-run"} against ${host}; mail ${process.env.RESEND_API_KEY ? "ON" : "off"}; links -> ${getAppUrl()}`,
  );

  const [inviter] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, INVITER_EMAIL));
  if (!inviter || inviter.role !== "admin") {
    throw new Error(`Inviter ${INVITER_EMAIL} is not an admin account`);
  }

  const teams = await db
    .select()
    .from(userTeams)
    .where(inArray(userTeams.slug, [...PLACEMENT_TEAM_SLUGS]));
  const teamFor = new Map<string, UserTeamRow>();
  for (const t of teams) {
    teamFor.set(`${t.category}:${PLACEMENT_TEAM_COLOURS[t.slug as PlacementTeamSlug]}`, t);
  }
  if (teamFor.size !== 4) {
    throw new Error(`Expected 4 placement teams, found ${teams.map((t) => t.slug).join(", ")}`);
  }
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const all = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      sex: users.sex,
      locale: users.locale,
    })
    .from(users);
  const bests = await getSeasonBests(
    all.map((u) => ({ userId: u.id, firstName: u.firstName, lastName: u.lastName, name: u.name })),
    "__none__",
  );

  const memberships = await db
    .select({
      userId: userTeamMembers.userId,
      teamId: userTeamMembers.teamId,
      category: userTeamMembers.category,
    })
    .from(userTeamMembers);
  const pending = await db
    .select()
    .from(userTeamInvitations)
    .where(eq(userTeamInvitations.status, "pending"));
  const now = new Date();

  type Plan = {
    user: (typeof all)[number];
    level: number;
    timeCs: number;
    category: TeamCategory;
    team: UserTeamRow;
    notes: string[];
  };
  const plans: Plan[] = [];
  const skipped: string[] = [];

  for (const u of all) {
    const best = bests.get(u.id);
    if (!best) continue;
    const sex = u.sex ?? best.gender;
    const category: TeamCategory = sex === "F" ? "women" : "men";
    const colour = colourFor(best.level);
    const team = teamFor.get(`${category}:${colour}`)!;
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name;
    const label = `${u.email} (${fullName}) L${best.level} ${sex}`;

    const onRoster = memberships.find((m) => m.userId === u.id && m.category === category);
    if (onRoster) {
      skipped.push(`${label} - already on ${teamById.get(onRoster.teamId)?.name ?? onRoster.teamId}`);
      continue;
    }
    const email = u.email.toLowerCase();
    const live = pending.filter(
      (p) => p.email.toLowerCase() === email && p.expiresAt.getTime() > now.getTime(),
    );
    const onTarget = live.find((p) => p.teamId === team.id);
    if (onTarget) {
      skipped.push(
        `${label} - already holds a pending invitation to ${team.name} (until ${onTarget.expiresAt.toISOString().slice(0, 10)})`,
      );
      continue;
    }
    if (ONLY && !ONLY.has(email)) continue;
    const notes: string[] = [];
    if (!u.sex) notes.push("sex taken from the result sheet (profile has none)");
    for (const p of live) {
      notes.push(`also holds a pending invitation to ${teamById.get(p.teamId)?.name ?? p.teamId}`);
    }
    plans.push({ user: u, level: best.level, timeCs: best.timeCs, category, team, notes });
  }

  // Same best time in the same category twice is the duplicate-account smell
  // (Hildebrand on 22.08) — flagged, not decided.
  const byTime = new Map<string, Plan[]>();
  for (const p of plans) {
    const k = `${p.category}:${p.timeCs}`;
    byTime.set(k, [...(byTime.get(k) ?? []), p]);
  }
  for (const group of byTime.values()) {
    if (group.length < 2) continue;
    for (const p of group) {
      const others = group.filter((o) => o !== p).map((o) => o.user.email);
      p.notes.push(`same best time as ${others.join(", ")} - duplicate account?`);
    }
  }

  plans.sort((a, b) => a.team.name.localeCompare(b.team.name) || a.level - b.level);
  console.log(`\n== PLAN: ${plans.length} invitations ==`);
  let current = "";
  for (const p of plans) {
    if (p.team.name !== current) {
      current = p.team.name;
      const n = plans.filter((x) => x.team.id === p.team.id).length;
      console.log(`\n--- ${current} (${n}) ---`);
    }
    const warn = p.notes.length ? `  ! ${p.notes.join("; ")}` : "";
    console.log(`  L${String(p.level).padStart(2)}  ${p.user.email}  [${asTeamMailLocale(p.user.locale)}]${warn}`);
  }
  console.log(`\n== SKIPPED: ${skipped.length} ==`);
  for (const s of skipped) console.log("  " + s);

  if (!WRITE) {
    // A rendered sample so the mail can be eyeballed before anything is sent.
    const sampleTeam = teamFor.get("men:RED")!;
    const html = await render(buildMail("en", sampleTeam, "SAMPLE-TOKEN", invitationExpiry()).react);
    const out = join(process.env.SCRATCH ?? process.cwd(), "invite-sample.html");
    writeFileSync(out, html);
    console.log(`\nDry run - nothing written. Sample mail rendered to ${out}. Re-run with --write to insert and send.`);
    return;
  }

  console.log(`\n== WRITING ${plans.length} invitations as ${INVITER_EMAIL} ==`);
  let inserted = 0;
  let mailed = 0;
  let mailFailed = 0;
  for (const p of plans) {
    const token = newInvitationToken();
    const expiresAt = invitationExpiry();
    const email = p.user.email.toLowerCase();
    let id: string;
    try {
      const [row] = await db
        .insert(userTeamInvitations)
        .values({
          teamId: p.team.id,
          email,
          tokenHash: token.hash,
          invitedByUserId: inviter.id,
          onBehalf: true,
          status: "pending",
          expiresAt,
        })
        .returning({ id: userTeamInvitations.id });
      id = row.id;
      inserted++;
    } catch (error) {
      console.error(`  x ${email} -> ${p.team.name}: insert failed`, (error as Error).message);
      continue;
    }
    const locale = asTeamMailLocale(p.user.locale);
    const mail = buildMail(locale, p.team, token.raw, expiresAt);
    const ok = await sendTeamMail({ to: email, locale, subject: mail.subject, react: mail.react });
    if (ok) mailed++;
    else mailFailed++;
    console.log(`  ${ok ? "ok" : "MAIL FAILED (row kept)"}  ${email} -> ${p.team.name} [${locale}] ${id}`);
    await sleep(SEND_GAP_MS);
  }
  console.log(`\nDone: ${inserted} rows inserted, ${mailed} mails sent, ${mailFailed} mail failures.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
