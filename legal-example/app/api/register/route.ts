import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getEventById } from "@/lib/events";
import { getRegisterContent, isLocale } from "@/content/dictionaries";
import { buildConsentSchema } from "@/lib/validation";
import { appendSubmission } from "@/lib/submissions-store";

/**
 * POST /api/register
 * Odpowiednik /api/consent, ale dla UJEDNOLICONEGO formularza rejestracji
 * (/register) — waliduje względem konfiguracji odpowiedniej dla RODZAJU
 * WYBRANEGO WYDARZENIA (`dict.register` dla "individual",
 * `dict.registerTeam` dla "team" — patrz content/dictionaries.ts →
 * getRegisterContent), a nie pojedynczego dokumentu z `dict.documents`.
 *
 * Zapisany rekord ma `docSlug: "registration"` — panel administratora
 * (`/admin/submissions/[id]`) rozpoznaje tę wartość, odczytuje rodzaj
 * wydarzenia z `eventId` i renderuje z niego WSZYSTKIE wypełnione
 * dokumenty właściwe dla tego rodzaju wydarzenia, na podstawie tych
 * samych danych uczestnika i tej samej daty podpisania.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const bodyRecord = body as Record<string, unknown>;
  const localeRaw = bodyRecord.locale;
  const locale = isLocale(String(localeRaw)) ? String(localeRaw) : "pl";

  // Rodzaj wydarzenia (individual/team) decyduje, względem której
  // konfiguracji (dict.register vs dict.registerTeam) walidujemy —
  // dlatego wydarzenie musi zostać znalezione PRZED zbudowaniem schematu.
  const eventIdRaw = bodyRecord.eventId;
  const event =
    typeof eventIdRaw === "string" ? getEventById(eventIdRaw) : undefined;
  if (!event) {
    return NextResponse.json({ error: "unknown_event" }, { status: 400 });
  }

  const doc = getRegisterContent(locale, event.eventType);
  const schema = buildConsentSchema(doc);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const record = {
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null,
    userAgent: req.headers.get("user-agent"),
    ...parsed.data,
    docSlug: "registration",
  };

  appendSubmission(record);
  console.log("[register] new submission", record.id, event.eventType);

  const webhook = process.env.CONSENT_STORAGE_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
    } catch (err) {
      console.error("[register] webhook delivery failed", err);
    }
  }

  return NextResponse.json({ ok: true, id: record.id });
}
