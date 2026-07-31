import { FloatField } from "teams-mile-warshaw";

export function TextFields() {
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <FloatField label="Team name" name="team" />
      <FloatField label="Captain's email" type="email" defaultValue="marta@abmwarsaw.pl" />
    </div>
  );
}

export function WithErrorAndHint() {
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <FloatField label="Captain's email" type="email" defaultValue="marta@" error="Enter a valid email address" />
      <FloatField label="Club" hint="Leave empty if you are running unattached" />
    </div>
  );
}

export function SelectAndTextarea() {
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <FloatField as="select" label="Team size" defaultValue="4">
        <option value="4">4 runners</option>
        <option value="6">6 runners</option>
      </FloatField>
      <FloatField
        as="textarea"
        label="Anything we should know?"
        rows={3}
        defaultValue="Two of our runners arrive on the morning of the race."
      />
    </div>
  );
}
