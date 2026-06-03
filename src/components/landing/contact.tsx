import Image from "next/image";
import { useTranslations } from "next-intl";

import { ContactForm } from "@/features/contact/components/contact-form";

/**
 * Contact section. Wraps the existing ContactForm in the dark
 * `.contact` block with red triangle decorations and a white form card.
 * The form itself is the same one the contact modal uses — server action
 * and validation are shared.
 */
export function Contact() {
  const t = useTranslations("landing.faq"); // sub copy lives under FAQ but the design repeats it
  const tc = useTranslations("contact");

  return (
    <section className="section contact" id="contact" data-screen-label="Contact">
      <Image className="beam beam--l" src="/landing/icons/beam-left.svg" alt="" width={478} height={749} aria-hidden />
      <Image className="beam beam--r" src="/landing/icons/beam-right.svg" alt="" width={478} height={749} aria-hidden />
      <Image
        className="sect-glow sect-glow--bottom"
        src="/landing/icons/roles-glow.svg"
        alt=""
        width={1352}
        height={1096}
        aria-hidden
      />
      <div className="wrap center">
        <h2 className="head t-sec">{tc("title")}</h2>
        <p className="head t-20" style={{ marginTop: 6 }}>
          {t("sub")}
        </p>
        <div className="form-card">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
