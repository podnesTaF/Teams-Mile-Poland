/** Headline stat tile used on admin dashboards. */
export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="iv-info">
      <div className="iv-info__label">{label}</div>
      <div className="iv-info__value">{value}</div>
    </div>
  );
}
