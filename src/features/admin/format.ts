/** Shared admin timestamp format — one instance, reused across table rows. */
const ADMIN_DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatAdminDateTime(date: Date | null): string {
  return date ? ADMIN_DATE_TIME.format(date) : "—";
}
