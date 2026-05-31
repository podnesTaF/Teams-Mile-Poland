"use client";

import { useTranslations } from "next-intl";

import { Modal, ModalHead } from "@/components/ui/modal";
import { IconPerson, IconTeam } from "@/components/ui/icons";

import { useRegistrationNav } from "./use-registration-nav";

export function ChooserModal() {
  const t = useTranslations("registration.modals.chooser");
  const nav = useRegistrationNav();

  return (
    <Modal open onClose={nav.close} soft labelledBy="ch-title">
      <ModalHead
        id="ch-title"
        title={t("title")}
        sub={t.rich("sub", { br: () => <br /> })}
        titleSize="sm"
      />
      <div className="choose-list">
        <button className="choose-card is-red" onClick={nav.toSolo} type="button">
          <span className="choose-card-icon">
            <IconPerson />
          </span>
          <span>
            <div className="choose-card-title">{t("quickTitle")}</div>
            <div className="choose-card-desc">{t("quickDesc")}</div>
          </span>
        </button>
        <button className="choose-card is-dark" onClick={nav.toTeam} type="button">
          <span className="choose-card-icon">
            <IconTeam />
          </span>
          <span>
            <div className="choose-card-title">{t("createTitle")}</div>
            <div className="choose-card-desc">{t("createDesc")}</div>
          </span>
        </button>
      </div>
    </Modal>
  );
}
