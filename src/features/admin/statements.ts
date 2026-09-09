import { and, desc, eq, inArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import {
  consentSubmissions,
  type ConsentSnapshot,
  eventRegistrations,
  registrationConsents,
  users,
} from "@/db/schema";
import { requireAdmin } from "@/features/admin/action-helpers";
import type { ParticipationStatus } from "@/features/admin/events-data";
import { getDb } from "@/lib/db";
import { getEventBySlug } from "@/lib/events/registry";
import { formatEventLongDate } from "@/lib/events/time";
import { isSeriesEvent, type EventSummary } from "@/lib/events/types";
import { defaultLocale, type Locale, locales } from "@/lib/i18n/config";
import { loadLegalDoc } from "@/lib/legal/content";
import { fillLegalTokens } from "@/lib/legal/fill";
import {
  type DocLocale,
  type DocSet,
  docSetsForEventType,
  getDocsForSet,
  type LegalDoc,
} from "@/lib/legal/manifest";

/**
 * Producing the Statement a runner actually accepted (PRD #50, slice #54).
 *
 * Everything printed here comes off the consent record written at registration
 * (ADR 0006) — the frozen snapshot fills the personal tokens, `accepted_at`
 * fills `__SIGN_DATE__`, and the consent row's own `doc_version` is what the
 * attestation names. **Nothing is read from `users`** except a display name for
 * the rows that have no consent record at all: a Statement rebuilt from the live
 * profile is a reconstruction, not evidence, and correcting a surname in October
 * would silently rewrite an August document.
 *
 * Server-only by construction (Drizzle + `node:fs` through `loadLegalDoc`) and
 * gated on `personal_data`: a Statement carries a date of birth, a home address,
 * a phone number and an emergency contact's name and number, which is exactly
 * what the race-morning volunteer role must never reach (ADR 0007).
 *
 * The batch print route (#55) reuses {@link getStatementsForPrint} verbatim —
 * it already takes a list of ids and reports the ones that do not belong to the
 * event, so selection UI is the only thing that slice has to add.
 */

/** Where every date and time on a printed Statement is anchored. */
const WARSAW = "Europe/Warsaw";

/** Locale → BCP 47 tag, as `lib/events/time.ts` does it for the public pages. */
const DATE_TAG: Record<DocLocale, string> = { pl: "pl-PL", en: "en-GB", ua: "uk-UA" };

/** A stored locale string narrowed to a document locale; anything odd reads as Polish. */
export function toDocLocale(value: string | null | undefined): DocLocale {
  return (locales as readonly string[]).includes(value ?? "") ? (value as DocLocale) : "pl";
}

/**
 * A calendar date in Europe/Warsaw, in the target language's convention —
 * "1 sierpnia 2026" / "1 August 2026" / "1 серпня 2026".
 *
 * The timezone is pinned rather than inherited: the server's `TZ` is not
 * Warsaw's on every host, and an acceptance recorded at 00:30 CEST would
 * otherwise print as the previous day on a UTC box.
 */
export function formatWarsawDate(locale: DocLocale, instant: Date): string {
  return new Intl.DateTimeFormat(DATE_TAG[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: WARSAW,
  }).format(instant);
}

/**
 * The moment of acceptance, to the minute, with its zone spelled out — the
 * attestation's central fact, so it names the zone rather than leaving the
 * reader to assume one.
 */
export function formatWarsawMoment(locale: DocLocale, instant: Date): string {
  const stamp = new Intl.DateTimeFormat(DATE_TAG[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: WARSAW,
    timeZoneName: "short",
  }).format(instant);
  return `${stamp} (${WARSAW})`;
}

/**
 * HTML-escape a value from the consent record.
 *
 * `fillLegalTokens` substitutes raw strings into trusted document HTML and
 * injects `signatureBlock` as markup, so escaping is this module's job. The
 * snapshot is whatever the runner typed into a form field — a surname with an
 * ampersand is ordinary, a surname with a `<script>` is the reason this exists.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** A `YYYY-MM-DD` snapshot date spelled out; anything else prints as captured. */
function formatSnapshotBirthDate(locale: DocLocale, birthDate: string): string {
  const raw = birthDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return escapeHtml(raw);
  return escapeHtml(formatEventLongDate(locale, raw));
}

/** The wording the attestation prints, in the language of the document body. */
export type AttestationLabels = {
  heading: string;
  acceptedBy: string;
  acceptedAt: string;
  document: string;
  ip: string;
  ipUnknown: string;
  record: string;
  explanation: string;
};

/**
 * The attestation's labels in one language. Separate from the render so the
 * assembly below stays a pure string function that a route handler, a test or
 * #55's batch pass can drive without a request context.
 */
export async function getAttestationLabels(locale: DocLocale): Promise<AttestationLabels> {
  const t = await getTranslations({ locale, namespace: "legal" });
  return {
    heading: t("attestation.heading"),
    acceptedBy: t("attestation.acceptedBy"),
    acceptedAt: t("attestation.acceptedAt"),
    document: t("attestation.document"),
    ip: t("attestation.ip"),
    ipUnknown: t("attestation.ipUnknown"),
    record: t("attestation.record"),
    explanation: t("attestation.explanation"),
  };
}

/** What the attestation states — the consent record, said back in prose. */
export type AttestationFacts = {
  fullName: string;
  acceptedAt: Date;
  docSlug: string;
  docVersion: string;
  ip: string | null;
  /** The `consent_submissions` row id: the record this document was built from. */
  recordId: string;
};

/**
 * The electronic attestation that replaces the corpus' blank signature line.
 *
 * Every Oświadczenie ends in a table row labelled "Czytelny podpis uczestnika" /
 * "Legible participant signature" over underscores; #52 tokenised that cell as
 * `__SIGNATURE_BLOCK__`. Under eIDAS a simple electronic signature is admissible
 * and its weight comes from the surrounding record, so what goes in the cell is
 * the record: who accepted, when to the minute, which document and version, from
 * which address, and the row id that proves it — plus one line saying what the
 * reader is looking at, because a name where a signature was expected is
 * otherwise ambiguous.
 *
 * Returns markup for a `<td>`, so block elements are fine but a `<table>` is
 * not. Every interpolated value is escaped here: the caller hands the result to
 * `fillLegalTokens`, which injects it raw by design.
 */
export function renderSignatureBlock(
  facts: AttestationFacts,
  labels: AttestationLabels,
  locale: DocLocale,
): string {
  const line = (label: string, value: string) =>
    `<span class="legal-attestation__line"><span class="legal-attestation__label">${escapeHtml(label)}</span> ${value}</span>`;
  return [
    '<span class="legal-attestation">',
    `<span class="legal-attestation__head">${escapeHtml(labels.heading)}</span>`,
    line(labels.acceptedBy, `<strong>${escapeHtml(facts.fullName)}</strong>`),
    line(labels.acceptedAt, escapeHtml(formatWarsawMoment(locale, facts.acceptedAt))),
    line(labels.document, escapeHtml(`${facts.docSlug} · ${facts.docVersion}`)),
    line(labels.ip, escapeHtml(facts.ip ?? labels.ipUnknown)),
    line(labels.record, `<code>${escapeHtml(facts.recordId)}</code>`),
    `<span class="legal-attestation__note">${escapeHtml(labels.explanation)}</span>`,
    "</span>",
  ].join("");
}

/**
 * Fill one Statement from its consent record. Pure: HTML in, HTML out, no I/O.
 *
 * `lang` is the language of the *bytes* handed in, which is what the dates are
 * spelled in — a document served as a Polish fallback must not carry Ukrainian
 * month names, the same rule the public preview follows.
 */
export function renderStatementHtml(input: {
  /** The document's raw HTML, tokens still in place. */
  source: string;
  lang: DocLocale;
  /** The event's calendar date, `YYYY-MM-DD`. */
  eventDate: string;
  snapshot: ConsentSnapshot;
  facts: AttestationFacts;
  labels: AttestationLabels;
}): string {
  const { source, lang, eventDate, snapshot, facts, labels } = input;
  return fillLegalTokens(source, {
    eventDate: escapeHtml(formatEventLongDate(lang, eventDate)),
    signDate: escapeHtml(formatWarsawDate(lang, facts.acceptedAt)),
    fullName: escapeHtml(snapshot.fullName),
    birthDate: formatSnapshotBirthDate(lang, snapshot.birthDate),
    phoneEmail: escapeHtml(snapshot.phoneEmail),
    address: escapeHtml(snapshot.address),
    emergencyContact: escapeHtml(snapshot.emergencyContact),
    signatureBlock: renderSignatureBlock(facts, labels, lang),
  });
}

/** The consent evidence a registration carries, as the list surface states it. */
export type ConsentSummary = {
  submissionId: string;
  /** The language the runner actually read — the legally operative text. */
  locale: DocLocale;
  acceptedAt: Date;
  docSet: DocSet;
};

/** One line of the statements list: a registration and whether it has evidence. */
export type StatementRosterRow = {
  registrationId: string;
  name: string;
  email: string;
  bib: number | null;
  status: ParticipationStatus;
  /** `null` is a real answer — a registration predating the consent tables. */
  consent: ConsentSummary | null;
};

/** The latest consent submission per registration, for a whole event. */
async function readConsentSummaries(eventSlug: string): Promise<Map<string, ConsentSummary>> {
  const db = getDb();
  const rows = await db
    .select({
      registrationId: consentSubmissions.registrationId,
      submissionId: consentSubmissions.id,
      locale: consentSubmissions.locale,
      acceptedAt: consentSubmissions.acceptedAt,
      docSet: consentSubmissions.docSet,
    })
    .from(consentSubmissions)
    .innerJoin(eventRegistrations, eq(consentSubmissions.registrationId, eventRegistrations.id))
    .where(eq(eventRegistrations.eventSlug, eventSlug))
    .orderBy(desc(consentSubmissions.acceptedAt));

  // Newest first from the query, so the first row seen for a registration is the
  // operative submission: re-consent after a re-issue appends, never updates.
  const latest = new Map<string, ConsentSummary>();
  for (const row of rows) {
    if (latest.has(row.registrationId)) continue;
    latest.set(row.registrationId, {
      submissionId: row.submissionId,
      locale: toDocLocale(row.locale),
      acceptedAt: row.acceptedAt,
      docSet: row.docSet,
    });
  }
  return latest;
}

/**
 * Everyone entered for an event and whether a Statement can be produced for
 * them — the statements list.
 *
 * Ordered by surname like the roster's name sort, because this page is read
 * down looking for one runner, not paged like the roster: an event night is a
 * few dozen entries and the print links have to be reachable without hunting
 * through pages.
 */
export async function getStatementRoster(eventSlug: string): Promise<StatementRosterRow[]> {
  await requireAdmin(defaultLocale, "personal_data");
  const db = getDb();
  const [rows, consents] = await Promise.all([
    db
      .select({
        registrationId: eventRegistrations.id,
        status: eventRegistrations.status,
        bib: eventRegistrations.bib,
        firstName: users.firstName,
        lastName: users.lastName,
        name: users.name,
        email: users.email,
      })
      .from(eventRegistrations)
      .innerJoin(users, eq(eventRegistrations.userId, users.id))
      .where(eq(eventRegistrations.eventSlug, eventSlug))
      .orderBy(users.lastName, users.name),
    readConsentSummaries(eventSlug),
  ]);

  return rows.map((row) => ({
    registrationId: row.registrationId,
    name: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.name,
    email: row.email,
    bib: row.bib,
    status: row.status as ParticipationStatus,
    consent: consents.get(row.registrationId) ?? null,
  }));
}

/** One registration's Statement, or the honest absence of one. */
export type PrintedStatement =
  | {
      state: "statement";
      registrationId: string;
      /** The snapshot's name — what the document itself says, not the account's. */
      runnerName: string;
      docSlug: string;
      docVersion: string;
      /** The language recorded on the submission: the operative text. */
      submissionLocale: DocLocale;
      /** The language these bytes are in — `submissionLocale` unless switched. */
      lang: DocLocale;
      usedFallback: boolean;
      acceptedAt: Date;
      /** The moment of acceptance in Europe/Warsaw, in `lang`. */
      acceptedAtLabel: string;
      /** Filled document HTML, safe to inject. */
      html: string;
    }
  | {
      state: "noConsent";
      registrationId: string;
      /** From the account, the only name there is when nothing was captured. */
      runnerName: string;
    };

export type StatementsForPrint = {
  event: EventSummary;
  /** In the order the ids were requested, minus the ones that were not found. */
  statements: PrintedStatement[];
  /**
   * Ids that name no registration of this event — another night's, or a stale
   * link. Reported so the surface can say so; never rendered, because a
   * statement is only ever printed in the context of the event it belongs to.
   */
  unknownIds: string[];
};

/**
 * The Statements for a set of registrations, ready to print.
 *
 * Gated on `personal_data` (ADR 0007) before a single row is read. Returns
 * `null` when the slug names no event on the current stack (an unknown slug, or
 * the frozen legacy team event), which is the caller's 404. A manager-entered
 * `team` night belongs here: its members' consent is recorded by the same
 * `consent_submissions` rows against the team document set (PRD #64), so the
 * printer needs no team branch.
 *
 * `printLocale` overrides the language of every document in the batch; omitted,
 * each one renders in the locale its own submission recorded — that is the text
 * the runner read and the legally operative one, and a mixed-language batch is
 * the correct output for a mixed-language field.
 */
export async function getStatementsForPrint(
  eventSlug: string,
  registrationIds: string[],
  printLocale?: Locale,
): Promise<StatementsForPrint | null> {
  await requireAdmin(defaultLocale, "personal_data");

  const event = await getEventBySlug(eventSlug);
  if (!isSeriesEvent(event)) return null;

  const ids = [...new Set(registrationIds)].filter(Boolean);
  if (ids.length === 0) return { event, statements: [], unknownIds: [] };

  const db = getDb();
  const registrations = await db
    .select({
      registrationId: eventRegistrations.id,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
    })
    .from(eventRegistrations)
    .innerJoin(users, eq(eventRegistrations.userId, users.id))
    // Scoped to the event in the URL as well as the ids: a statement carries
    // personal data, and an id copied from another night must not render just
    // because the caller may read *some* event's statements.
    .where(
      and(eq(eventRegistrations.eventSlug, eventSlug), inArray(eventRegistrations.id, ids)),
    );

  const byId = new Map(registrations.map((r) => [r.registrationId, r]));
  const unknownIds = ids.filter((id) => !byId.has(id));
  const found = ids.filter((id) => byId.has(id));
  if (found.length === 0) return { event, statements: [], unknownIds };

  const submissions = await db
    .select()
    .from(consentSubmissions)
    .where(inArray(consentSubmissions.registrationId, found))
    .orderBy(desc(consentSubmissions.acceptedAt));

  const latest = new Map<string, (typeof submissions)[number]>();
  for (const row of submissions) {
    if (!latest.has(row.registrationId)) latest.set(row.registrationId, row);
  }

  // One read for every box ticked in the batch: the Statement's own row is what
  // names the version the attestation prints.
  const submissionIds = [...latest.values()].map((s) => s.id);
  const consentRows =
    submissionIds.length === 0
      ? []
      : await db
          .select()
          .from(registrationConsents)
          .where(inArray(registrationConsents.submissionId, submissionIds));

  // Labels are fetched once per language in the batch, not once per statement.
  const labelCache = new Map<DocLocale, AttestationLabels>();
  const labelsFor = async (locale: DocLocale) => {
    const cached = labelCache.get(locale);
    if (cached) return cached;
    const labels = await getAttestationLabels(locale);
    labelCache.set(locale, labels);
    return labels;
  };

  const statements: PrintedStatement[] = [];
  for (const id of found) {
    const registration = byId.get(id)!;
    const runnerName =
      [registration.firstName, registration.lastName].filter(Boolean).join(" ") ||
      registration.name;
    const submission = latest.get(id);
    if (!submission) {
      statements.push({ state: "noConsent", registrationId: id, runnerName });
      continue;
    }

    // Every submission since #53/#68 records its own set; the fallback only
    // covers rows older than that, which predate mixed nights, so the event's
    // first set is the right one for them.
    const doc = personalisedDoc(submission.docSet ?? docSetsForEventType(event.eventType)[0]);
    if (!doc) {
      // A set with no personalised document has no Statement to print. Not
      // reachable for either shipped set; treated as "nothing on record"
      // rather than crashing a batch of statements that are fine.
      statements.push({ state: "noConsent", registrationId: id, runnerName });
      continue;
    }

    const submissionLocale = toDocLocale(submission.locale);
    const target = printLocale ?? submissionLocale;
    const { html: source, lang, usedFallback } = loadLegalDoc(doc, target);
    const labels = await labelsFor(lang);
    const recorded = consentRows.find(
      (row) => row.submissionId === submission.id && row.docSlug === doc.slug,
    );

    statements.push({
      state: "statement",
      registrationId: id,
      runnerName: submission.snapshot.fullName || runnerName,
      docSlug: doc.slug,
      // The version *recorded* against this acceptance, not the manifest's
      // current one: two runners in one event may hold consent to different
      // versions, which is what the column is for.
      docVersion: recorded?.docVersion ?? doc.version,
      submissionLocale,
      lang,
      usedFallback,
      acceptedAt: submission.acceptedAt,
      acceptedAtLabel: formatWarsawMoment(lang, submission.acceptedAt),
      html: renderStatementHtml({
        source,
        lang,
        eventDate: event.date,
        snapshot: submission.snapshot,
        facts: {
          fullName: submission.snapshot.fullName || runnerName,
          acceptedAt: submission.acceptedAt,
          docSlug: doc.slug,
          docVersion: recorded?.docVersion ?? doc.version,
          ip: submission.ip,
          recordId: submission.id,
        },
        labels,
      }),
    });
  }

  return { event, statements, unknownIds };
}

/** The one personalised document in a set — the Statement. */
function personalisedDoc(set: DocSet): LegalDoc | undefined {
  return getDocsForSet(set).find((doc) => doc.personalised);
}
