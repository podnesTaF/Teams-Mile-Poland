"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EventRecord, EventType } from "@/lib/types";
import { EVENT_TYPES } from "@/lib/types";

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  individual: "Bieg indywidualny",
  team: "TEAM MILE (drużynowy)",
  tournament: "Turniej / mecz",
  league: "Liga",
};

/**
 * Formularz dodawania nowego dnia wydarzenia. Jeśli wybrana seria już
 * istnieje (np. "team-mile-poland-2026"), wystarczy podać samą datę —
 * miejsce, rodzaj wydarzenia i dane Organizatora są dziedziczone z
 * istniejącej edycji tej samej serii (patrz app/api/admin/events/route.ts).
 * Dla zupełnie nowej serii trzeba dodatkowo podać jej nazwę i rodzaj.
 */
export function AdminAddEventForm({ series }: { series: EventRecord[] }) {
  const router = useRouter();
  const uniqueSeries = Array.from(
    new Map(series.map((e) => [e.seriesId, e])).values(),
  );

  const [seriesId, setSeriesId] = useState(uniqueSeries[0]?.seriesId ?? "__new__");
  const [dateISO, setDateISO] = useState("");
  const [timeStart, setTimeStart] = useState("10:00");
  const [newSeriesName, setNewSeriesName] = useState("");
  const [newEventType, setNewEventType] = useState<EventType>("tournament");
  const [venueName, setVenueName] = useState('Stadion "Podskarbińska"');
  const [venueAddress, setVenueAddress] = useState(
    "ul. Wojciecha Chrzanowskiego 23, 04-394 Warszawa",
  );
  const [city, setCity] = useState("Warszawa");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNewSeries = seriesId === "__new__";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: Record<string, unknown> = {
      dateISO,
      timeStart,
      seriesId: isNewSeries
        ? newSeriesName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "") || `series-${Date.now()}`
        : seriesId,
    };
    if (isNewSeries) {
      payload.seriesName = newSeriesName;
      payload.eventType = newEventType;
      payload.venueName = venueName;
      payload.venueAddress = venueAddress;
      payload.city = city;
    }

    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Nie udało się dodać wydarzenia.");
        setSubmitting(false);
        return;
      }
      setDateISO("");
      setSubmitting(false);
      router.refresh();
    } catch {
      setError("Błąd sieci — spróbuj ponownie.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5 sm:p-6">
      <h2 className="font-display text-lg uppercase tracking-tight">
        Dodaj nowy dzień wydarzenia
      </h2>

      <div>
        <label className="field-label">Seria</label>
        <select
          value={seriesId}
          onChange={(e) => setSeriesId(e.target.value)}
          className="field-input"
        >
          {uniqueSeries.map((s) => (
            <option key={s.seriesId} value={s.seriesId}>
              {s.seriesName}
            </option>
          ))}
          <option value="__new__">+ Nowa seria…</option>
        </select>
      </div>

      {isNewSeries && (
        <div className="space-y-4 rounded-xl border border-brand-border bg-white/5 p-4">
          <div>
            <label className="field-label">Nazwa nowej serii</label>
            <input
              value={newSeriesName}
              onChange={(e) => setNewSeriesName(e.target.value)}
              placeholder="np. ACE BATTLE RUN — City League Warszawa"
              className="field-input"
              required
            />
          </div>
          <div>
            <label className="field-label">Rodzaj wydarzenia</label>
            <select
              value={newEventType}
              onChange={(e) => setNewEventType(e.target.value as EventType)}
              className="field-input"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EVENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">Obiekt</label>
              <input
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Miasto</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="field-input"
              />
            </div>
          </div>
          <div>
            <label className="field-label">Adres obiektu</label>
            <input
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              className="field-input"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label">Data</label>
          <input
            type="date"
            value={dateISO}
            onChange={(e) => setDateISO(e.target.value)}
            className="field-input"
            required
          />
        </div>
        <div>
          <label className="field-label">Godzina startu</label>
          <input
            type="time"
            value={timeStart}
            onChange={(e) => setTimeStart(e.target.value)}
            className="field-input"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-brand-error/40 bg-brand-error/10 p-3 text-sm text-brand-error">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? "Dodawanie…" : "Dodaj dzień wydarzenia"}
      </button>
    </form>
  );
}
