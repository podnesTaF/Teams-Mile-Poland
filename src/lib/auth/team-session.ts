import { cookies } from "next/headers";

import { signSessionPayload, verifySessionPayload } from "./session";

export type TeamRole = "captain" | "member";

export type TeamSession = {
  teamId: string;
  teamCode: string;
  email: string;
  runnerId: string;
  role: TeamRole;
  exp: number;
};

const COOKIE_NAME = "tm_team_session";
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export async function getTeamSession(): Promise<TeamSession | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  const payload = verifySessionPayload<TeamSession>(raw);
  if (!payload) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function setTeamSession(
  data: Omit<TeamSession, "exp">,
  maxAgeSeconds: number = THIRTY_DAYS_SECONDS,
) {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const signed = signSessionPayload<TeamSession>({ ...data, exp });
  const store = await cookies();
  store.set(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearTeamSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
