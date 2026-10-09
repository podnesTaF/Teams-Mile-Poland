import { notFound } from "next/navigation";

/**
 * `/teams` — the public recruiting list — is removed (ADR 0016): teams take
 * members by a manager's invitation only. This stub exists only so the URL
 * answers not-found: without a page here, `@modal/[...catchAll]` matches it and
 * the `[locale]` default slot renders the landing in its place.
 */
export default function RemovedTeamsList(): never {
  notFound();
}
