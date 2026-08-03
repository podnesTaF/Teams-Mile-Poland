import { Eyebrow, PhoneField } from "teams-mile-warshaw";

/* Canonical use: the captain's phone on the team registration form.
 * Controlled — `value` is the full international number and `onChange`
 * receives the combined string, so a no-op renders the filled state
 * statically. `label` doubles as the placeholder, so a filled field gets a
 * caption above it the way the registration form does. */
export function Filled() {
  return (
    <div className="flex max-w-md flex-col gap-2 bg-bg p-6">
      <Eyebrow className="block">Captain&rsquo;s phone</Eyebrow>
      <PhoneField
        label="Captain's phone"
        value="+48512345678"
        onChange={() => {}}
      />
    </div>
  );
}

/* Empty — the label shows through as the placeholder on the number input,
 * and the picker sits at the Poland default (+48). */
export function Empty() {
  return (
    <div className="max-w-md bg-bg p-6">
      <PhoneField label="Phone number" value="" onChange={() => {}} />
    </div>
  );
}

/* `error` — accent-red border on both the dial code and the number, with the
 * message underneath. */
export function WithError() {
  return (
    <div className="flex max-w-md flex-col gap-2 bg-bg p-6">
      <Eyebrow className="block">Captain&rsquo;s phone</Eyebrow>
      <PhoneField
        label="Captain's phone"
        value="+48512"
        onChange={() => {}}
        error="Enter a full mobile number — we text the heat draw on race morning."
      />
    </div>
  );
}

/* Non-default dial codes: the picker follows the value, so an international
 * team keeps its own country while the field keeps the same height and border
 * treatment down the form. */
export function InternationalNumbers() {
  return (
    <div className="flex max-w-md flex-col gap-5 bg-bg p-6">
      <div className="flex flex-col gap-2">
        <Eyebrow className="block">Captain &middot; Praga Track Club</Eyebrow>
        <PhoneField label="Phone" value="+48601234567" onChange={() => {}} />
      </div>
      <div className="flex flex-col gap-2">
        <Eyebrow className="block">Captain &middot; Berlin Bahn Vier</Eyebrow>
        <PhoneField label="Phone" value="+4915112345678" onChange={() => {}} />
      </div>
      <div className="flex flex-col gap-2">
        <Eyebrow className="block">Captain &middot; Kyiv Mile Collective</Eyebrow>
        <PhoneField label="Phone" value="+380671234567" onChange={() => {}} />
      </div>
    </div>
  );
}
