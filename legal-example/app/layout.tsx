import type { Metadata } from "next";
import { Oswald, Inter } from "next/font/google";
import "./globals.css";

// Display: szeroka, wersalikowa, sportowa — zgodna z nagłówkami
// poland.acebattle.run ("NOWY FORMAT BIEGÓW!", "ROLE W DRUŻYNIE").
// Body: neutralny, bardzo czytelny grotesk do długich treści prawnych.
const display = Oswald({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ACE BATTLE RUN — Dokumenty uczestnika",
  description:
    "Formularze zgód i oświadczeń uczestnika ACE BATTLE RUN Poland — PL / EN / UA / RU.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
