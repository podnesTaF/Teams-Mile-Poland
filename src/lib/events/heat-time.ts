/**
 * Wall-clock ↔ instant conversion for heat start times.
 *
 * A heat's `scheduledAt` is a `timestamptz` — an instant — but everyone who
 * touches it (the admin typing it, the marshal reading the printout, the runner
 * reading the email) thinks in Warsaw wall-clock. These helpers are the single
 * place that translation happens, so a `datetime-local` input and the stored
 * instant can never disagree about which clock they mean.
 *
 * The offset is resolved per instant rather than hardcoded to CEST: the series is
 * an August one today, but a stored heat time must not shift if that changes.
 */

const TZ = "Europe/Warsaw";

const LOCAL_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const OFFSET_NAME = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  timeZoneName: "longOffset",
});

/** Wall-clock display: "10:15". */
const TIME_ONLY = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** Warsaw's offset from UTC at a given instant, in minutes east. */
function offsetMinutesAt(instant: Date): number {
  // "GMT+02:00" — or plain "GMT" at a zero offset, which no European zone has.
  const name = part(OFFSET_NAME.formatToParts(instant), "timeZoneName");
  const match = name.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * A `datetime-local` value in Warsaw wall-clock ("2026-08-01T10:15") as the
 * instant it denotes, or `null` if it is not a well-formed value.
 *
 * The offset depends on the instant, which depends on the offset — so the naive
 * reading is corrected once, which settles every case except a wall-clock time
 * inside the hour a spring-forward skips (where any answer is a guess).
 */
export function warsawLocalToInstant(local: string): Date | null {
  const match = local.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const naive = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  const guess = offsetMinutesAt(new Date(naive));
  const settled = offsetMinutesAt(new Date(naive - guess * 60_000));
  const instant = new Date(naive - settled * 60_000);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** An instant as a Warsaw wall-clock `datetime-local` value ("2026-08-01T10:15"). */
export function instantToWarsawLocal(instant: Date): string {
  const parts = LOCAL_PARTS.formatToParts(instant);
  const date = `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`;
  return `${date}T${part(parts, "hour")}:${part(parts, "minute")}`;
}

/** Warsaw wall-clock time of an instant, "10:15". */
export function formatHeatTime(instant: Date): string {
  return TIME_ONLY.format(instant);
}
