import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionValue } from "@/lib/admin-auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const code =
    body && typeof (body as Record<string, unknown>).code === "string"
      ? ((body as Record<string, unknown>).code as string)
      : "";

  if (!isValidAdminSessionValue(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 godzin
  });
  return res;
}
