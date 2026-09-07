import { notFound } from "next/navigation";
import { LOCALES, type Locale } from "@/lib/types";
import { getDictionary } from "@/content/dictionaries";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  if (!(LOCALES as string[]).includes(params.lang)) {
    notFound();
  }
  const locale = params.lang as Locale;
  const dict = getDictionary(locale);

  return (
    <div className="flex min-h-screen flex-col">
      <Header locale={locale} dict={dict} />
      <main className="flex-1 py-10 sm:py-14">{children}</main>
      <Footer locale={locale} dict={dict} />
    </div>
  );
}
