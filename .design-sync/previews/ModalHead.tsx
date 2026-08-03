import { ModalHead } from "teams-mile-warshaw";

/* ModalHead only carries flex-column spacing of its own — the italic display
 * title, the 32px padding and the `--form-ink` type colour all come from the
 * surrounding `.modal` panel. Rendering it bare would show unstyled text on
 * white, so every cell sits in the dialog surface it ships inside. The full
 * `Modal` is deliberately avoided: it is fixed-position and full-screen. */
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

export function RegistrationStep() {
  return (
    <Panel>
      <ModalHead
        id="reg-runners-title"
        subTag="Step 2 of 3"
        title="Who is running?"
        sub="Add all four runners; you can edit them later."
      />
    </Panel>
  );
}

export function CompactTitle() {
  return (
    <Panel>
      <ModalHead
        titleSize="sm"
        title="Confirm your entry"
        sub="One team of four, Warsaw, 22 August 2026."
      />
    </Panel>
  );
}

export function TitleOnly() {
  return (
    <Panel>
      <ModalHead title="Your team is in" />
    </Panel>
  );
}
