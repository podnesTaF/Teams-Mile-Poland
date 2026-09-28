# Entry is paid in PLN by card through Stripe; ACER is a reward currency

Decided with the owner on 2026-09-25. Supersedes ADR 0013's choice of currency
(entry paid in ACER from a wallet or a treasury) and ADR 0010's price for
founding a team. The shape ADR 0013 settled — a price is a column on the event,
0 is free, the fee charged is the fee at the moment of entry — is kept.

## Decisions

1. **Entry fees are PLN, taken by card through Stripe Checkout.** `events`
   gains `individual_price_pln` and `team_price_pln` (migration 0030), whole
   PLN, `0` = free. The admin form offers these two instead of the ACER fees;
   `entryPricePln(event, path)` in `lib/events/types.ts` is the one reader.

2. **ACER fees are switched off, not deleted.** The ACER columns, the lock-and-
   debit inside `createRegistrationWithConsent` / `createEntryRows` and the
   ACER refunds stay. The form no longer posts an ACER fee, so saving a night
   writes 0. And wherever a door has a PLN price, its ACER fee is ignored in
   code, so a night is never charged in both.

3. **Nothing is written until the money settles.** A card-paid registration
   or team entry writes one `event_payments` row and redirects to Stripe. The
   webhook (`features/event-payments/fulfil.ts`) claims the row
   (`pending → processing`, so a redelivery is a no-op) and writes the
   registration with its consent evidence, or re-checks the roster and writes
   the team entry, exactly as the free path would. An abandoned checkout
   leaves no half-registered runner and no unpaid entry. A double click or a
   second tab reuses the open session instead of charging twice.

4. **A team entry is paid once, by whoever presses Enter** — the manager, or an
   admin acting for the team. Not from the treasury: that was ACER.

5. **No automatic card refunds.** Withdrawing, or cancelling the night, does
   not refund a card payment; an admin refunds from the Stripe dashboard if
   they choose to. A payment that settles but cannot be fulfilled (the runner
   registered another way meanwhile, a member turned out to be registered
   alone, the night was cancelled) is marked `failed` with the reason and
   logged as `PAID BUT NOT FULFILLED — refund needed`.

6. **Founding a team is free.** `TEAM_CREATION_PRICE_ACER` is 0. The four
   teams founded at 100 ACER before this keep that debit.

7. **The ACER top-up is off.** The purchase form on `/wallet` and the profile
   card's Top up button are commented out; balances and history still show.

## Data changes made with this decision

- `mile-2026-10-01`: ACER fees set to 0/0 (free), and the 5 ACER already taken
  from its four registrants refunded through `refundEventFees`.
- `mile-2026-10-10`: priced 25 zł individual / 40 zł team. Its one existing
  registrant keeps their place without paying in PLN, and their 5 ACER is
  refunded. Its ACER fees (5/100) were left on the row until this code
  deploys, so the previous deploy kept charging rather than going free; once
  deployed the PLN price overrides them (decision 2), and the next save of the
  night in admin writes them to 0.

## Consequences

- The Stripe webhook must subscribe to `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed` and `checkout.session.expired`.
- `event_payments` rows in `failed` are the refund to-do list.
- The ACER entry-fee copy in the catalogs is now dormant, not wrong: it shows
  only if someone prices a night in ACER by hand in the database.
