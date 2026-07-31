import { Button, Cbx, ModalFoot, ModalHead } from "teams-mile-warshaw";

/* ModalFoot is the 24px-gap action stack at the bottom of a dialog. On its own
 * it has no surface, so each cell reproduces the `.modal` panel instead of
 * mounting the fixed-position `Modal` overlay. */
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

export function PrimaryWithConsent() {
  return (
    <Panel>
      <ModalHead titleSize="sm" title="Confirm your entry" />
      <ModalFoot>
        <Button intent="primary" block>
          Pay €120
        </Button>
        <Cbx id="foot-terms" checked onChange={() => {}}>
          I accept the race rules and the refund policy for Teams Mile Warsaw.
        </Cbx>
        <Cbx id="foot-news" checked={false} onChange={() => {}}>
          Send me race updates before 22 August.
        </Cbx>
      </ModalFoot>
    </Panel>
  );
}

export function PrimaryAndBack() {
  return (
    <Panel>
      <ModalHead titleSize="sm" title="Runners added" sub="Four of four on the roster." />
      <ModalFoot>
        <Button intent="primary" block>
          Continue to payment
        </Button>
        <Button intent="link">Back to team details</Button>
      </ModalFoot>
    </Panel>
  );
}

export function SingleAction() {
  return (
    <Panel>
      <ModalHead titleSize="sm" title="You're on the start list" />
      <ModalFoot>
        <Button intent="primary" block>
          View your start time
        </Button>
      </ModalFoot>
    </Panel>
  );
}
