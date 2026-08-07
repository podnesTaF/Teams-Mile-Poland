"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { FloatField } from "@/components/ui/float-field";
import { Loader } from "@/components/ui/loader";
import { PhoneField } from "@/components/ui/phone-field";

import { Link } from "@/i18n/navigation";

import { trackFormSubmit } from "@/lib/analytics";
import { isValidPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

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

  const ready = data.name && data.email && isValidPhone(data.phone) && data.terms;

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
        <PhoneField
          label={t("phone")}
          value={data.phone}
          onChange={(phone) => setData((d) => ({ ...d, phone }))}
        />
      </div>
      <FloatField
        as="textarea"
        label={t("message")}
        value={data.message}
        onChange={(event) => setData((d) => ({ ...d, message: event.target.value }))}
      />
      <div className="contact-method">
        <span className="lbl">{t("methodLabel")}</span>
        <div className="radios">
          {CONTACT_METHODS.map((method) => (
            <label key={method} className="radio" htmlFor={`cu-m-${method}`}>
              <input
                id={`cu-m-${method}`}
                type="radio"
                name="contact-method"
                checked={data.method === method}
                onChange={() => setData((d) => ({ ...d, method }))}
              />
              {t(`methods.${method}`)}
            </label>
          ))}
        </div>
      </div>
      <label className="agree" htmlFor="cu-terms">
        <input
          id="cu-terms"
          type="checkbox"
          checked={data.terms}
          onChange={(event) => setData((d) => ({ ...d, terms: event.target.checked }))}
        />
        <span>
          {t.rich("terms", {
            privacy: (chunks) => (
              <Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline">
                {chunks}
              </Link>
            ),
            terms: (chunks) => (
              <Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>
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
        className={cn("btn-fil-red btn-fil-red-fixed", pending && "is-loading")}
        disabled={!ready || pending}
        onClick={onSubmit}
      >
        {pending ? <Loader size={28} label={t("sending")} /> : t("send")}
      </button>
    </>
  );
}
