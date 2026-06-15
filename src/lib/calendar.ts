/**
 * Calendar helpers for the event. Used by lifecycle emails ("Add to Google
 * Calendar").
 *
 * The event is a single fixed-date day in Warsaw. Google deep-links use local
 * time + an explicit timezone parameter.
 */
import { EVENT } from "@/lib/marketing/event";

const TZ = "Europe/Warsaw";

const START = { h: 9, m: 0 };
const END = { h: 15, m: 30 };

export const CALENDAR_TITLE = EVENT.name;
export const CALENDAR_LOCATION = `${EVENT.venue.name}, ${EVENT.venue.address}, ${EVENT.venue.postal} ${EVENT.venue.city}, ${EVENT.venue.country}`;
export const CALENDAR_DETAILS =
  "Individual & team rating mile races. Bring your QR ticket, sportswear and running shoes. See you on the start line!";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "20260627" */
function ymd() {
  return EVENT.date.replace(/-/g, "");
}

/** Local wall-clock "HHMMSS" (for Google deep-link + ctz). */
function localHms(t: { h: number; m: number }) {
  return `${pad(t.h)}${pad(t.m)}00`;
}

/** "Add to Google Calendar" link — opens a pre-filled event. */
export function googleCalendarUrl(): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: CALENDAR_TITLE,
    dates: `${ymd()}T${localHms(START)}/${ymd()}T${localHms(END)}`,
    ctz: TZ,
    details: CALENDAR_DETAILS,
    location: CALENDAR_LOCATION,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
