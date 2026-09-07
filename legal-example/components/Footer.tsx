import type { Locale } from "@/lib/types";
import type { CommonDictionary } from "@/content/types";
import { Container } from "./Container";

export function Footer({
  locale,
  dict,
}: {
  locale: Locale;
  dict: CommonDictionary;
}) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-brand-border py-10">
      <Container className="flex flex-col items-start justify-between gap-4 text-sm text-brand-textMuted sm:flex-row sm:items-center">
        <div>
          <p className="font-semibold text-brand-text">{dict.footer.organizer}</p>
          <p>
            © {year} ACE BATTLE POLAND Sp. z o.o. {dict.footer.rights}
          </p>
        </div>
        <a
          href={`https://poland.acebattle.run/${locale}/terms`}
          className="underline decoration-brand-border underline-offset-4 transition-colors hover:text-brand-text hover:decoration-brand-accent"
        >
          {dict.footer.termsLink}
        </a>
      </Container>
    </footer>
  );
}
