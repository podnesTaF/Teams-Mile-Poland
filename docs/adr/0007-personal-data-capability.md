# `personal_data` is a capability outside the nested ladder

`AdminCapability` was three strictly nested levels — `view ⊂ checkin ⊂ edit` —
and `roleHasCapability` grants `view` to every admin role, including
`admin_checkin`, the race-morning volunteer role that exists to run the QR
scanner. A signed Statement carries date of birth, home address, phone, and an
emergency contact's name and number, so putting the consent print surface behind
`view` would hand the most sensitive personal data in the app to the least-vetted
role by default. We add a fourth capability, `personal_data`, granted to `admin`
alone.

## Consequences

**The nesting invariant is gone.** `admin_checkin` holds `checkin` but not
`personal_data`, so capabilities are no longer a ladder and the doc comment in
`src/lib/auth/roles.ts` that says "strictly nested (view ⊂ check-in ⊂ edit)" must
be corrected rather than left to mislead. That property was pleasant, but it was
a property of a permission model designed before any surface held this class of
data — and "volunteers may scan bibs but may not read addresses" is precisely the
distinction a permission model exists to express.

Reusing `edit` was the alternative that preserved the ladder. It was rejected
because `edit` means *may mutate*, reading a statement mutates nothing, and the
overload breaks the first time someone needs a read-only legal reviewer who must
not touch anything else.

Hard to reverse in practice: roles are granted to real people, so narrowing the
capability later means auditing who already has it.
