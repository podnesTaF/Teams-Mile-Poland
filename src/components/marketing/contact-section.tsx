import { useTranslations } from "next-intl";

import { ContactForm } from "@/features/contact/components/contact-form";

/**
 * Landing-page Contact section. Renders the same form as the contact
 * modal but inline, on the brand-dark background.
 */
export function ContactSection() {
  const t = useTranslations("contact");

  return (
    <section id="contact" className="contact-section">
      <div className="contact-section-inner">
        <h2>{t("title")}</h2>
        <div className="contact-section-card">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
