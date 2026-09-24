"use client";

import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";

type Props = {
  slug: string;
  registerLabel: string;
  createLabel: string;
  signInPrompt: string;
  signInLabel: string;
  /**
   * One button, no prose: for the bar pinned to the bottom of a phone screen
   * on the event page. A logged-out visitor gets the create-account button
   * alone; the "already have an account?" line stays in the entry card.
   */
  compact?: boolean;
};

/**
 * Event-detail register CTA (client, session-aware). Logged-in runners get a
 * one-tap Register link; logged-out visitors get an in-context choice — create
 * an account or sign in — right here on the event page instead of being bounced
 * abruptly to sign-up. The register intent is threaded as `redirectTo` so auth
 * returns here to finish.
 */
export function EventRegisterCta({
  slug,
  registerLabel,
  createLabel,
  signInPrompt,
  signInLabel,
  compact = false,
}: Props) {
  const { data, isPending } = authClient.useSession();
  const target = `/events/${slug}/register`;
  const enc = encodeURIComponent(target);

  if (isPending) {
    return (
      <span
        className="btn btn-red btn-block"
        aria-disabled="true"
        style={{ opacity: 0.6, pointerEvents: "none" }}
      >
        {registerLabel}
      </span>
    );
  }

  if (data) {
    return (
      <Link href={target} className="btn btn-red btn-block">
        {registerLabel}
      </Link>
    );
  }

  if (compact) {
    return (
      <Link href={target} className="btn btn-red btn-block">
        {createLabel}
      </Link>
    );
  }

  return (
    <div className="ev-auth-cta">
      <Link href={target} className="btn btn-red btn-block">
        {createLabel}
      </Link>
      <p className="slots-note">
        {signInPrompt}{" "}
        <Link href={`/auth/sign-in?redirectTo=${enc}`} className="link">
          {signInLabel}
        </Link>
      </p>
    </div>
  );
}
