"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Cbx } from "@/components/ui/cbx";
import { FloatField } from "@/components/ui/float-field";
import { IconPerson } from "@/components/ui/icons";
import { Loader } from "@/components/ui/loader";
import { Modal, ModalBody, ModalFoot, ModalHead } from "@/components/ui/modal";
import { PhoneField } from "@/components/ui/phone-field";

import { trackFormSubmit } from "@/lib/analytics";
import { cn } from "@/lib/utils";

import { submitRegistration } from "../actions";
import { useRegistrationNav } from "./use-registration-nav";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  terms: boolean;
};

const empty: FormState = { fullName: "", email: "", phone: "", terms: false };

export function QuickModal() {
  const t = useTranslations("registration.modals.quick");
  const tCommon = useTranslations("registration.modals.shared");
  const nav = useRegistrationNav();
  const [data, setData] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = data.fullName && data.email && data.phone && data.terms;

  function onSubmit() {
    if (!ready || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await submitRegistration({
        flow: "free",
        person: {
          fullName: data.fullName.trim(),
          email: data.email.trim(),
          phone: data.phone.trim(),
        },
        terms: true,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      trackFormSubmit("registration_solo", { flow: "free", payment: result.status });
      if (result.status === "paid") {
        window.location.assign(result.redirectTo);
        return;
      }
      nav.toDone("?flow=free");
    });
  }

  return (
    <Modal
      open
      onClose={nav.close}
      onBack={nav.toChooser}
      icon={<IconPerson />}
      labelledBy="qr-title"
    >
      <ModalHead id="qr-title" title={t("title")} titleSize="sm" />
      <ModalBody>
        <FloatField
          label={tCommon("fullName")}
          value={data.fullName}
          onChange={(event) => setData((d) => ({ ...d, fullName: event.target.value }))}
        />
        <FloatField
          label={tCommon("email")}
          type="email"
          value={data.email}
          onChange={(event) => setData((d) => ({ ...d, email: event.target.value }))}
        />
        <PhoneField
          label={tCommon("phone")}
          value={data.phone}
          onChange={(phone) => setData((d) => ({ ...d, phone }))}
        />
        {error ? <span className="ff-error-msg">{error}</span> : null}
      </ModalBody>
      <ModalFoot>
        <Cbx
          id="qr-terms"
          checked={data.terms}
          onChange={(event) => setData((d) => ({ ...d, terms: event.target.checked }))}
        >
          {tCommon.rich("terms", {
            privacy: (chunks) => <a href="#privacy">{chunks}</a>,
            terms: (chunks) => <a href="#terms">{chunks}</a>,
          })}
        </Cbx>
        <button
          type="button"
          className={cn("btn-fil-red", pending && "is-loading")}
          disabled={!ready || pending}
          onClick={onSubmit}
        >
          {pending ? <Loader size={28} label={tCommon("submitting")} /> : t("cta")}
        </button>
      </ModalFoot>
    </Modal>
  );
}
