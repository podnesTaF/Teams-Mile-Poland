import { Eyebrow } from "@/components/ui/eyebrow";
import { Rank } from "@/components/ui/rank";
import { ROLES } from "@/lib/marketing/event";

export function RoleCards() {
  return (
    <div className="mt-7 grid grid-cols-1 border border-ink md:grid-cols-3">
      {ROLES.map((role, idx) => (
        <div
          key={role.name}
          className={
            "border-b border-ink p-7 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0" +
            (idx === 0 ? "" : "")
          }
        >
          <div className="mb-[18px] flex items-center gap-3">
            <Rank
              rank={role.rank}
              intent={role.accent ? "red" : "ink"}
              size="lg"
            />
            <Eyebrow>{role.detail}</Eyebrow>
          </div>
          <h4 className="mb-2 font-display text-[28px] font-black italic uppercase leading-none tracking-tight">
            {role.name}
          </h4>
          <p className="text-sm leading-relaxed text-muted">{role.line}</p>
        </div>
      ))}
    </div>
  );
}
