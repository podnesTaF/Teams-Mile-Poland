import { createHash } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";

import { magicLinks } from "@/db/schema";
import { getDb } from "@/lib/db";

import { LOGIN_TOKEN_TTL_MS } from "./constants";
import { normalizeEmail } from "./data";

export function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export type CreatedMagicLink = {
  rawToken: string;
  expiresAt: Date;
};

export async function createLoginMagicLink(input: {
  teamId: string;
  email: string;
  runnerId: string;
}): Promise<CreatedMagicLink> {
  const rawToken = nanoid(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + LOGIN_TOKEN_TTL_MS);

  const db = getDb();
  await db.insert(magicLinks).values({
    token: tokenHash,
    email: normalizeEmail(input.email),
    teamId: input.teamId,
    runnerId: input.runnerId,
    expiresAt,
  });

  return { rawToken, expiresAt };
}

export type ConsumeResult =
  | { ok: true; teamId: string; runnerId: string; email: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "team_mismatch" };

export async function consumeMagicLink(input: {
  rawToken: string;
  expectedTeamId: string;
}): Promise<ConsumeResult> {
  const tokenHash = hashToken(input.rawToken);
  const db = getDb();

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(magicLinks)
      .where(and(eq(magicLinks.token, tokenHash), isNull(magicLinks.usedAt)))
      .limit(1);

    if (!row) return { ok: false, reason: "invalid" as const };
    if (row.expiresAt.getTime() < Date.now()) {
      return { ok: false, reason: "expired" as const };
    }
    if (row.teamId !== input.expectedTeamId) {
      return { ok: false, reason: "team_mismatch" as const };
    }
    if (!row.runnerId) {
      return { ok: false, reason: "invalid" as const };
    }

    const updated = await tx
      .update(magicLinks)
      .set({ usedAt: new Date() })
      .where(and(eq(magicLinks.token, tokenHash), isNull(magicLinks.usedAt)))
      .returning({ token: magicLinks.token });

    if (updated.length === 0) {
      return { ok: false, reason: "used" as const };
    }

    return {
      ok: true,
      teamId: row.teamId!,
      runnerId: row.runnerId,
      email: row.email,
    };
  });
}
