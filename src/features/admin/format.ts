/** Shared admin timestamp format — one instance, reused across table rows. */
const ADMIN_DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatAdminDateTime(date: Date | null): string {
  return date ? ADMIN_DATE_TIME.format(date) : "—";
}

/**
 * "1 bib" / "3 bibs" — admin feedback reads as sentences about things, so the
 * count and its noun are formatted together wherever they appear (the desk
 * copy, the flash registry, the heat builder's own labels).
 */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
