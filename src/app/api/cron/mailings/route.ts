import { runDueMailings } from "@/features/mailings/dispatch";

// Secured cron endpoint. Wire to Vercel Cron (see vercel.json) — Vercel adds
// `Authorization: Bearer $CRON_SECRET` automatically — or any external
// scheduler using `?secret=` / the Authorization header.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  }

  const url = new URL(req.url);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const provided = bearer ?? url.searchParams.get("secret");
  if (provided !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const summaries = await runDueMailings(new Date());
  return Response.json({ ok: true, ranAt: new Date().toISOString(), summaries });
}
