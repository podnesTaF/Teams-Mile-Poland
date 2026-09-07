import { listEvents } from "@/lib/events";
import { AdminAddEventForm } from "@/components/AdminAddEventForm";
import { AdminDeleteEventButton } from "@/components/AdminDeleteEventButton";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "long",
    timeZone: "Europe/Warsaw",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * Panel zarządzania wydarzeniami — realizuje wymaganie „daty w dalszej
 * kolejności dodaje/ustala administrator przez swój panel narzędziowy".
 *
 * Wydarzenia wbudowane (z lib/events.ts) są tu tylko do podglądu —
 * usuwać i dodawać można wyłącznie dni zapisane w lib/events-store.ts
 * (`.data/events.json`), żeby nie dało się przypadkowo skasować bazowej
 * listy startowej z kodu źródłowego.
 */
export default function AdminEventsPage() {
  const events = listEvents();
  const bySeriesId = new Map<string, typeof events>();
  for (const ev of events) {
    const list = bySeriesId.get(ev.seriesId) ?? [];
    list.push(ev);
    bySeriesId.set(ev.seriesId, list);
  }

  return (
    <div>
      <span className="eyebrow">Zarządzanie kalendarzem</span>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-tight">
        Wydarzenia
      </h1>
      <p className="mt-2 max-w-2xl text-brand-textMuted">
        Wszystkie serie i ich dni startowe widoczne w formularzach uczestnika.
        Nowe dni (np. kolejna edycja TEAM MILE POLAND albo zupełnie nowa
        seria — turniej, liga) dodajesz poniżej; pojawią się od razu w
        selektorze wydarzenia na stronie.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr,1fr]">
        <div className="space-y-6">
          {Array.from(bySeriesId.entries()).map(([seriesId, evs]) => {
            const first = evs[0];
            if (!first) return null;
            return (
            <div key={seriesId} className="card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg uppercase tracking-tight">
                  {first.seriesName}
                </h2>
                <span className="rounded-pill border border-brand-border px-2 py-0.5 text-xs font-bold uppercase text-brand-textMuted">
                  {first.eventType}
                </span>
              </div>
              <p className="mt-1 text-xs text-brand-textMuted">
                {first.venueName} · {first.venueAddress}
              </p>
              <ul className="mt-4 divide-y divide-brand-border/60">
                {evs
                  .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
                  .map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div>
                        <span className="font-semibold">
                          {formatDate(ev.dateISO)}
                        </span>
                        <span className="ml-2 text-brand-textMuted">
                          {ev.timeStart}
                        </span>
                        {ev.isCustom && (
                          <span className="ml-2 rounded-pill bg-brand-accentSoft px-2 py-0.5 text-[10px] font-bold uppercase text-brand-accent">
                            dodane ręcznie
                          </span>
                        )}
                      </div>
                      {ev.isCustom ? (
                        <AdminDeleteEventButton id={ev.id} />
                      ) : (
                        <span className="text-xs text-brand-textMuted">
                          wbudowane
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
            );
          })}
        </div>

        <div>
          <AdminAddEventForm series={events} />
        </div>
      </div>
    </div>
  );
}
