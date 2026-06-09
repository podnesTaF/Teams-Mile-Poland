import Image from "next/image";
import { useTranslations } from "next-intl";
import { Invite } from "./invite";

/** Team composition: 3 RUNNER · 2 ACE · 2 JOKER (badge letter × count). */
const COMP = [
  { id: "runner", badge: "R", count: 3 },
  { id: "ace", badge: "A", count: 2 },
  { id: "joker", badge: "J", count: 2 },
] as const;

const CARDS = [
  { id: "runner", badge: "R" },
  { id: "ace", badge: "A" },
  { id: "joker", badge: "J" },
] as const;

/**
 * "Ролі в команді" — the three roles section.
 * Sits between HowItGoes and Invite. Carries the red glow + chevron
 * vectors behind a two-column intro (copy + composition card) and a
 * three-card role grid.
 */
export function Roles() {
  const t = useTranslations("landing.roles");

  return (
    <section className="section roles" id="roles" data-screen-label="Roles">
      <Image
        className="roles__glow"
        src="/vectors/ellipse.svg"
        alt=""
        width={1352}
        height={1096}
        aria-hidden
      />
      <Image
        className="roles__chev"
        src="/landing/icons/roles-chevrons.svg"
        alt=""
        width={694}
        height={515}
        aria-hidden
      />
      <div className="wrap center">
        <div className="stack center" style={{ gap: 12 }}>
          <h2 className="head t-sec">{t("title")}</h2>
          <p className="sub-lead" style={{ marginTop: 0 }}>
            {t("lead")}
          </p>
        </div>

        <div className="roles-intro">
          <p className="head t-24 roles-intro__text">
            {t.rich("intro", {
              br: () => <br />,
              red: (chunks) => <span className="red">{chunks}</span>,
            })}
          </p>
          <div className="comp-card">
            <span className="head t-32 comp-card__title">{t("compTitle")}</span>
            <div className="comp-grid">
              {COMP.map((c) => (
                <div key={c.id} className="comp">
                  <span className="badges">
                    {Array.from({ length: c.count }).map((_, i) => (
                      <span key={i} className="badge">
                        {c.badge}
                      </span>
                    ))}
                  </span>
                  <span className="comp__label">{t(`comp.${c.id}`)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="role-cards">
          {CARDS.map((c) => (
            <article key={c.id} className="rcard">
              <span className="rcard__badge">{c.badge}</span>
              <h3 className="head t-24 rcard__name">{t(`cards.${c.id}.name`)}</h3>
              <p className="body rcard__desc">{t(`cards.${c.id}.desc`)}</p>
              <span className="rcard__tag">{t(`cards.${c.id}.tag`)}</span>
            </article>
          ))}
        </div>
      </div>
      <Invite />
    </section>
  );
}
