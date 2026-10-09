import { notFound } from "next/navigation";

/**
 * `/teams/join/[code]` — asking to join by team code — is removed (ADR 0016):
 * join requests and team codes are closed. This stub exists only so old links
 * answer not-found rather than falling through `@modal/[...catchAll]` to the
 * landing. `/teams/new` needs no stub: `/teams/[slug]` 404s an unknown slug.
 */
export default function RemovedJoinByCode(): never {
  notFound();
}
