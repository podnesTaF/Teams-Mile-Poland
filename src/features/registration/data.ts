import { createHmac } from "node:crypto";

import { and, count, eq, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { magicLinks, pendingRegistrations, runners, slotCounter, teams } from "@/db/schema";
import { getAppUrl } from "@/lib/app-url";
import { getDb } from "@/lib/db";
import { EVENT } from "@/lib/marketing/event";

import {
  normalizeTeamCode,
  type RegistrationPayload,
} from "./schemas";

export { getAppUrl } from "@/lib/app-url";

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
  size: number | null;
  status: "open" | "locked" | "final" | "cancelled";
  captainName: string | null;
  captainEmail: string | null;
  runnerCount: number;
  capacity: number;
};

export type JoinValidation =
  | { ok: true; team: TeamPreview }
  | { ok: false; reason: "missing" | "locked" | "full"; message: string; team?: TeamPreview };

export type StoredRegistration = {
  runnerId: string;
  teamId?: string;
  teamCode?: string;
  teamName?: string;
  runnerEmail: string;
  fullName: string;
  phone: string;
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

export async function validateJoinCode(code: string): Promise<JoinValidation> {
  const normalized = normalizeTeamCode(code);
  const db = getDb();
  const [team] = await db.select().from(teams).where(eq(teams.code, normalized)).limit(1);

  if (!team) {
    return {
      ok: false,
      reason: "missing",
      message: "Invalid invite link.",
    };
  }

  const preview = await buildTeamPreview(team.id);

  if (team.status !== "open") {
    return {
      ok: false,
      reason: "locked",
      message: `${team.name} is not accepting runners right now.`,
      team: preview,
    };
  }

  const cap = team.size ?? MAX_TEAM_SIZE;
  if (preview.runnerCount >= cap) {
    return {
      ok: false,
      reason: "full",
      message: `${team.name} is already full.`,
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

export function makeInviteUrl(teamCode: string) {
  return `${getAppUrl()}/join/${encodeURIComponent(teamCode)}`;
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
    size: team.size,
    status: team.status,
    captainName: captain ? shortCaptainName(captain.fullName) : null,
    captainEmail: captain?.email ?? null,
    runnerCount: runnerCount?.value ?? 0,
    capacity: team.size ?? MAX_TEAM_SIZE,
  };
}

async function insertRegistration(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  payload: RegistrationPayload,
  paymentStatus: "free" | "paid",
  stripeSessionId?: string,
): Promise<StoredRegistration> {
  if (payload.flow === "start") {
    const code = await generateTeamCode(payload.teamName);
    const [team] = await tx
      .insert(teams)
      .values({
        code,
        name: payload.teamName,
        size: payload.teamSize,
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
      teamName: team.name,
      runnerEmail: runner.email,
      fullName: runner.fullName,
      phone: runner.phone,
      flow: payload.flow,
      paymentStatus,
    };
  }

  if (payload.flow === "join") {
    const validation = await validateJoinCode(payload.teamCode);
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
      teamName: validation.team.name,
      runnerEmail: runner.email,
      fullName: runner.fullName,
      phone: runner.phone,
      captainEmail: validation.team.captainEmail,
      flow: payload.flow,
      paymentStatus,
    };
  }

  // flow === "free" — quick register, pending team assignment.
  const [runner] = await tx
    .insert(runners)
    .values(toRunnerValues(payload, {
      registrationType: "free_agent",
      assignmentStatus: "pending_assignment",
      paymentStatus,
      stripeSessionId,
    }))
    .returning();

  return {
    runnerId: runner.id,
    runnerEmail: runner.email,
    fullName: runner.fullName,
    phone: runner.phone,
    flow: payload.flow,
    paymentStatus,
  };
}

function toRunnerValues(
  payload: RegistrationPayload,
  meta: {
    teamId?: string;
    registrationType: "captain" | "team_member" | "free_agent";
    assignmentStatus: "assigned" | "pending_assignment" | "n/a";
    paymentStatus: "free" | "paid";
    stripeSessionId?: string;
  },
) {
  const { person, terms } = payload;
  return {
    teamId: meta.teamId,
    registrationType: meta.registrationType,
    assignmentStatus: meta.assignmentStatus,
    fullName: person.fullName,
    email: person.email,
    phone: person.phone,
    locale: payload.locale,
    terms,
    freeSlot: meta.paymentStatus === "free",
    paymentStatus: meta.paymentStatus,
    stripeSessionId: meta.stripeSessionId,
  };
}

async function generateTeamCode(teamName: string) {
  const db = getDb();
  const slug = teamName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
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

function shortCaptainName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return fullName;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
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
