import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

/**
 * The id of Team Mile Rules §2.2 ("Runner in the ACE BATTLE RUN ecosystem" —
 * the individual runner, and how a runner becomes a team runner) in each
 * locale's `src/content/legal/<locale>/team-rules.html`. The ids are generated
 * from the heading text, so they differ per language; an unknown locale falls
 * back to the Polish document's id, as the legal route falls back to Polish.
 */
const SECTION_2_2_ID: Record<string, string> = {
  pl: "runner-w-ekosystemie-ace-battle-run",
  en: "runner-in-the-ace-battle-run-ecosystem",
  ua: "бігун-в-екосистемі-ace-battle-run",
};

/**
 * The last line of the entry explainer (ADR 0016): a link to the paragraph of
 * the Team Mile Rules that says how an individual runner becomes a team
 * runner, on the eventless legal route. Shared by the event page and the
 * register page so the two explainers cannot point at different places.
 */
export async function EntryRulesLink({ locale }: { locale: string }) {
  const t = await getTranslations("events");
  const id = SECTION_2_2_ID[locale] ?? SECTION_2_2_ID.pl;
  return (
    <p className="slots-note" data-entry-explainer-line="rules">
      <Link
        href={`/legal/team-rules#${encodeURIComponent(id)}`}
        className="link"
        data-entry-rules-link="1"
      >
        {t("entryExplainer.rulesLink")}
      </Link>
    </p>
  );
}
