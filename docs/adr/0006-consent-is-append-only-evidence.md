# Consent is append-only evidence, not a boolean

Registration recorded acceptance as `event_registrations.terms`, a boolean that
`createFreeRegistration` set to a hardcoded `true` — it could not say which
document, which version, which language, or when. Adopting the lawyer-approved
document corpus from the `acebattle-forms` module, we replace it with
`registration_consents`: append-only rows written in the same transaction as the
registration, one per checkbox, each carrying the document slug, its declared
version, the locale actually shown, the timestamp, and the request IP/user-agent.

## Considered options

**A boolean or a timestamp column on `event_registrations`.** Cheapest, and
unable to answer the only question that matters when a document is re-issued:
which text did this person actually accept. Also grows a legal annex onto a table
already carrying bib leases and heat seeding.

**One row per document, checkboxes as jsonb.** Fewer rows, but buries image
consent — the one value that must be queryable, because gallery publication
depends on it — inside a jsonb blob.

**Backfilling rows for the 197 pre-existing registrations.** Rejected outright.
Those acceptances were never captured; synthesising rows that assert a named
person accepted a named version at a named moment would be manufacturing
evidence, and a record that looks like evidence and is not is worse than an empty
table. Consent history begins when this ships. `terms` stays as a deprecated
column, readable for the historical rows, and is exactly as meaningful as it ever
was.

## Consequences

Rows carry a `kind` discriminator — `acceptance` (contractual, e.g. the Rules),
`declaration` (testimony about a moment, e.g. "I am 18 and fit to run"), and
`consent` (GDPR art. 6(1)(a), today only image use). Only `consent` rows may ever
carry a `withdrawnAt`; withdrawing a declaration is incoherent, and without the
discriminator a withdrawal path would either allow it or need retrofitting onto a
table that is append-only by design.

The token values printed into the Statement (`__FULL_NAME__`, `__BIRTH_DATE__`,
`__PHONE_EMAIL__`, `__ADDRESS__`, `__EMERGENCY_CONTACT__`) are **snapshotted**
into the consent row, deliberately duplicating `users` data that the runner can
edit at any time. A document rendered from live profile data is a reconstruction,
not a record: correct a surname in October and the August statement silently
changes. The snapshot is supposed to drift.

Emergency contact is captured per registration rather than as a profile field —
adding it to `isProfileComplete` would flip every existing user to incomplete and
bounce them off the register gate, and a contact person is a fact about race day,
not a permanent attribute. It is prefilled from the runner's most recent snapshot.

Consent is written atomically with the registration, so the returning-guest
auto-complete shortcut in `register-confirm.tsx` is removed: every registration
has a fresh acceptance, and "a signed statement exists for every registration"
becomes an invariant rather than a hope.
