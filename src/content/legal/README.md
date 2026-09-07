# `src/content/legal` — the legal document corpus

The lawyer-approved documents, as content. Each file is the pandoc conversion of
an approved `.docx` (`pandoc -f docx -t html --wrap=none`), imported from the
`legal-example/` reference module — which stays in the repository unchanged as
the source of record for how it was produced.

## Layout

```
src/content/legal/<locale>/<slug>.html      locale ∈ pl | en | ua | ru
```

Flat per locale, and **the filename is the manifest slug** — team documents carry
their `team-` prefix in the name. There is no slug→path mapping to keep in step,
and `git log src/content/legal/pl/oswiadczenie.html` is the version history of
exactly one document in exactly one language.

| set | slug | in the manifest? |
|---|---|---|
| individual | `oswiadczenie`, `przepisy`, `rodo` | yes — signable |
| individual | `regulamin` (pl only), `lia`, `potwierdzenie` | no — organiser-internal |
| team | `team-oswiadczenie`, `team-regulations`, `team-rules`, `team-rodo` | yes — signable |
| team | `team-appendix1`, `team-appendix3`, `team-appendix4`, `team-appendix5` | yes — read-only |
| team | `team-appendix2`, `team-lia`, `team-potwierdzenie`, `team-captain` | no — organiser-internal |

Unregistered files are kept deliberately: the internal documents (Załącznik 2 is
the organisers' and judges' own schedule; LIA, its acknowledgement, the Regulamin
and the Team Captain provisions are working papers) and **every `ru` file**, since
`ru` is not an application locale. They are in the repository, they are not
published, and the build guard does not hash them.

## Fill tokens

The documents carry hand-placed `__TOKEN__` markers where the `.docx` had either
an underscore run to sign on or a date hardcoded to one race night.

| token | filled with | when |
|---|---|---|
| `__EVENT_DATE__` | the event's real date, spelled out | already on the public preview |
| `__SIGN_DATE__` | when consent was actually recorded | only on a signed statement |
| `__FULL_NAME__`, `__BIRTH_DATE__`, `__PHONE_EMAIL__`, `__ADDRESS__`, `__EMERGENCY_CONTACT__` | the snapshot on the consent record | only on a signed statement |
| `__SIGNATURE_BLOCK__` | the electronic attestation | only on a signed statement |
| `__DOC_VERSION_DATE__` | a document's own issue date | supported; no document places it today |

`__SIGNATURE_BLOCK__` replaced the blank underscore run under the "Legible
participant signature" label in all eight Oświadczenie files (individual and
team × pl/en/ua/ru). Anything unfilled renders as a visible ruled gap
(`.fill-blank`), never as an empty string — an unfilled field must look
unfilled. Substitution lives in `src/lib/legal/fill.ts`.

> The label wording itself is pending the lawyer's revision in all four
> languages, now that an attestation sits under it rather than a pen.

## Regenerating a document

**A pandoc rerun destroys the tokens.** It restores the original `.docx` text,
which means the fill tokens are gone and a date hardcoded to one particular race
night is back. Nothing about the page would look broken — it would simply print
the wrong night. So:

```bash
pandoc -f docx -t html --wrap=none "path/to/Document.docx" \
  -o src/content/legal/<locale>/<slug>.html
# then re-place every __TOKEN__ the old file had, by diffing against git:
git diff src/content/legal/<locale>/<slug>.html
```

Then update the manifest — this is the only time you should:

```bash
npm run legal:hash              # report: which hashes changed
npm run legal:hash -- --write   # rewrite them in src/lib/legal/manifest.ts
```

and **bump that document's `version` by hand**. A consent row stores the version
string, so re-issued text under an unchanged version cannot be proved either way.

## The guard

`npm run build` runs `scripts/check-legal-manifest.ts` first and fails, naming
the file, when a registered document's bytes no longer match its manifest sha256,
or when a signable document is missing a `pl`, `en` or `ua` file. Run it alone
with `npm run legal:check`. See `src/lib/legal/check.ts` for why both are fatal.
