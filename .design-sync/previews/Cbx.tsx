import { Cbx } from "teams-mile-warshaw";

/* Canonical use: the consent rows at the bottom of the team registration
 * modal. Controlled, so `checked` is set directly and `onChange` is a no-op
 * — that renders both states statically. */
export function ConsentRows() {
  return (
    <div className="flex max-w-md flex-col gap-5 bg-bg p-6">
      <Cbx id="cbx-rules" checked onChange={() => {}}>
        I have read the{" "}
        <a href="/rules">Teams Mile Warsaw race regulations</a> and confirm all
        four runners in my team are 18 or over on race day.
      </Cbx>
      <Cbx id="cbx-terms" checked={false} onChange={() => {}}>
        I accept the <a href="/terms">terms of entry</a> and the{" "}
        <a href="/privacy">privacy policy</a>. Entry fees are non-refundable
        after 31 July 2026.
      </Cbx>
      <Cbx id="cbx-news" checked={false} onChange={() => {}}>
        Send me start times, heat draws and results for the August 2026 race.
      </Cbx>
    </div>
  );
}

/* `inline` — the tighter single-line variant used for the contact-method row
 * in the enquiry modal. */
export function InlineOptIns() {
  return (
    <div className="flex max-w-md flex-col gap-4 bg-bg p-6">
      <span className="font-mono text-muted">Reach the captain on</span>
      <div className="flex flex-wrap gap-6">
        <Cbx id="cbx-wa" inline checked onChange={() => {}}>
          WhatsApp
        </Cbx>
        <Cbx id="cbx-tg" inline checked={false} onChange={() => {}}>
          Telegram
        </Cbx>
        <Cbx id="cbx-email" inline checked onChange={() => {}}>
          Email
        </Cbx>
      </div>
    </div>
  );
}

/* Both states side by side at the same size, so the accent-red fill and the
 * empty square can be compared directly. */
export function CheckedAndUnchecked() {
  return (
    <div className="grid max-w-md gap-6 bg-bg p-6">
      <Cbx id="cbx-on" checked onChange={() => {}}>
        Checked — captain confirms the €160 team entry fee.
      </Cbx>
      <Cbx id="cbx-off" checked={false} onChange={() => {}}>
        Unchecked — team photo may be used in race coverage.
      </Cbx>
    </div>
  );
}
