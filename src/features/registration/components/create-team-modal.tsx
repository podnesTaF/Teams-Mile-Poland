"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Cbx } from "@/components/ui/cbx";
import { FloatField } from "@/components/ui/float-field";
import { IconTeam } from "@/components/ui/icons";
import { Modal, ModalBody, ModalFoot, ModalHead } from "@/components/ui/modal";
import { Link } from "@/i18n/navigation";

import { trackFormSubmit } from "@/lib/analytics";

import { submitRegistration } from "../actions";
import { useRegistrationNav } from "./use-registration-nav";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  teamName: string;
  teamSize: string;
  terms: boolean;
};

const empty: FormState = {
  fullName: "",
  email: "",
  phone: "",
  teamName: "",
  teamSize: "",
  terms: false,
};

export function CreateTeamModal() {
  const t = useTranslations("registration.modals.create");
  const tCommon = useTranslations("registration.modals.shared");
  const nav = useRegistrationNav();
  const [data, setData] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sizeNum = Number(data.teamSize);
  const sizeOk = Number.isInteger(sizeNum) && sizeNum >= 7 && sizeNum <= 12;
  const ready = data.fullName && data.email && data.phone && data.teamName && sizeOk && data.terms;

  function onSubmit() {
    if (!ready || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await submitRegistration({
        flow: "start",
        teamName: data.teamName.trim(),
        teamSize: sizeNum,
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
      trackFormSubmit("registration_team", { flow: "start", payment: result.status });
      if (result.status === "paid") {
        window.location.assign(result.redirectTo);
        return;
      }
      const code = result.teamCode ? `&code=${encodeURIComponent(result.teamCode)}` : "";
      nav.toDone(`?flow=start${code}`);
    });
  }

  return (
    <Modal
      open
      onClose={nav.close}
      onBack={nav.toChooser}
      icon={<IconTeam />}
      labelledBy="ct-title"
    >
      <ModalHead id="ct-title" title={t("title")} titleSize="sm" />
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
        <FloatField
          label={tCommon("phone")}
          type="tel"
          value={data.phone}
          onChange={(event) => setData((d) => ({ ...d, phone: event.target.value }))}
        />
        <FloatField
          label={t("teamName")}
          value={data.teamName}
          onChange={(event) => setData((d) => ({ ...d, teamName: event.target.value }))}
        />
        <FloatField
          label={t("teamSize")}
          type="number"
          min={7}
          max={12}
          value={data.teamSize}
          onChange={(event) => setData((d) => ({ ...d, teamSize: event.target.value }))}
        />
        {error ? <span className="ff-error-msg">{error}</span> : null}
      </ModalBody>
      <ModalFoot>
        <Cbx
          id="ct-terms"
          checked={data.terms}
          onChange={(event) => setData((d) => ({ ...d, terms: event.target.checked }))}
        >
          {tCommon.rich("terms", {
            privacy: (chunks) => (
              <Link href="/terms" target="_blank" rel="noopener noreferrer">
                {chunks}
              </Link>
            ),
            terms: (chunks) => (
              <Link href="/terms" target="_blank" rel="noopener noreferrer">
                {chunks}
              </Link>
            ),
          })}
        </Cbx>
        <button
          type="button"
          className="btn-fil-red"
          disabled={!ready || pending}
          onClick={onSubmit}
        >
          {pending ? tCommon("submitting") : t("cta")}
        </button>
      </ModalFoot>
    </Modal>
  );
}
