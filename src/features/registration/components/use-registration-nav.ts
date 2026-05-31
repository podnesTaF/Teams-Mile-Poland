"use client";

import { useRouter } from "@/i18n/navigation";

/**
 * Locale-aware navigation between the registration modal routes.
 *
 * The modal layer is now real routes (`/register`, `/register/solo`,
 * `/register/team`, `/register/done`) rendered through a parallel `@modal`
 * slot + intercepting routes — so opening is server-rendered with no
 * hydration flick. These helpers drive the transitions between steps and
 * the close-to-landing action.
 */
export function useRegistrationNav() {
  const router = useRouter();

  return {
    close: () => router.push("/"),
    toChooser: () => router.push("/register"),
    toSolo: () => router.push("/register/solo"),
    toTeam: () => router.push("/register/team"),
    toDone: (query: string) => router.push(`/register/done${query}`),
  };
}
