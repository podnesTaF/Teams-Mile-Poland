import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LOCALES, EVENT_TYPES, type Locale, type EventType } from "@/lib/types";
import { getDictionary } from "@/content/dictionaries";
import {
  listEvents,
  getNextOpenEvent,
  getNextOpenEventOfType,
} from "@/lib/events";
import { Container } from "@/components/Container";
import { RegisterForm } from "@/components/RegisterForm";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export function generateMetadata({
  params,
}: {
  params: { lang: string };
}): Metadata {
  const dict = getDictionary(params.lang);
  return { title: `${dict.hub.cardCta} — ${dict.siteName}` };
}

const HEADING: Record<Locale, string> = {
  pl: "Rejestracja uczestnika",
  en: "Participant registration",
  ua: "Реєстрація учасника",
  ru: "Регистрация участника",
};

const SUBHEADING: Record<Locale, string> = {
  pl: "Wybierz mechanikę i wydarzenie poniżej — formularz automatycznie dopasuje wymagane dokumenty i zgody.",
  en: "Choose the event below — the form will automatically match the required documents and consents.",
  ua: "Оберіть захід нижче — форма автоматично підбере необхідні документи та згоди.",
  ru: "Выберите мероприятие ниже — форма автоматически подберёт нужные документы и согласия.",
};

export default function RegisterPage({
  params,
  searchParams,
}: {
  params: { lang: string };
  searchParams: { event?: string; type?: string };
}) {
  if (!(LOCALES as string[]).includes(params.lang)) notFound();
  const locale = params.lang as Locale;
  const dict = getDictionary(locale);
  const events = listEvents();

  const requestedType = (EVENT_TYPES as string[]).includes(
    searchParams.type ?? "",
  )
    ? (searchParams.type as EventType)
    : undefined;

  const initialEvent =
    events.find((e) => e.id === searchParams.event) ??
    (requestedType ? getNextOpenEventOfType(requestedType) : undefined) ??
    getNextOpenEvent();

  return (
    <Container className="max-w-5xl">
      <span className="eyebrow">{dict.hub.kicker}</span>
      <h1 className="mt-3 font-display text-4xl leading-[1.05] sm:text-5xl">
        {HEADING[locale]}
      </h1>
      <p className="mt-3 text-brand-textMuted">{SUBHEADING[locale]}</p>

      <div className="mt-8">
        <RegisterForm
          locale={locale}
          dict={dict}
          events={events}
          initialEventId={initialEvent.id}
        />
      </div>
    </Container>
  );
}
