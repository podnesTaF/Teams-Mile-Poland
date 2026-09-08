import { getTranslations } from "next-intl/server";

import { InviteLink } from "@/features/team/components/invite-link";

/**
 * The team code and its share link, for members. Reuses the existing
 * `.iv-share` block and `InviteLink` (the legacy component is a pure copy
 * widget — reusing it is not touching the frozen legacy feature's data).
 *
 * The link points at `/teams/join/[code]`, the route #61 builds. Knowing the
 * code only lets someone *knock*: the manager still decides.
 */
export async function TeamShare({ code, joinUrl }: { code: string; joinUrl: string }) {
  const t = await getTranslations("teams.page");

  return (
    <section className="iv-share" data-team-share="1">
      <p className="iv-share__hint">{t("codeHint")}</p>
      <p className="iv-share__code-line">
        {t("codeLabel")} <b data-team-code={code}>{code}</b>
      </p>
      <InviteLink url={joinUrl} copyLabel={t("copy")} copiedLabel={t("copied")} />
    </section>
  );
}
