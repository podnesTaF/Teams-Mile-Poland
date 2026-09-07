import { listSubmissionsSorted } from "@/lib/submissions-store";
import { getEventById } from "@/lib/events";
import { getAnyDocumentTitle } from "@/content/dictionaries";
import { formatDateTimeWarsaw } from "@/lib/fill-legal-template";
import { LOCALE_META } from "@/content/locales-meta";
import { AdminSubmissionsTable, type AdminSubmissionRow } from "@/components/AdminSubmissionsTable";
import type { EventType, Locale } from "@/lib/types";

export const dynamic = "force-dynamic"; // zawsze świeże dane z magazynu zgłoszeń

export default function AdminDashboardPage() {
  const submissions = listSubmissionsSorted();

  const rows: AdminSubmissionRow[] = submissions.map((s) => {
    const event = getEventById(s.eventId);
    const locale = (
      ["pl", "en", "ua", "ru"].includes(s.locale) ? s.locale : "pl"
    ) as Locale;
    const eventType: EventType = event?.eventType ?? "individual";
    const doc = getAnyDocumentTitle(locale, s.docSlug, eventType);
    const checkboxValues = Object.values(s.checkboxes);

    return {
      id: s.id,
      receivedAtLabel: formatDateTimeWarsaw(s.receivedAt),
      participantName: s.fields.fullName || "—",
      eventLabel: event
        ? `${new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw" }).format(new Date(`${event.dateISO}T00:00:00Z`))} · ${event.venueName}`
        : s.eventId,
      docTitle: doc,
      localeShort: LOCALE_META[locale].short,
      agreedCount: checkboxValues.filter(Boolean).length,
      agreedTotal: checkboxValues.length,
    };
  });

  return (
    <div>
      <span className="eyebrow">Tablica potwierdzeń</span>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-tight">
        Zgłoszenia uczestników
      </h1>
      <p className="mt-2 max-w-2xl text-brand-textMuted">
        Wszystkie przesłane rejestracje — najnowsze na górze. Zaznacz
        checkboxy, żeby wydrukować / zapisać jako PDF kilka zgłoszeń naraz,
        albo kliknij pojedynczy wiersz, żeby zobaczyć je osobno.
      </p>

      {submissions.length === 0 ? (
        <div className="card mt-8 p-8 text-center text-brand-textMuted">
          Brak zgłoszeń — pojawią się tutaj automatycznie po przesłaniu
          pierwszego formularza przez uczestnika.
        </div>
      ) : (
        <div className="mt-8">
          <AdminSubmissionsTable rows={rows} />
        </div>
      )}
    </div>
  );
}
