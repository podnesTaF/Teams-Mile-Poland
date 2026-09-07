export function RequiredMark({ requiredHint }: { requiredHint: string }) {
  return (
    <span className="required-asterisk" aria-label={requiredHint} title={requiredHint}>
      *
    </span>
  );
}
