import { ChooserModal } from "./chooser-modal";
import { CreateTeamModal } from "./create-team-modal";
import { QuickModal } from "./quick-modal";
import { SuccessModal } from "./success-modal";

/**
 * Maps the `/register/[[...step]]` optional-catch-all param to a modal:
 *   /register        → chooser
 *   /register/solo   → quick register ("I don't have a team")
 *   /register/team   → create team    ("I have a team")
 *   /register/done   → success
 *
 * Rendered by BOTH the real page and the intercepting `@modal` page, so
 * direct loads and soft client navigations are identical and server-rendered
 * (no hydration flicker).
 */
export function RegistrationFlow({ step }: { step?: string[] }) {
  switch (step?.[0]) {
    case "solo":
      return <QuickModal />;
    case "team":
      return <CreateTeamModal />;
    case "done":
      return <SuccessModal />;
    default:
      return <ChooserModal />;
  }
}
