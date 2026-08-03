import { FloatField, ModalBody, ModalHead } from "teams-mile-warshaw";

/* ModalBody is a 12px-gap vertical stack and nothing else; the panel colour,
 * ink and padding come from `.modal`. Each cell reproduces that dialog
 * surface rather than using the fixed-position `Modal` overlay. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex w-full items-center justify-center bg-bg-2"
      style={{ minHeight: 620, padding: 32 }}
    >
      <div className="modal" style={{ maxWidth: 420 }}>
        {children}
      </div>
    </div>
  );
}

export function TeamDetailsFields() {
  return (
    <Panel>
      <ModalHead titleSize="sm" subTag="Step 1 of 3" title="Team details" />
      <ModalBody>
        <FloatField label="Team name" defaultValue="Vistula Pacers" />
        <FloatField label="Club" />
        <FloatField label="Captain's email" type="email" defaultValue="marta@abmwarsaw.pl" />
      </ModalBody>
    </Panel>
  );
}

export function RunnerWithSelect() {
  return (
    <Panel>
      <ModalHead titleSize="sm" subTag="Runner 3 of 4" title="Add a runner" />
      <ModalBody>
        <FloatField label="Full name" defaultValue="Kamila Nowak" />
        <FloatField as="select" label="Leg" defaultValue="3">
          <option value="1">Leg 1</option>
          <option value="2">Leg 2</option>
          <option value="3">Leg 3</option>
          <option value="4">Leg 4</option>
        </FloatField>
        <FloatField label="Mile personal best (mm:ss)" />
      </ModalBody>
    </Panel>
  );
}

export function CopyOnly() {
  return (
    <Panel>
      <ModalHead titleSize="sm" title="Entry fee" />
      <ModalBody>
        <p>
          One entry covers all four runners: €120 per team. The prize fund for the
          Warsaw race is €8,000, split across the first three teams home.
        </p>
        <p>Payment is taken once every runner on your roster is confirmed.</p>
      </ModalBody>
    </Panel>
  );
}
