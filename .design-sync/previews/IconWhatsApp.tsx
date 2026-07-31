import { IconWhatsApp, Section } from "teams-mile-warshaw";

/* IconWhatsApp is a bare inline SVG with no intrinsic size cap, so each cell
 * pins the size with height/width utilities; colour comes from currentColor. */

export function Sizes() {
  return (
    <div className="flex items-end gap-8 p-6 text-ink">
      <div className="flex flex-col items-center gap-2">
        <IconWhatsApp className="h-4 w-4" />
        <span className="font-mono text-xs text-muted">h-4 w-4</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <IconWhatsApp className="h-5 w-5" />
        <span className="font-mono text-xs text-muted">h-5 w-5</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <IconWhatsApp className="h-6 w-6" />
        <span className="font-mono text-xs text-muted">h-6 w-6</span>
      </div>
    </div>
  );
}

/* Section tone="dark" is used rather than a bare bg-ink div because it
 * supplies text-white — the colour the logo fill inherits. */
export function OnSurfaces() {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 bg-bg p-6 text-ink">
        <IconWhatsApp className="h-6 w-6" />
        <span className="font-mono text-xs uppercase text-muted">Ink on white</span>
      </div>
      <div className="flex items-center gap-4 bg-bg-2 p-6 text-accent">
        <IconWhatsApp className="h-6 w-6" />
        <span className="font-mono text-xs uppercase text-muted">Accent on muted</span>
      </div>
      <Section tone="dark" size="sm">
        <div className="flex items-center gap-4">
          <IconWhatsApp className="h-6 w-6" />
          <span className="font-mono text-xs uppercase text-white">White on dark</span>
        </div>
      </Section>
    </div>
  );
}

/* Where it actually appears: a contact link beside its label, in the row of
 * share links on the registration success dialog (success-modal.tsx). */
export function ContactLink() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <p className="font-mono text-xs uppercase text-muted">
        Warsaw · 22 August 2026
      </p>
      <a
        href="https://chat.whatsapp.com/ace-battle-warsaw"
        className="flex items-center gap-3 border border-line bg-bg p-4 text-ink"
      >
        <IconWhatsApp className="h-5 w-5" />
        <span className="font-bold">Join the WhatsApp group</span>
      </a>
      <a
        href="https://wa.me/48000000000"
        className="flex items-center gap-2 text-accent"
      >
        <IconWhatsApp className="h-4 w-4" />
        <span>Message the race office</span>
      </a>
    </div>
  );
}
