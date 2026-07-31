import { Button, Cbx, FloatField, Modal, ModalBody, ModalFoot, ModalHead } from "teams-mile-warshaw";

/* Two things every Modal preview needs:
 *
 * 1. A wrapper carrying `transform`. `.modal-overlay` and `.modal-close` are
 *    `position: fixed`, so without a containing block they leave the card's
 *    flow entirely — the root measures ~0px tall and the screenshot catches
 *    only a sliver of the backdrop. A transformed ancestor makes `fixed`
 *    resolve against it instead, so the dialog renders inside the card.
 * 2. showLogo={false} — the overlay wordmark loads
 *    /brand/ace-battle-poland.svg from the host app, which is not served here.
 */
function Stage({ children, height = 600 }: { children: React.ReactNode; height?: number }) {
  return (
    <div
      className="relative w-full overflow-hidden bg-bg-2"
      style={{ height, transform: "translateZ(0)" }}
    >
      {children}
    </div>
  );
}

export function RegistrationDialog() {
  return (
    <Stage>
      <Modal open onClose={() => {}} size="md" showLogo={false}>
        <ModalHead
          subTag="Step 2 of 3"
          title="Who is running?"
          sub="Add all four runners."
        />
        <ModalBody>
          <FloatField label="Team name" defaultValue="Vistula Pacers" />
          <FloatField label="Captain's email" type="email" defaultValue="marta@abmwarsaw.pl" />
        </ModalBody>
        <ModalFoot>
          <Button intent="primary" block>
            Continue
          </Button>
          <Cbx id="preview-news" checked onChange={() => {}}>
            Send me race updates
          </Cbx>
        </ModalFoot>
      </Modal>
    </Stage>
  );
}

export function SoftWithBackStep() {
  return (
    <Stage height={420}>
      <Modal open onClose={() => {}} onBack={() => {}} soft showLogo={false}>
        <ModalHead titleSize="sm" title="Confirm your entry" sub="One team, four runners." />
        <ModalFoot>
          <Button intent="primary" block>
            Pay €120
          </Button>
          <Button intent="link">Back to team details</Button>
        </ModalFoot>
      </Modal>
    </Stage>
  );
}
