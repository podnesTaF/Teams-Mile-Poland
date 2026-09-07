import { NextResponse } from "next/server";
import { listEvents } from "@/lib/events";

/**
 * GET /api/events
 * Zwraca listę wydarzeń do wypełnienia karty w formularzu i do selektora
 * "To nie ta edycja? Wybierz inną". W produkcji: podmienić listEvents()
 * (lib/events.ts) na zapytanie do prawdziwej bazy danych organizatora.
 */
export async function GET() {
  const events = listEvents();
  return NextResponse.json({ events });
}
