import { buildIcs } from "@/lib/calendar";

// Downloadable iCalendar feed for the event. Linked from lifecycle emails.
export function GET() {
  const ics = buildIcs(new Date());
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="teams-mile-warsaw.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
