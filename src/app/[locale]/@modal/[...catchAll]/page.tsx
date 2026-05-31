// Catch-all for the @modal slot. Soft client navigations to any non-modal
// route keep the slot's last-active modal visible unless a route matches and
// renders null — this provides that null match so the modal closes.
export default function ModalCatchAll() {
  return null;
}
