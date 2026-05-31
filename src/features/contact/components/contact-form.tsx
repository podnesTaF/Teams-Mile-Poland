"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Cbx } from "@/components/ui/cbx";
import { FloatField } from "@/components/ui/float-field";

import { trackFormSubmit } from "@/lib/analytics";

import { submitContact } from "../action";
import { CONTACT_METHODS, type ContactMethod } from "../schema";

type FormState = {
  name: string;
  email: string;
  phone: string;
  message: string;
  method: ContactMethod;
  terms: boolean;
};

const empty: FormState = {
  name: "",
  email: "",
  phone: "",
  message: "",
  method: "viber",
  terms: false,
};

type Props = {
  onSent?: () => void;
};

export function ContactForm({ onSent }: Props) {
  const t = useTranslations("contact");
  const [data, setData] = useState<FormState>(empty);
  const [status, setStatus] = useState<"idle" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = data.name && data.email && data.phone && data.terms;

  function onSubmit() {
    if (!ready || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await submitContact({
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        message: data.message.trim() || undefined,
        method: data.method,
        terms: true,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      trackFormSubmit("contact", { method: data.method });
      setStatus("sent");
      setData(empty);
      onSent?.();
    });
  }

  return (
    <>
      <div className="modal-contact-grid">
        <FloatField
          label={t("name")}
          value={data.name}
          onChange={(event) => setData((d) => ({ ...d, name: event.target.value }))}
        />
        <FloatField
          label={t("email")}
          type="email"
          value={data.email}
          onChange={(event) => setData((d) => ({ ...d, email: event.target.value }))}
        />
        <FloatField
          label={t("phone")}
          type="tel"
          value={data.phone}
          onChange={(event) => setData((d) => ({ ...d, phone: event.target.value }))}
        />
      </div>
      <FloatField
        as="textarea"
        label={t("message")}
        value={data.message}
        onChange={(event) => setData((d) => ({ ...d, message: event.target.value }))}
      />
      <div className="contact-methods-row">
        <span className="contact-methods-label">{t("methodLabel")}</span>
        {CONTACT_METHODS.map((method) => (
          <Cbx
            key={method}
            id={`cu-m-${method}`}
            inline
            checked={data.method === method}
            onChange={() => setData((d) => ({ ...d, method }))}
          >
            {t(`methods.${method}`)}
          </Cbx>
        ))}
      </div>
      <div className="flex justify-center">
        <Cbx
          id="cu-terms"
          checked={data.terms}
          onChange={(event) => setData((d) => ({ ...d, terms: event.target.checked }))}
        >
          {t.rich("terms", {
            privacy: (chunks) => <a href="#privacy">{chunks}</a>,
            terms: (chunks) => <a href="#terms">{chunks}</a>,
          })}
        </Cbx>
      </div>
      {error ? (
        <div className="text-center">
          <span className="ff-error-msg">{error}</span>
        </div>
      ) : null}
      {status === "sent" ? (
        <div className="text-center text-sm font-semibold text-[color:var(--form-green)]">
          {t("sent")}
        </div>
      ) : null}
      <button
        type="button"
        className="btn-fil-red btn-fil-red-fixed"
        disabled={!ready || pending}
        onClick={onSubmit}
      >
        {pending ? t("sending") : t("send")}
      </button>
    </>
  );
}
