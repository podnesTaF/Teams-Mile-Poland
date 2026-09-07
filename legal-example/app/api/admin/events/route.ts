import { NextResponse } from "next/server";
import { addCustomEvent } from "@/lib/events-store";
import { listEvents } from "@/lib/events";
import { EVENT_TYPES, type EventRecord, type EventType } from "@/lib/types";

/**
 * POST /api/admin/events
 * Dodaje nowy dzień wydarzenia (nową datę) — realizuje wymaganie
 * „daty w dalszej kolejności dodaje/ustala administrator przez swój
 * panel narzędziowy". Chronione przez middleware.ts (ta sama ochrona
 * co reszta /admin — patrz lib/admin-auth.ts).
 *
 * Jeśli `seriesId` odpowiada istniejącej serii (np. "team-mile-poland-2026"),
 * nowy dzień dziedziczy jej `seriesName`, `eventType`, miejsce i dane
 * Organizatora — admin podaje tylko nową datę i (opcjonalnie) godzinę.
 * Jeśli `seriesId` jest nowy, admin musi podać wszystkie dane serii —
 * to pozwala też zakładać zupełnie nowe serie (np. przyszły "tournament").
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
  const b = body as Record<string, unknown>;

  const dateISO = typeof b.dateISO === "string" ? b.dateISO : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 422 });
  }

  const seriesId = typeof b.seriesId === "string" ? b.seriesId : "";
  if (!seriesId) {
    return NextResponse.json({ error: "missing_series_id" }, { status: 422 });
  }

  const existingSeries = listEvents().find((e) => e.seriesId === seriesId);

  const eventTypeRaw = b.eventType;
  const eventType: EventType | undefined = (EVENT_TYPES as string[]).includes(
    String(eventTypeRaw),
  )
    ? (eventTypeRaw as EventType)
    : existingSeries?.eventType;

  const seriesName =
    (typeof b.seriesName === "string" && b.seriesName) ||
    existingSeries?.seriesName;

  if (!eventType || !seriesName) {
    return NextResponse.json(
      { error: "missing_series_definition" },
      { status: 422 },
    );
  }

  const template: Partial<EventRecord> = existingSeries ?? {};

  const timeStart =
    (typeof b.timeStart === "string" && b.timeStart) ||
    template.timeStart ||
    "10:00";
  const venueName =
    (typeof b.venueName === "string" && b.venueName) ||
    template.venueName ||
    'Stadion "Podskarbińska"';
  const venueAddress =
    (typeof b.venueAddress === "string" && b.venueAddress) ||
    template.venueAddress ||
    "ul. Wojciecha Chrzanowskiego 23, 04-394 Warszawa";
  const city = (typeof b.city === "string" && b.city) || template.city || "Warszawa";

  const id = `${seriesId}-${dateISO}`;
  if (listEvents().some((e) => e.id === id)) {
    return NextResponse.json({ error: "event_already_exists" }, { status: 409 });
  }

  const record: EventRecord = {
    id,
    slug: id,
    eventType,
    seriesName,
    seriesId,
    dateISO,
    timeStart,
    venueName,
    venueAddress,
    city,
    status: "open",
    entryFeeFree: template.entryFeeFree ?? false,
    organizerLegalName:
      template.organizerLegalName ??
      "ACE BATTLE POLAND SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
    organizerKRS: template.organizerKRS ?? "0001229475",
    organizerNIP: template.organizerNIP ?? "5273210377",
    organizerAddress:
      template.organizerAddress ?? "ul. Pańska 96 lok. 80, 00-837 Warszawa",
    organizerEmail: template.organizerEmail ?? "info@poland.acebattle.run",
    organizerPhone: template.organizerPhone ?? "+48 576 696 078",
    isCustom: true,
  };

  addCustomEvent(record);
  return NextResponse.json({ ok: true, event: record });
}

export function GET() {
  return NextResponse.json({ events: listEvents() });
}
