"use client";

import { useMemo, useState } from "react";
import type { EventRecord, Locale } from "@/lib/types";
import type { CommonDictionary, DocumentContent } from "@/content/types";
import { buildConsentSchema } from "@/lib/validation";
import { EventInfoCard } from "./EventInfoCard";
import { TextField } from "./TextField";
import { CheckboxField } from "./CheckboxField";
import { ImageConsentField } from "./ImageConsentField";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function ConsentForm({
  locale,
  dict,
  doc,
  events,
  initialEventId,
}: {
  locale: Locale;
  dict: CommonDictionary;
  doc: DocumentContent;
  events: EventRecord[];
  initialEventId: string;
}) {
  const [eventId, setEventId] = useState(initialEventId);
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

  const schema = useMemo(() => buildConsentSchema(doc), [doc]);
  const selectedEvent = events.find((e) => e.id === eventId) ?? events[0];

  const visibleFields = doc.fields.filter(
    (f) => f.conditional !== "prizeWinner" || showPrizeFields,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      eventId,
      locale,
      docSlug: doc.slug,
      fields,
      checkboxes,
      imageConsent: imageConsent ?? undefined,
    };

    const result = schema.safeParse(payload);
    if (!result.success) {
      const nextErrors: Record<string, boolean> = {};
      for (const issue of result.error.issues) {
        // issue.path np. ["fields","fullName"] albo ["checkboxes","risks"] albo ["imageConsent"]
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
      const res = await fetch("/api/consent", {
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
      <div className="card p-8 text-center">
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
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <EventInfoCard
        locale={locale}
        dict={dict}
        events={events}
        selectedEventId={eventId}
        onChange={setEventId}
      />

      {visibleFields.length > 0 && (
        <div className="card space-y-5 p-5 sm:p-6">
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
      )}

      {doc.checkboxes.length > 0 && (
        <div className="space-y-3">
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
        </div>
      )}

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-brand-textMuted">{dict.form.requiredMark}</p>
        <button
          type="submit"
          disabled={state === "submitting"}
          className="btn-primary w-full sm:w-auto"
        >
          {state === "submitting" ? doc.submittingLabel : doc.submitLabel}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-brand-textMuted">
        {doc.requiredNotice}
      </p>
    </form>
  );
}
