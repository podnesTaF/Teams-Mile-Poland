import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getEventById } from "@/lib/events";
import { getDocumentContent, isLocale } from "@/content/dictionaries";
import { buildConsentSchema } from "@/lib/validation";
import { DOCUMENT_SLUGS, type DocumentSlug } from "@/lib/types";
import { appendSubmission } from "@/lib/submissions-store";

function isDocumentSlug(value: unknown): value is DocumentSlug {
  return (
    typeof value === "string" &&
    (DOCUMENT_SLUGS as string[]).includes(value)
  );
}

/**
 * POST /api/consent
 * Waliduje i zapisuje potwierdzenie uczestnika dla wybranego dokumentu
 * i wydarzenia. Zapis trafia do lokalnego magazynu deweloperskiego
 * (lib/submissions-store.ts) — dzięki temu panel /admin ma co pokazać
 * już teraz, bez czekania na podłączenie docelowej bazy danych.
 *
 * DO ZROBIENIA PRZED WDROŻENIEM PRODUKCYJNYM:
 *  1. Podmienić lib/submissions-store.ts na prawdziwą bazę danych —
 *     zapis do pliku na dysku nie jest trwały na hostingach
 *     bezserwerowych (patrz komentarz w tym pliku).
 *  2. Rozważyć uwierzytelnianie (np. token sesji rejestracji) zamiast
 *     opcjonalnego CONSENT_API_TOKEN.
 *  3. Dodać rate limiting / ochronę przed botami (np. hCaptcha na froncie).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("docSlug" in body) ||
    !isDocumentSlug((body as Record<string, unknown>).docSlug)
  ) {
    return NextResponse.json({ error: "invalid_document" }, { status: 400 });
  }

  const docSlug = (body as Record<string, unknown>).docSlug as DocumentSlug;
  const localeRaw = (body as Record<string, unknown>).locale;
  const locale = isLocale(String(localeRaw)) ? String(localeRaw) : "pl";

  const doc = getDocumentContent(locale, docSlug);
  const schema = buildConsentSchema(doc);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const event = getEventById(parsed.data.eventId);
  if (!event) {
    return NextResponse.json({ error: "unknown_event" }, { status: 400 });
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
  };

  appendSubmission(record);
  console.log("[consent] new submission", record.id, record.docSlug);

  const webhook = process.env.CONSENT_STORAGE_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
    } catch (err) {
      console.error("[consent] webhook delivery failed", err);
      // Nie blokujemy odpowiedzi do uczestnika z powodu błędu webhooka —
      // dane i tak trafiły do magazynu deweloperskiego powyżej.
    }
  }

  return NextResponse.json({ ok: true, id: record.id });
}
