import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import "../globals.css";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  Alumni_Sans,
  Inter,
  JetBrains_Mono,
  Manrope,
} from "next/font/google";

import { routing } from "@/i18n/routing";

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

export const metadata: Metadata = {
  title: "TEAMS MILE Warsaw — 27 June 2026",
  description:
    "The Polish launch of ACE BATTLE MILE — a one-mile team race with tactical role-switching. 27 June 2026 · Stadion Podskarbińska, Warsaw.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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
  ].join(" ");

  return (
    <html lang={locale} className={`${fontVars} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
