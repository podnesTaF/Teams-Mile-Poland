import { cookies } from "next/headers";

import { signSessionPayload, verifySessionPayload } from "./session";

export type AdminSession = {
  admin: true;
  exp: number;
};

const COOKIE_NAME = "tm_admin_session";
const TTL_SECONDS = 60 * 60 * 12; // 12h

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  const payload = verifySessionPayload<AdminSession>(raw);
  if (!payload || payload.admin !== true) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function setAdminSession(maxAgeSeconds: number = TTL_SECONDS) {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const signed = signSessionPayload<AdminSession>({ admin: true, exp });
  const store = await cookies();
  store.set(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
