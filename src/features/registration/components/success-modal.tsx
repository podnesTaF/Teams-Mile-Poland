"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { IconWhatsApp, IconTelegram } from "@/components/ui/icons";
import { Modal, ModalHead } from "@/components/ui/modal";
import { trackLinkClick } from "@/lib/analytics";
import { EVENT } from "@/lib/marketing/event";
import { cn } from "@/lib/utils";

import { useRegistrationNav } from "./use-registration-nav";

/**
 * Terminal "Application accepted" step. Reads `?flow=` and `?code=` from the
 * URL (set by the submitting modal on success) — query params are fine here
 * because this state is only ever reached after a user action, never on a
 * cold deep-link, so there's no flicker to avoid.
 */
export function SuccessModal() {
  const t = useTranslations("registration.modals.success");
  const nav = useRegistrationNav();
  const params = useSearchParams();
  const [copied, setCopied] = useState(false);

  const flow = params.get("flow");
  const teamCode = params.get("code") ?? undefined;
  const isCreate = flow === "start" && Boolean(teamCode);
  const inviteUrl =
    isCreate && teamCode && typeof window !== "undefined"
      ? `${window.location.origin}/join/${encodeURIComponent(teamCode)}`
      : undefined;

  function copyInvite() {
    if (!inviteUrl) return;
    trackLinkClick("success_copy_invite_link", { url: inviteUrl });
    try {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API can fail in non-secure contexts; ignore silently.
    }
  }

  return (
    <Modal open onClose={nav.close} labelledBy="rs-title">
      <ModalHead
        id="rs-title"
        title={t("title")}
        subTag={t("subTag")}
        titleSize="sm"
        titleClassName="modal-title-success"
      />

      {inviteUrl ? (
        <div className="invite-code">
          <span className="invite-code-val">{inviteUrl}</span>
          <button
            type="button"
            className={cn("invite-code-copy", copied && "is-copied")}
            onClick={copyInvite}
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      ) : null}

      <div className="success-shares">
        <a
          className="success-share"
          href={EVENT.contact.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackLinkClick("success_whatsapp_group", { url: EVENT.contact.whatsappUrl })}
        >
          <span className="success-share-icon wa">
            <IconWhatsApp />
          </span>
          <span className="success-share-label">{t("whatsapp")}</span>
        </a>
        <a
          className="success-share"
          href={EVENT.contact.telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackLinkClick("success_telegram_group", { url: EVENT.contact.telegramUrl })}
        >
          <span className="success-share-icon tg">
            <IconTelegram />
          </span>
          <span className="success-share-label">{t("telegram")}</span>
        </a>
      </div>

      <div className="success-help">
        <span>{t("help")}</span>
        <a
          className="success-help-phone"
          href={`tel:${EVENT.contact.phoneTel}`}
          onClick={() => trackLinkClick("success_phone", { phone: EVENT.contact.phoneTel })}
        >
          {EVENT.contact.phone}
        </a>
      </div>
    </Modal>
  );
}
