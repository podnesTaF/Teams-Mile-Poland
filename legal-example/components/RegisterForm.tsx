"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EventRecord, EventType, Locale } from "@/lib/types";
import type { CommonDictionary } from "@/content/types";
import { getRegisterContent } from "@/content/dictionaries";
import { buildConsentSchema } from "@/lib/validation";
import { EventInfoCard } from "./EventInfoCard";
import { TextField } from "./TextField";
import { CheckboxField } from "./CheckboxField";
import { ImageConsentField } from "./ImageConsentField";

type SubmitState = "idle" | "submitting" | "success" | "error";

/**
 * Jeden, ujednolicony formularz rejestracji — układ dwukolumnowy zgodny
 * z referencyjnym makietem: LEWA kolumna = dane uczestnika + wydarzenie,
 * PRAWA kolumna = wymagane potwierdzenia + zgoda na wizerunek + wysyłka.
 *
 * Wysyła do /api/register (nie /api/consent) — walidowane względem
 * konfiguracji odpowiedniej dla RODZAJU WYBRANEGO WYDARZENIA:
 *  - "individual" -> dict.register (Oświadczenie, Przepisy, RODO),
 *  - "team" -> dict.registerTeam (Oświadczenie, Regulamin, Zasady TEAM
 *    MILE, RODO — plus nazwa drużyny i rola RACER/ACE/JOKER).
 * Backend zapisuje jedno zgłoszenie i generuje z niego wszystkie
 * wypełnione dokumenty właściwe dla tego rodzaju wydarzenia (patrz
 * panel administratora).
 */
export function RegisterForm({
  locale,
  dict,
  events,
  initialEventId,
}: {
  locale: Locale;
  dict: CommonDictionary;
  events: EventRecord[];
  initialEventId: string;
}) {
  const [eventId, setEventId] = useState(initialEventId);
  const selectedEvent = events.find((e) => e.id === eventId) ?? events[0];
  const eventType: EventType = selectedEvent?.eventType ?? "individual";

  const doc = useMemo(
    () => getRegisterContent(locale, eventType),
    [locale, eventType],
  );

  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(doc.fields.map((f) => [f.name, ""])),
  );
  const [checkboxes, setCheckboxes] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(doc.checkboxes.map((c) => [c.id, false])),
  );
  const [imageConsent, setImageConsent] = useState<
    "agree" | "disagree" | null
  >(null);
  const [showPrizeFields, setShowPrizeFields] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<SubmitState>("idle");

  // Gdy zmiana wybranego wydarzenia oznacza zmianę RODZAJU wydarzenia
  // (np. z indywidualnego na TEAM MILE), zestaw pól/zgód jest inny —
  // resetujemy stan formularza, żeby nie zostały „osierocone" wartości
  // z poprzedniego kompletu pól.
  useEffect(() => {
    setFields(Object.fromEntries(doc.fields.map((f) => [f.name, ""])));
    setCheckboxes(
      Object.fromEntries(doc.checkboxes.map((c) => [c.id, false])),
    );
    setImageConsent(null);
    setShowPrizeFields(false);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType]);

  const schema = useMemo(() => buildConsentSchema(doc), [doc]);

  const visibleFields = doc.fields.filter(
    (f) => f.conditional !== "prizeWinner" || showPrizeFields,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      eventId,
      locale,
      docSlug: "registration",
      fields,
      checkboxes,
      imageConsent: imageConsent ?? undefined,
    };

    const result = schema.safeParse(payload);
    if (!result.success) {
      const nextErrors: Record<string, boolean> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[issue.path.length - 1];
        if (typeof key === "string") nextErrors[key] = true;
      }
      if (result.error.issues.some((i) => i.path[0] === "imageConsent")) {
        nextErrors["imageConsent"] = true;
      }
      setErrors(nextErrors);
      setState("error");
      document
        .getElementById("form-error-summary")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setErrors({});
    setState("submitting");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      if (!res.ok) throw new Error("submit failed");
      setState("success");
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-success/15 text-3xl text-brand-success">
          ✓
        </div>
        <h2 className="font-display text-2xl">{doc.successTitle}</h2>
        <p className="mx-auto mt-3 max-w-md text-brand-textMuted">
          {doc.successBody}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEWA KOLUMNA — dane uczestnika + wydarzenie */}
        <div className="space-y-6">
          <EventInfoCard
            locale={locale}
            dict={dict}
            events={events}
            selectedEventId={eventId}
            onChange={setEventId}
          />

          <div className="card space-y-5 p-5 sm:p-6">
            <h2 className="font-display text-lg uppercase tracking-tight">
              {locale === "pl"
                ? "Dane uczestnika"
                : locale === "en"
                  ? "Participant details"
                  : locale === "ru"
                    ? "Данные участника"
                    : "Дані учасника"}
            </h2>
            {visibleFields.map((field) => (
              <TextField
                key={field.name}
                field={field}
                value={fields[field.name] ?? ""}
                onChange={(v) =>
                  setFields((prev) => ({ ...prev, [field.name]: v }))
                }
                error={errors[field.name]}
                requiredHint={dict.form.requiredHint}
                errorText={dict.form.errorRequired}
              />
            ))}

            {doc.fields.some((f) => f.conditional === "prizeWinner") &&
              !showPrizeFields && (
                <button
                  type="button"
                  onClick={() => setShowPrizeFields(true)}
                  className="text-sm font-semibold text-brand-accent underline decoration-dotted underline-offset-4"
                >
                  +{" "}
                  {locale === "pl"
                    ? "Dodaj dane do wypłaty nagrody"
                    : locale === "en"
                      ? "Add prize payout details"
                      : locale === "ru"
                        ? "Добавить данные для выплаты приза"
                        : "Додати дані для виплати призу"}
                </button>
              )}
          </div>
        </div>

        {/* PRAWA KOLUMNA — wymagane potwierdzenia + wizerunek + wysyłka */}
        <div className="space-y-6">
          <div className="card space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg uppercase tracking-tight">
                {locale === "pl"
                  ? "Wymagane potwierdzenia"
                  : locale === "en"
                    ? "Required confirmations"
                    : locale === "ru"
                      ? "Обязательные подтверждения"
                      : "Обов'язкові підтвердження"}
              </h2>
              <span className="text-xs text-brand-textMuted">
                {dict.form.requiredMark}
              </span>
            </div>

            {doc.checkboxes.map((cb) => (
              <CheckboxField
                key={cb.id}
                config={cb}
                checked={checkboxes[cb.id] ?? false}
                onChange={(v) =>
                  setCheckboxes((prev) => ({ ...prev, [cb.id]: v }))
                }
                error={errors[cb.id]}
                requiredHint={dict.form.requiredHint}
              />
            ))}

            <Link
              href={`/${locale}?event=${eventId}`}
              className="inline-block text-sm font-semibold text-brand-accent underline decoration-dotted underline-offset-4"
            >
              {doc.officialDocLabel} →
            </Link>
          </div>

          {doc.imageConsent && (
            <ImageConsentField
              config={doc.imageConsent}
              value={imageConsent}
              onChange={setImageConsent}
              error={errors["imageConsent"]}
              requiredHint={dict.form.requiredHint}
            />
          )}

          {state === "error" && (
            <p
              id="form-error-summary"
              role="alert"
              className="rounded-xl border border-brand-error/40 bg-brand-error/10 p-4 text-sm text-brand-error"
            >
              {dict.form.errorGeneric}
            </p>
          )}

          <div className="card space-y-3 p-5 sm:p-6">
            <button
              type="submit"
              disabled={state === "submitting"}
              className="btn-primary w-full"
            >
              {state === "submitting" ? doc.submittingLabel : doc.submitLabel}
            </button>
            <p className="text-xs leading-relaxed text-brand-textMuted">
              {doc.requiredNotice}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
