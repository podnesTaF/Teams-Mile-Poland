import { createHmac } from "node:crypto";

import { and, count, eq, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { magicLinks, pendingRegistrations, runners, slotCounter, teams } from "@/db/schema";
import { getDb } from "@/lib/db";
import { EVENT } from "@/lib/marketing/event";

import {
  normalizeTeamCode,
  parsePersonalBestSeconds,
  type RegistrationPayload,
} from "./schemas";

const MAX_TEAM_SIZE = 12;
const COUNTER_ID = 1;

export type RegistrationCounters = {
  freeSlotsClaimed: number;
  freeSlotsRemaining: number;
  freeSlotsTotal: number;
  teamsFormed: number;
};

export type TeamPreview = {
  id: string;
  code: string;
  name: string;
  category: "mens" | "womens" | "mixed";
  region: string;
  status: "open" | "locked" | "final" | "cancelled";
  captainName: string | null;
  captainEmail: string | null;
  runnerCount: number;
  capacity: number;
};

export type JoinValidation =
  | { ok: true; team: TeamPreview }
  | { ok: false; reason: "missing" | "locked" | "full" | "gender"; message: string; team?: TeamPreview };

export type StoredRegistration = {
  runnerId: string;
  teamId?: string;
  teamCode?: string;
  runnerEmail: string;
  captainEmail?: string | null;
  flow: RegistrationPayload["flow"];
  paymentStatus: "free" | "paid";
};

export async function getRegistrationCounters(): Promise<RegistrationCounters> {
  if (!process.env.DATABASE_URL) {
    return fallbackCounters();
  }

  try {
    const db = getDb();
    const [counter] = await db.select().from(slotCounter).where(eq(slotCounter.id, COUNTER_ID)).limit(1);
    const [teamCount] = await db.select({ value: count() }).from(teams);
    const claimed = Math.min(counter?.freeRunnersClaimed ?? 0, EVENT.freeTier.total);

    return {
      freeSlotsClaimed: claimed,
      freeSlotsRemaining: Math.max(EVENT.freeTier.total - claimed, 0),
      freeSlotsTotal: EVENT.freeTier.total,
      teamsFormed: teamCount?.value ?? 0,
    };
  } catch {
    return fallbackCounters();
  }
}

export async function validateJoinCode(
  code: string,
  gender?: "male" | "female",
): Promise<JoinValidation> {
  const normalized = normalizeTeamCode(code);
  const db = getDb();
  const [team] = await db.select().from(teams).where(eq(teams.code, normalized)).limit(1);

  if (!team) {
    return {
      ok: false,
      reason: "missing",
      message: "We could not find that team code. Check the code or ask your captain for a fresh invite link.",
    };
  }

  const preview = await buildTeamPreview(team.id);

  if (team.status !== "open") {
    return {
      ok: false,
      reason: "locked",
      message: `${team.name} is not accepting runners right now. Ask the captain or organizer for help.`,
      team: preview,
    };
  }

  if (preview.runnerCount >= MAX_TEAM_SIZE) {
    return {
      ok: false,
      reason: "full",
      message: `${team.name} is already full. Ask the organizer about another open team.`,
      team: preview,
    };
  }

  if (gender && !genderMatchesCategory(gender, team.category)) {
    return {
      ok: false,
      reason: "gender",
      message: `${team.name} is registered as ${team.category}. Choose a matching team or contact the organizer.`,
      team: preview,
    };
  }

  return { ok: true, team: preview };
}

export async function createFreeRegistration(payload: RegistrationPayload) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [counter] = await tx.select({ id: slotCounter.id }).from(slotCounter).limit(1);

    if (!counter) {
      await tx
        .insert(slotCounter)
        .values({ id: COUNTER_ID, freeRunnersClaimed: 0, freeTeamsClaimed: 0 });
    }

    const claimed = await tx
      .update(slotCounter)
      .set({
        freeRunnersClaimed: sql`${slotCounter.freeRunnersClaimed} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(slotCounter.id, COUNTER_ID),
          lt(slotCounter.freeRunnersClaimed, EVENT.freeTier.total),
        ),
      )
      .returning({ claimed: slotCounter.freeRunnersClaimed });

    if (claimed.length === 0) {
      return null;
    }

    return insertRegistration(tx, payload, "free");
  });
}

export async function createPaidRegistration(payload: RegistrationPayload, stripeSessionId: string) {
  const db = getDb();

  await db.insert(pendingRegistrations).values({
    payload,
    stripeSessionId,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
}

export async function promotePendingRegistration(stripeSessionId: string) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(runners)
      .where(eq(runners.stripeSessionId, stripeSessionId))
      .limit(1);

    if (existing[0]) {
      return { runnerId: existing[0].id };
    }

    const [pending] = await tx
      .select()
      .from(pendingRegistrations)
      .where(eq(pendingRegistrations.stripeSessionId, stripeSessionId))
      .limit(1);

    if (!pending) {
      return null;
    }

    const payload = pending.payload as RegistrationPayload;
    const stored = await insertRegistration(tx, payload, "paid", stripeSessionId);

    await tx
      .delete(pendingRegistrations)
      .where(eq(pendingRegistrations.stripeSessionId, stripeSessionId));

    return stored;
  });
}

export async function createMagicLink(input: {
  email: string;
  runnerId?: string;
  teamId?: string;
  path?: string;
}) {
  const token = signToken(nanoid(32));
  const db = getDb();

  await db.insert(magicLinks).values({
    token,
    email: input.email,
    runnerId: input.runnerId,
    teamId: input.teamId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  });

  return `${getAppUrl()}${input.path ?? "/dashboard"}?token=${encodeURIComponent(token)}`;
}

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function makeSuccessPath(stored: StoredRegistration) {
  const params = new URLSearchParams({
    flow: stored.flow,
    runner: stored.runnerId,
  });

  if (stored.teamId) params.set("team", stored.teamId);
  if (stored.teamCode) params.set("code", stored.teamCode);
  if (stored.paymentStatus) params.set("payment", stored.paymentStatus);

  return `/register/success?${params.toString()}`;
}

async function buildTeamPreview(teamId: string): Promise<TeamPreview> {
  const db = getDb();
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  const [runnerCount] = await db.select({ value: count() }).from(runners).where(eq(runners.teamId, teamId));
  const [captain] = await db
    .select()
    .from(runners)
    .where(and(eq(runners.teamId, teamId), eq(runners.registrationType, "captain")))
    .limit(1);

  return {
    id: team.id,
    code: team.code,
    name: team.name,
    category: team.category,
    region: team.region,
    status: team.status,
    captainName: captain ? `${captain.firstName} ${captain.lastName.charAt(0)}.` : null,
    captainEmail: captain?.email ?? null,
    runnerCount: runnerCount?.value ?? 0,
    capacity: MAX_TEAM_SIZE,
  };
}

async function insertRegistration(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  payload: RegistrationPayload,
  paymentStatus: "free" | "paid",
  stripeSessionId?: string,
): Promise<StoredRegistration> {
  if (payload.flow === "start") {
    const code = await generateTeamCode(payload.team.name);
    const [team] = await tx
      .insert(teams)
      .values({
        code,
        name: payload.team.name,
        category: payload.team.category,
        region: payload.team.region,
        freeSlot: false,
      })
      .returning();

    const [runner] = await tx
      .insert(runners)
      .values(toRunnerValues(payload, {
        teamId: team.id,
        registrationType: "captain",
        assignmentStatus: "assigned",
        paymentStatus,
        stripeSessionId,
      }))
      .returning();

    return {
      runnerId: runner.id,
      teamId: team.id,
      teamCode: team.code,
      runnerEmail: runner.email,
      flow: payload.flow,
      paymentStatus,
    };
  }

  if (payload.flow === "join") {
    const validation = await validateJoinCode(payload.teamCode, payload.runner.gender);
    if (!validation.ok) {
      throw new Error(validation.message);
    }

    const [runner] = await tx
      .insert(runners)
      .values(toRunnerValues(payload, {
        teamId: validation.team.id,
        registrationType: "team_member",
        assignmentStatus: "assigned",
        paymentStatus,
        stripeSessionId,
      }))
      .returning();

    return {
      runnerId: runner.id,
      teamId: validation.team.id,
      teamCode: validation.team.code,
      runnerEmail: runner.email,
      captainEmail: validation.team.captainEmail,
      flow: payload.flow,
      paymentStatus,
    };
  }

  const [runner] = await tx
    .insert(runners)
    .values(toRunnerValues(payload, {
      registrationType: payload.flow === "free" ? "free_agent" : "solo",
      assignmentStatus: payload.flow === "free" ? "pending_assignment" : "n/a",
      paymentStatus,
      stripeSessionId,
    }))
    .returning();

  return {
    runnerId: runner.id,
    runnerEmail: runner.email,
    flow: payload.flow,
    paymentStatus,
  };
}

function toRunnerValues(
  payload: RegistrationPayload,
  meta: {
    teamId?: string;
    registrationType: "captain" | "team_member" | "free_agent" | "solo";
    assignmentStatus: "assigned" | "pending_assignment" | "n/a";
    paymentStatus: "free" | "paid";
    stripeSessionId?: string;
  },
) {
  const runner = payload.runner;
  const ageCategory =
    payload.flow === "free"
      ? payload.preferences.ageCategory
      : payload.flow === "solo"
        ? payload.solo.ageCategory
        : "ageCategory" in runner
          ? runner.ageCategory
          : deriveAgeCategory(runner.dob);

  return {
    teamId: meta.teamId,
    registrationType: meta.registrationType,
    assignmentStatus: meta.assignmentStatus,
    firstName: runner.firstName,
    lastName: runner.lastName,
    dob: runner.dob,
    gender: runner.gender,
    email: runner.email,
    phone: runner.phone,
    nationality: runner.nationality,
    club: runner.club || null,
    coach: runner.coach || null,
    personalBestSeconds: parsePersonalBestSeconds(runner.personalBest),
    ageCategory,
    preferredRegion: payload.flow === "free" ? payload.preferences.preferredRegion || null : null,
    preferredTeammates: payload.flow === "free" ? payload.preferences.preferredTeammates || null : null,
    freeSlot: meta.paymentStatus === "free",
    paymentStatus: meta.paymentStatus,
    stripeSessionId: meta.stripeSessionId,
    consents: payload.consents,
  };
}

async function generateTeamCode(teamName: string) {
  const db = getDb();
  const slug = teamName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 14)
    .toUpperCase() || "TEAM";

  for (let i = 0; i < 5; i += 1) {
    const code = `WAW-${slug}-${nanoid(4).toUpperCase()}`;
    const existing = await db.select({ id: teams.id }).from(teams).where(eq(teams.code, code)).limit(1);
    if (!existing[0]) return code;
  }

  return `WAW-${slug}-${nanoid(8).toUpperCase()}`;
}

function genderMatchesCategory(gender: "male" | "female", category: "mens" | "womens" | "mixed") {
  if (category === "mixed") return true;
  if (category === "mens") return gender === "male";
  return gender === "female";
}

function deriveAgeCategory(dob: string) {
  const year = Number(dob.slice(0, 4));
  if (!Number.isFinite(year)) return "SEN";
  const age = new Date().getFullYear() - year;
  if (age < 12) return "U12";
  if (age < 14) return "U14";
  if (age < 16) return "U16";
  if (age < 18) return "U18";
  if (age < 20) return "U20";
  if (age < 23) return "U23";
  if (age >= 55) return "V55";
  if (age >= 40) return "M40";
  return "SEN";
}

function signToken(raw: string) {
  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) return raw;

  const signature = createHmac("sha256", secret).update(raw).digest("base64url");
  return `${raw}.${signature}`;
}

function fallbackCounters(): RegistrationCounters {
  return {
    freeSlotsClaimed: 52,
    freeSlotsRemaining: 248,
    freeSlotsTotal: EVENT.freeTier.total,
    teamsFormed: 14,
  };
}
