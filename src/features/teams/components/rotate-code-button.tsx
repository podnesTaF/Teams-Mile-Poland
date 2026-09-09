"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";

import { rotateTeamCode } from "../actions/team";

/**
 * Rotate a leaked code. Pending join requests reference the team, not the code,
 * so nothing a runner already filed is lost — which is why this needs no
 * confirmation dialog.
 */
export function RotateCodeButton({ slug }: { slug: string }) {
  const t = useTranslations("teams.page");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function rotate() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await rotateTeamCode(slug);
      if (!result.ok) {
        setError(tReasons(result.reason));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="team-codebox__action">
      <button type="button" className="btn btn-stroke-dark btn-sm" onClick={rotate} disabled={pending}>
        {pending ? t("rotating") : t("rotate")}
      </button>
      {error ? (
        <span className="field-msg" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
