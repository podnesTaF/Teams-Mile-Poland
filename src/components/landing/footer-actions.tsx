"use client";

import { useState } from "react";

import { trackLinkClick } from "@/lib/analytics";

/** Footer social links → masked SVG icon (recoloured red via CSS `--ic`). */
const SOCIALS = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: "social-whatsapp",
    href: "https://chat.whatsapp.com/KynzdMczMoPE7Trr3CWGNH?mode=gi_t",
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: "social-instagram",
    href: "https://www.instagram.com/acebattle_run/",
  },
  {
    id: "telegram",
    label: "Telegram",
    icon: "social-telegram",
    href: "https://t.me/acebattlerun",
  },
] as const;

type Props = {
  phone: string;
  email: string;
  shareLabel: string;
  copiedLabel: string;
};

/**
 * Interactive footer cluster: group/social links, phone + email, and the
 * "share the site with a friend" button. Every action pushes a
 * `gtm.linkClick` event so marketing can count group joins, phone taps, and
 * link copies. The share button copies the current site URL to the clipboard
 * instead of navigating.
 */
export function FooterActions({ phone, email, shareLabel, copiedLabel }: Props) {
  const [copied, setCopied] = useState(false);

  function copySiteLink() {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    trackLinkClick("footer_share_site", { url });
    if (!url) return;
    try {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API can fail in non-secure contexts; ignore silently.
    }
  }

  return (
    <>
      <div className="socials">
        {SOCIALS.map((s) => (
          <a
            key={s.id}
            className="social"
            href={s.href}
            aria-label={s.label}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackLinkClick(`footer_${s.id}`, { url: s.href })}
            style={{ "--ic": `url(/landing/icons/${s.icon}.svg)` } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="footer-contact">
        <a
          className="footer-phone"
          href={`tel:${phone.replace(/[^+\d]/g, "")}`}
          onClick={() => trackLinkClick("footer_phone", { phone })}
        >
          {phone}
        </a>
        <a
          className="footer-phone"
          href={`mailto:${email}`}
          onClick={() => trackLinkClick("footer_email", { email })}
        >
          {email}
        </a>
      </div>
      <button type="button" className="btn btn-stroke footer-share" onClick={copySiteLink}>
        {copied ? copiedLabel : shareLabel}
      </button>
    </>
  );
}
