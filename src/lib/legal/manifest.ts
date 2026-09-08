/**
 * The legal document manifest — the config half of "consent is evidence".
 *
 * The corpus itself is content: pandoc-converted HTML from the lawyer-approved
 * `.docx` files, living under `src/content/legal/<locale>/<slug>.html` (see that
 * folder's README). This module is the *registry* over it: which documents exist,
 * which set they belong to, what version each declares, whether it is signable,
 * whether it is personalised, and the sha256 of every registered file.
 *
 * Why the hashes are here and not derived. Regenerating a document from an
 * updated `.docx` silently overwrites the hand-placed fill tokens
 * (`__EVENT_DATE__`, `__FULL_NAME__`, …) and restores the hardcoded date of one
 * particular race night — the reference module's own README warns about exactly
 * that. A declared version alone cannot catch it, because a routine pandoc rerun
 * does not touch this file. So the manifest carries bytes-level identity and
 * `scripts/check-legal-manifest.ts` fails `npm run build` when disk and manifest
 * disagree. Git is the byte archive, so `version → commit → bytes` still
 * reconstructs the exact text a consent row names; the hash is the tripwire, not
 * the archive.
 *
 * **Imports here stay relative.** This module is read by `scripts/*.ts` under
 * `tsx`, which resolves neither the `@/` alias nor Next's module graph — the same
 * reason `src/db/schema/events.ts` imports its types relatively for drizzle-kit.
 * Keep it dependency-free: types and literals only, no `node:fs`, no DB.
 */

import type { EventType } from "../events/types";

/** Which corpus a document belongs to. One set applies per event. */
export type DocSet = "individual" | "team";

/**
 * The documents a participant is asked to accept. These are the seven slugs the
 * PRD froze; a consent row's `doc_slug` is always one of them.
 */
export type SignableDocSlug =
  | "oswiadczenie"
  | "przepisy"
  | "rodo"
  | "team-oswiadczenie"
  | "team-regulations"
  | "team-rules"
  | "team-rodo";

/**
 * Documents that ship with a set and are published for reading, but are never
 * ticked: the TEAM MILE appendices. Nothing signs them, so nothing stores their
 * slug, which is why they sit outside {@link SignableDocSlug} rather than
 * widening it — the contract's shape for a signable document is untouched.
 *
 * Załącznik 2 is deliberately absent. It is the organisers' and judges' own
 * schedule, internal in the source module and internal here: its file is in the
 * repository, unregistered, exactly like the `ru` files.
 */
export type ReadOnlyDocSlug =
  | "team-appendix1"
  | "team-appendix3"
  | "team-appendix4"
  | "team-appendix5";

/** Any document this app publishes. */
export type DocSlug = SignableDocSlug | ReadOnlyDocSlug;

/**
 * What a ticked box *is*, legally (ADR 0006). `acceptance` is contractual,
 * `declaration` is testimony about a moment, `consent` is GDPR art. 6(1)(a) —
 * and only the last may ever be withdrawn.
 */
export type ConsentKind = "acceptance" | "declaration" | "consent";

/** The application locales a document may be registered in. `ru` is not one. */
export type DocLocale = "pl" | "en" | "ua";

/** Identity of one file: the bytes the manifest vouches for. */
export type DocFile = { sha256: string };

/**
 * A registered document.
 *
 * The union is the one deviation from the PRD's single `LegalDoc` type, and it
 * exists to keep that type *stronger* where it matters. A signable document has
 * `locales: Record<"pl" | "en" | "ua", DocFile>` exactly as the contract states —
 * total, so the compiler alone rejects a missing translation and the build guard
 * catches a missing file. A read-only appendix may legitimately lack a
 * translation (the reference corpus has a Polish-only Regulamin), so its map is
 * partial with `pl` required as the fallback source. Collapsing both into one
 * partial map would have weakened the signable case — the case the whole feature
 * exists to protect — so the split is deliberate.
 *
 * `eventless` is optional and absent by default, because the event-scoped route
 * is the norm: a document is only flagged when its text names no race night at
 * all. Concretely that means *no fill token in any registered locale* — a
 * flagged document is published at `/[locale]/legal/<slug>` with nothing to fill
 * it from, so a surviving `__EVENT_DATE__` would print as literal prose to a
 * reader with no way to know what date was meant. The flag is a claim about the
 * bytes, so `src/lib/legal/check.ts` verifies it against the bytes and fails the
 * build naming the file — the same treatment the sha256 gets, for the same
 * reason: a pandoc rerun can reintroduce a token without touching this file.
 */
export type LegalDoc =
  | {
      slug: SignableDocSlug;
      set: DocSet;
      /** "2026-08-20" — what a consent row stores. Bumped by hand on re-issue. */
      version: string;
      signable: true;
      /** True only for the Statement: the document that prints personal tokens. */
      personalised: boolean;
      /** See {@link LegalDoc} — publishable at `/[locale]/legal/<slug>`. */
      eventless?: true;
      locales: Record<DocLocale, DocFile>;
    }
  | {
      slug: ReadOnlyDocSlug;
      set: DocSet;
      version: string;
      signable: false;
      personalised: boolean;
      /** See {@link LegalDoc} — publishable at `/[locale]/legal/<slug>`. */
      eventless?: true;
      locales: { pl: DocFile } & Partial<Record<DocLocale, DocFile>>;
    };

/** One checkbox on the consent form, resolved against a document. */
export type ConsentItem = {
  /** Stable id — stored on the consent row and used as the message key. */
  id: string;
  set: DocSet;
  docSlug: DocSlug;
  kind: ConsentKind;
  required: boolean;
};

/**
 * The corpus, in publication order per set.
 *
 * Versions come from the documents themselves where they print one: the TEAM
 * MILE set carries "Data przyjęcia: 01.09.2026" in its Rules and appendices, so
 * the whole set declares `2026-09-01`. The individual set prints no version date
 * anywhere in its text — the only dates in it are the tokenised event date — so
 * it declares the PRD's version string, `2026-08-20`, and a re-issue bumps it by
 * hand alongside the hash.
 */
export const LEGAL_DOCS: readonly LegalDoc[] = [
  {
    slug: "oswiadczenie",
    set: "individual",
    version: "2026-08-20",
    signable: true,
    personalised: true,
    locales: {
      pl: { sha256: "a5e8f501ef681f30e3c95974b84be6ef5998ffbc37881cf0a4a3df195d7c6e84" },
      en: { sha256: "0ff7421f2db4ceb82fb1bcd0582a8ad1082103c0b78172b75e8dee9903f21a2e" },
      ua: { sha256: "07774a199d5942880c86665fee449155f7678c9c2ad10db1357f65c923d1406f" },
    },
  },
  {
    slug: "przepisy",
    set: "individual",
    version: "2026-08-20",
    signable: true,
    personalised: false,
    locales: {
      pl: { sha256: "4ac83f5c4137e6f0675ddff2bdec389cf2429f65ad312f64ad0438ea2f83f56a" },
      en: { sha256: "dfe0d224073287746ca1930ca39f700a794db1a68683f64b28b83897cd242476" },
      ua: { sha256: "96356b3de4a0e8ecd152e3a6f8d91e1e6d4d04092bfc15d4f306fc5dcc8cac36" },
    },
  },
  {
    slug: "rodo",
    set: "individual",
    version: "2026-08-20",
    signable: true,
    personalised: false,
    locales: {
      pl: { sha256: "30fa4bd481cb6dc53a9288b50636fb4257840964c047f1aa66a95c39fb83fc2b" },
      en: { sha256: "7f0bd6d3bf0237b8c211b293e3bede4bf51b07c02ee1ceb189cd29e256452e98" },
      ua: { sha256: "59922f62e463422daf0174363a91cf53490a5fd0cc542d859978fa9e11f8089b" },
    },
  },
  {
    slug: "team-oswiadczenie",
    set: "team",
    version: "2026-09-01",
    signable: true,
    personalised: true,
    locales: {
      pl: { sha256: "5a64fdf4a99458565c9bc909a3538a006224807e242eaf7cdf921f5e1fd7d555" },
      en: { sha256: "fab4093049e08e1e29a7fc59b90ba94bc8979ac9768995a18e4b55560b6c0b56" },
      ua: { sha256: "4f81663db757f6ac1aba23704621bc213f427343d341bf0ba87137d1546ffecb" },
    },
  },
  {
    slug: "team-regulations",
    set: "team",
    version: "2026-09-01",
    signable: true,
    personalised: false,
    eventless: true,
    locales: {
      pl: { sha256: "888338486a89474bc35e337ba6b426472720aaa2056b5d2f901f70edeb27fc0f" },
      en: { sha256: "41d54ed39ccc5448f185d88633ff6452715a9b04afd3752e97766ca0bdf78c12" },
      ua: { sha256: "4f3efbe00e1bbb0f75d520c23775d7d180943432635d72e5190f3a1ef0963acb" },
    },
  },
  {
    slug: "team-rules",
    set: "team",
    version: "2026-09-01",
    signable: true,
    personalised: false,
    eventless: true,
    locales: {
      pl: { sha256: "493c085b309742fa98dff37b2de81ac072876efe0071493d6300615565718eda" },
      en: { sha256: "a3a110808be7e24d7a9b1cb3f6cf56fb74ffca8ee416b014b087e7fc308138b4" },
      ua: { sha256: "788ee036a6fb228097272284c615a897cd9c2a3c9934118182f07d5196a5a09a" },
    },
  },
  {
    slug: "team-rodo",
    set: "team",
    version: "2026-09-01",
    signable: true,
    personalised: false,
    locales: {
      pl: { sha256: "0dc695dddca5bc744913c490bc09cbc4a14f4c1add9066dd18bc82fa65f9524f" },
      en: { sha256: "f32902094eb04597120f7d5fd13a9579e2d27b5c169ce17c49ab413c3671074b" },
      ua: { sha256: "64ae197edb4a8180092eacff4e0f05d35f503d7740834438b4e8422e2a450aa6" },
    },
  },
  {
    slug: "team-appendix1",
    set: "team",
    version: "2026-09-01",
    signable: false,
    personalised: false,
    eventless: true,
    locales: {
      pl: { sha256: "32f50865d2be4d6253ec33fb88fc17e4a79333e1202af7eac496bf4d8097d9db" },
      en: { sha256: "6423003198e67072b6008a58ed1ea31e87b0c8c55253f5611adc864e3f95fef6" },
      ua: { sha256: "146c0563c710440863a37ee984fccda333cba5b84375e6a2cb2d3ee4bb0cbb22" },
    },
  },
  {
    slug: "team-appendix3",
    set: "team",
    version: "2026-09-01",
    signable: false,
    personalised: false,
    eventless: true,
    locales: {
      pl: { sha256: "51ffde1344e2b8ef16737bb94af89627ec52908c5a86e70f9deabbf002989ee1" },
      en: { sha256: "f8da443715f340eb78aed8e20a56f4d489de3e2b357db6e24306aa58e0239866" },
      ua: { sha256: "f08d169f4179b35f6e7967caaa36ae950baccc6409272e57cd59cdadfc27664e" },
    },
  },
  {
    slug: "team-appendix4",
    set: "team",
    version: "2026-09-01",
    signable: false,
    personalised: false,
    eventless: true,
    locales: {
      pl: { sha256: "dba59b2512a9f81c63abd687c2df7ce9f7a942f1db2435b8ac1db4e9873509f5" },
      en: { sha256: "f835a62c5427f79bddabab8a209caa557aefddb247bbbb9226d61567b7d35d85" },
      ua: { sha256: "e05180926703ce68a1373815bf751ec6a633d26cde253a630a74dab2a66285ed" },
    },
  },
  {
    slug: "team-appendix5",
    set: "team",
    version: "2026-09-01",
    signable: false,
    personalised: false,
    eventless: true,
    locales: {
      pl: { sha256: "c8e23bb95c411d22a4b435bc2733443005eae6c2fe159dd5ef1d396e32138ea7" },
      en: { sha256: "e01db767afdff3206ead62f68fa9f7bc924727ab08f8b507712fe35f7c2c8435" },
      ua: { sha256: "c81c948e6630170247f94d0567fa9a00b4084eb04210e5b4d9a403db51c8daa8" },
    },
  },
];

/**
 * Which corpus applies to an event.
 *
 * Total over {@link EventType} on purpose: adding a format is a compile error
 * here, not a runtime "no documents" that ships a registration with nothing to
 * accept. Both corpora are in the repository today, and both now carry a consent
 * form: the individual one at registration (#53), the team one on the member
 * confirmation screen (#68).
 */
export const DOC_SET_BY_EVENT_TYPE: Record<EventType, DocSet> = {
  individual: "individual",
  team: "team",
};

/**
 * {@link DOC_SET_BY_EVENT_TYPE} applied to an `EventSummary`, whose `eventType`
 * is optional and documented to default to `"team"` for the legacy events that
 * omit it. Callers should not re-spell that default.
 */
export function docSetForEventType(eventType: EventType | undefined): DocSet {
  return DOC_SET_BY_EVENT_TYPE[eventType ?? "team"];
}

/**
 * Both sets' consent forms, as data.
 *
 * Ported from the reference module's unified `register` dictionary — the five
 * required checkboxes plus the separate image question — rather than from its
 * per-document forms, because that is the form this app actually renders: one
 * confirm step covering the whole set. #53 reads this list to render the
 * checkboxes and validates a submission against it; the ids are what the
 * `registration_consents.item_id` column stores, so they are frozen once shipped.
 *
 * `imageUse` is `required: true` in the sense the PRD gives it: the runner must
 * *answer*, with `"agree"` or `"disagree"`. Refusing costs nobody their entry —
 * that is precisely why it is a separate `consent`-kind item rather than another
 * acceptance box.
 *
 * **The team set carries the same six ids** (PRD #64, "Team consent items are
 * frozen here"). PRD #50 left it empty on purpose — shipping speculative ids
 * before anyone had read the team form would have frozen the wrong ones — and
 * the member confirmation screen (#68) cannot exist without them, so #66 freezes
 * them against the TEAM MILE documents. Identical ids, different `docSlug` and
 * different labels: the statements printer (#54), `validateConsentItems`,
 * `buildConsentRows` and `termsAcceptedFrom` are then set-agnostic and needed no
 * team branch, and a `registration_consents` row still says which document
 * version was accepted because `docSlug` and `docVersion` travel with it
 * (ADR 0006).
 *
 * The mapping mirrors the individual one document for document: the item that
 * accepts the terms points at the set's **Public Regulations** (`przepisy` →
 * `team-regulations`), the declarations about age, health and prize data at the
 * **Statement** (`oswiadczenie` → `team-oswiadczenie`), the data ones at the
 * **GDPR clause** (`rodo` → `team-rodo`), and the image consent at the Statement
 * that contains it. `team-rules` — the sporting rulebook the composition and
 * check-in procedure come from — is deliberately *not* an item's document: it is
 * published for reading and linked from the team event page and from the label,
 * exactly as the individual set publishes documents nobody ticks separately.
 * Naming it here instead of the Regulations would have made the team member's
 * one contractual acceptance mean something different from the individual
 * runner's, which is the one thing a shared item id must not do.
 */
export const CONSENT_ITEMS: readonly ConsentItem[] = [
  {
    id: "rulesAndRegulations",
    set: "individual",
    docSlug: "przepisy",
    kind: "acceptance",
    required: true,
  },
  {
    id: "ageHealthRisks",
    set: "individual",
    docSlug: "oswiadczenie",
    kind: "declaration",
    required: true,
  },
  {
    id: "dataTruthfulAndRodo",
    set: "individual",
    docSlug: "rodo",
    kind: "declaration",
    required: true,
  },
  {
    id: "publicResultsAwareness",
    set: "individual",
    docSlug: "rodo",
    kind: "declaration",
    required: true,
  },
  {
    id: "prizeDataUnderstanding",
    set: "individual",
    docSlug: "oswiadczenie",
    kind: "declaration",
    required: true,
  },
  {
    id: "imageUse",
    set: "individual",
    docSlug: "oswiadczenie",
    kind: "consent",
    required: true,
  },
  {
    id: "rulesAndRegulations",
    set: "team",
    docSlug: "team-regulations",
    kind: "acceptance",
    required: true,
  },
  {
    id: "ageHealthRisks",
    set: "team",
    docSlug: "team-oswiadczenie",
    kind: "declaration",
    required: true,
  },
  {
    id: "dataTruthfulAndRodo",
    set: "team",
    docSlug: "team-rodo",
    kind: "declaration",
    required: true,
  },
  {
    id: "publicResultsAwareness",
    set: "team",
    docSlug: "team-rodo",
    kind: "declaration",
    required: true,
  },
  {
    id: "prizeDataUnderstanding",
    set: "team",
    docSlug: "team-oswiadczenie",
    kind: "declaration",
    required: true,
  },
  {
    id: "imageUse",
    set: "team",
    docSlug: "team-oswiadczenie",
    kind: "consent",
    required: true,
  },
];

/** Every registered slug, publication order. */
export const DOC_SLUGS: readonly DocSlug[] = LEGAL_DOCS.map((d) => d.slug);

/** Look up a registered document. `undefined` for an unknown slug — the 404. */
export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}

/** The documents belonging to one set, publication order. */
export function getDocsForSet(set: DocSet): LegalDoc[] {
  return LEGAL_DOCS.filter((d) => d.set === set);
}

/** The documents an event's participants are asked to accept. */
export function getSignableDocs(set: DocSet): LegalDoc[] {
  return getDocsForSet(set).filter((d) => d.signable);
}

/**
 * The consent form for a set, in manifest order — six items for either set,
 * with the same six ids and each set's own documents (see {@link CONSENT_ITEMS}).
 */
export function getConsentItems(set: DocSet): ConsentItem[] {
  return CONSENT_ITEMS.filter((i) => i.set === set);
}

/**
 * The documents publishable without an event, publication order.
 *
 * The one source for `/[locale]/legal/[doc]`: both its `generateStaticParams`
 * and its 404 check read this list, so a slug is prerendered exactly when it is
 * servable there and the event-scoped Statement can never leak onto a URL that
 * would imply it applied to no event in particular.
 */
export function getEventlessDocs(): LegalDoc[] {
  return LEGAL_DOCS.filter((d) => d.eventless === true);
}

/** Whether a document declares a file for a locale (read-only docs may not). */
export function hasLocale(doc: LegalDoc, locale: DocLocale): boolean {
  return Boolean(doc.locales[locale]);
}
