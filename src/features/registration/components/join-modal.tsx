"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { Cbx } from "@/components/ui/cbx";
import { FloatField } from "@/components/ui/float-field";
import { Modal, ModalBody, ModalFoot, ModalHead } from "@/components/ui/modal";

import { trackFormSubmit } from "@/lib/analytics";

import { getJoinPreview, submitRegistration } from "../actions";
import type { TeamPreview } from "../data";
import { useRegistrationNav } from "./use-registration-nav";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  terms: boolean;
};

const empty: FormState = { fullName: "", email: "", phone: "", terms: false };

type PreviewState =
  | { status: "loading" }
  | { status: "ok"; team: TeamPreview }
  | { status: "missing"; message: string };

export function JoinModal({ code }: { code: string }) {
  const t = useTranslations("registration.modals.join");
  const tCommon = useTranslations("registration.modals.shared");
  const nav = useRegistrationNav();
  const [data, setData] = useState<FormState>(empty);
  const [fetched, setFetched] = useState<PreviewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Resolve the team behind the invite code on mount.
  useEffect(() => {
    let cancelled = false;
    getJoinPreview(code)
      .then((result) => {
        if (cancelled) return;
        setFetched(
          result.ok
            ? { status: "ok", team: result.team }
            : { status: "missing", message: result.message },
        );
      })
      .catch(() => {
        if (cancelled) return;
        setFetched({ status: "missing", message: t("invalid") });
      });
    return () => {
      cancelled = true;
    };
  }, [code, t]);

  const preview: PreviewState = fetched ?? { status: "loading" };
  const teamOk = preview.status === "ok";
  const team = teamOk ? preview.team : null;
  const ready = teamOk && data.fullName && data.email && data.phone && data.terms;

  function onSubmit() {
    if (!ready || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await submitRegistration({
        flow: "join",
        teamCode: code,
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
      trackFormSubmit("registration_join", { flow: "join", payment: result.status });
      if (result.status === "paid") {
        window.location.assign(result.redirectTo);
        return;
      }
      nav.toDone("?flow=join");
    });
  }

  // Invalid invite link → minimal error modal.
  if (preview.status === "missing") {
    return (
      <Modal open onClose={nav.close} labelledBy="jt-bad-title">
        <ModalHead id="jt-bad-title" title={t("invalid")} titleSize="sm" />
        <ModalFoot>
          <button type="button" className="btn-fil-red" onClick={nav.close}>
            {t("close")}
          </button>
        </ModalFoot>
      </Modal>
    );
  }

  return (
    <Modal open onClose={nav.close} labelledBy="jt-title">
      <ModalHead
        id="jt-title"
        title={tCommon("participantRegistration")}
        subTag={team ? t("subTag", { team: team.name }) : t("loading")}
        titleSize="sm"
      />
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
        {error ? <span className="ff-error-msg">{error}</span> : null}
      </ModalBody>
      <ModalFoot>
        <Cbx
          id="jt-terms"
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
