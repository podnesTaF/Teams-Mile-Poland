/**
 * Calendar helpers for the event. Used by lifecycle emails ("Add to Google
 * Calendar" / "Download .ics") and the /api/calendar route.
 *
 * The event is a single fixed-date day in Warsaw. June 27 falls in CEST
 * (UTC+2), so we emit unambiguous UTC ("Z") times in the .ics and skip a
 * VTIMEZONE block entirely. Google/Outlook deep-links use local time + an
 * explicit timezone parameter instead.
 */
import { EVENT } from "@/lib/marketing/event";

const TZ = "Europe/Warsaw";
const CEST_OFFSET_HOURS = 2; // Warsaw summer offset (event is in late June)

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

/** UTC "YYYYMMDDTHHMMSSZ" for a given local time on the event date. */
function utcStamp(t: { h: number; m: number }) {
  return `${ymd()}T${pad(t.h - CEST_OFFSET_HOURS)}${pad(t.m)}00Z`;
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

/** "Add to Outlook Calendar" deep-link. */
export function outlookCalendarUrl(): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: CALENDAR_TITLE,
    startdt: `${EVENT.date}T${pad(START.h)}:${pad(START.m)}:00`,
    enddt: `${EVENT.date}T${pad(END.h)}:${pad(END.m)}:00`,
    location: CALENDAR_LOCATION,
    body: CALENDAR_DETAILS,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function escIcs(value: string) {
  return value.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

/**
 * A downloadable .ics with calendar reminders at −7d / −3d / −1d / −2h,
 * matching the spec's "automatic calendar reminders".
 * `now` feeds DTSTAMP (pass the request time).
 */
export function buildIcs(now: Date): string {
  const dtstamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const alarm = (trigger: string) =>
    ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escIcs(CALENDAR_TITLE)}`, `TRIGGER:${trigger}`, "END:VALARM"];

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ACE BATTLE//Warsaw//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:teams-mile-warsaw-2026@acebattle.run",
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${utcStamp(START)}`,
    `DTEND:${utcStamp(END)}`,
    `SUMMARY:${escIcs(CALENDAR_TITLE)}`,
    `DESCRIPTION:${escIcs(CALENDAR_DETAILS)}`,
    `LOCATION:${escIcs(CALENDAR_LOCATION)}`,
    ...alarm("-P7D"),
    ...alarm("-P3D"),
    ...alarm("-P1D"),
    ...alarm("-PT2H"),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
