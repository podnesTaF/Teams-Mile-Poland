import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import "../globals.css";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  Alumni_Sans,
  Exo_2,
  Fira_Sans_Condensed,
  Inter,
  JetBrains_Mono,
  Manrope,
} from "next/font/google";

import { routing } from "@/i18n/routing";
import {
  GoogleTagManager,
  GoogleTagManagerNoScript,
} from "@/components/analytics/gtm";

const display = Alumni_Sans({
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const displayAlt = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display-alt",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

// New landing design fonts (ACE BATTLE RUN).
// Fira Sans Condensed bold-italic drives every `.head` / `.t-*` heading
// and most of the smaller display labels. Cyrillic subset included so the
// Ukrainian copy renders correctly without falling back.
const headDisplay = Fira_Sans_Condensed({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "700"],
  style: ["italic"],
  variable: "--font-head",
  display: "swap",
});

// Exo 2 is the button / form-CTA face on the new landing.
const cta = Exo_2({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700"],
  variable: "--font-cta",
  display: "swap",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  modal,
  params,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const fontVars = [
    display.variable,
    displayAlt.variable,
    body.variable,
    mono.variable,
    headDisplay.variable,
    cta.variable,
  ].join(" ");

  return (
    <html lang={locale} className={`${fontVars} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <GoogleTagManagerNoScript />
        <GoogleTagManager />
        <NextIntlClientProvider>
          {children}
          {modal}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
