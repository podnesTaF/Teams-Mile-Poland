"use client";

import { useMemo, useState } from "react";
import type { EventRecord, Locale } from "@/lib/types";
import type { CommonDictionary } from "@/content/types";
import { LOCALE_META } from "@/content/locales-meta";

const STATUS_KEY: Record<
  EventRecord["status"],
  keyof CommonDictionary["eventCard"]
> = {
  open: "statusOpen",
  soon: "statusSoon",
  closed: "statusClosed",
  finished: "statusFinished",
};

function formatDate(iso: string, locale: Locale) {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(LOCALE_META[locale].htmlLang, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(date);
}

/**
 * Karta wydarzenia — dane (data, miejsce, nazwa serii) pochodzą z
 * przekazanej listy `events` (odpowiedź /api/events, czyli „bazy danych").
 * Komponent NIE zawiera żadnych zahardkodowanych dat ani nazw: jeśli
 * organizator doda nową edycję lub całkiem nową serię (np. nowy format
 * turniejowy) do bazy, karta automatycznie zaproponuje ją w selektorze.
 *
 * Lista `events` może zawierać KILKA serii naraz (np. indywidualny cykl
 * i TEAM MILE POLAND) — przełącznik "Wybierz inną" grupuje je po
 * `seriesName`, żeby uczestnik widział, że zmienia nie tylko datę, ale
 * też — jeśli wybierze pozycję z innej grupy — cały format wydarzenia
 * (a wraz z nim: komplet dokumentów do podpisania).
 */
export function EventInfoCard({
  locale,
  dict,
  events,
  selectedEventId,
  onChange,
}: {
  locale: Locale;
  dict: CommonDictionary;
  events: EventRecord[];
  selectedEventId: string;
  onChange: (eventId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? events[0],
    [events, selectedEventId],
  );

  const groups = useMemo(() => {
    const map = new Map<string, EventRecord[]>();
    for (const ev of events) {
      const list = map.get(ev.seriesName) ?? [];
      list.push(ev);
      map.set(ev.seriesName, list);
    }
    return Array.from(map.entries());
  }, [events]);

  if (!selected) return null;

  const c = dict.eventCard;

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">{c.label}</span>
        <span
          className={`rounded-pill px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            selected.status === "open"
              ? "bg-brand-accentSoft text-brand-accent"
              : "bg-white/5 text-brand-textMuted"
          }`}
        >
          {dict.eventCard[STATUS_KEY[selected.status]]}
        </span>
      </div>

      <h3 className="mt-3 font-display text-xl leading-snug sm:text-2xl">
        {selected.seriesName}
      </h3>

      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-textMuted">
            {c.dateLabel}
          </dt>
          <dd className="mt-1 font-display text-lg">
            {formatDate(selected.dateISO, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-brand-textMuted">
            {c.venueLabel}
          </dt>
          <dd className="mt-1 text-sm leading-snug">
            {selected.venueName}
            <br />
            <span className="text-brand-textMuted">
              {selected.venueAddress}
            </span>
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-brand-border pt-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm font-semibold text-brand-accent underline decoration-dotted underline-offset-4"
          aria-expanded={open}
        >
          {c.switchEvent}
        </button>

        {open && (
          <div className="mt-3 space-y-4">
            {groups.map(([seriesName, evs]) => (
              <div key={seriesName}>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-brand-textMuted">
                  {seriesName}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {evs.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => {
                        onChange(ev.id);
                        setOpen(false);
                      }}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                        ev.id === selected.id
                          ? "border-brand-accent bg-brand-accentSoft"
                          : "border-brand-border bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <span className="block font-semibold">
                        {formatDate(ev.dateISO, locale)}
                      </span>
                      <span className="block text-xs text-brand-textMuted">
                        {ev.venueName} · {dict.eventCard[STATUS_KEY[ev.status]]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
