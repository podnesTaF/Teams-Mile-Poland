/* global React, ScarcityPanel, TrackDiagram, AGE_CATEGORIES, SCHEDULE, FAQS, Roles, useUrgency, formatN */
const { useState: useStateL, useEffect: useEffectL } = React;

/* -------------------- HERO VARIANTS -------------------- */

function HeroEditorial({ remaining, total, teamsFormed, onRegister }) {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-editorial-grid">
          <div>
            <div className="hero-meta">
              <span className="chip chip-mono">27 · 06 · 2026</span>
              <span className="chip chip-mono">Stadion Podskarbińska · Warsaw</span>
              <span className="chip chip-red">Polish launch</span>
            </div>
            <h1>
              Make running<br />
              <span style={{ color: "var(--accent)" }}>a game.</span>
            </h1>
            <p className="hero-sub" style={{ marginTop: 28 }}>
              The Polish launch of <strong style={{ color: "var(--ink)" }}>ACE BATTLE MILE</strong> — a one-mile team race with tactical role-switching. Three Racers, two Ace–Joker pairs, one baton, one Joker Zone. Four minutes of pure tactics.
            </p>
            <div className="hero-ctas">
              <button className="btn btn-primary btn-lg" onClick={onRegister}>
                Claim a free slot <span aria-hidden>→</span>
              </button>
              <a href="#sport" className="btn btn-ghost btn-lg">How it works</a>
            </div>
            <div className="hero-stats">
              <div>
                <div className="hero-stat-k">Distance</div>
                <div className="hero-stat-v">1 mile · 1,609 m</div>
              </div>
              <div>
                <div className="hero-stat-k">Team size</div>
                <div className="hero-stat-v">7 – 12 runners</div>
              </div>
              <div>
                <div className="hero-stat-k">Track</div>
                <div className="hero-stat-v">400 m outdoor</div>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image">
              <image-slot id="hero-runners" placeholder="Drop a photo: pack of runners coming off the bend, low angle, dramatic light" radius="0" />
            </div>
            <div style={{ marginTop: 16 }}>
              <ScarcityPanel remaining={remaining} total={total} teamsFormed={teamsFormed} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStadium({ remaining, total, teamsFormed, onRegister }) {
  const urgency = useUrgency(remaining, total);
  return (
    <section className="hero" style={{ background: "var(--accent)", color: "#fff", paddingTop: 56, paddingBottom: 48 }}>
      <div className="container">
        <div className="hero-meta">
          <span className="chip" style={{ background: "rgba(0,0,0,0.18)", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>27 · 06 · 2026</span>
          <span className="chip" style={{ background: "rgba(0,0,0,0.18)", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>Stadion Podskarbińska</span>
          <span className="chip chip-dark">Polish launch</span>
        </div>
        <div className="shout shout-xl" style={{ color: "#fff", marginBottom: 24 }}>
          Make<br />running<br />a game.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 32, alignItems: "end", marginTop: 36 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 28, alignItems: "end" }} className="hero-stadium-row">
            <div style={{ maxWidth: 620 }}>
              <p style={{ fontSize: 18, color: "rgba(255,255,255,0.85)", lineHeight: 1.55, margin: "0 0 28px", maxWidth: "52ch" }}>
                The Polish launch of <strong>ACE BATTLE MILE</strong>. A team mile race with tactical role-switching — three Racers, two Ace–Joker pairs, one baton, one Joker Zone. On a 400 m outdoor track.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn btn-dark btn-lg" onClick={onRegister}>Register your crew →</button>
                <a href="#sport" className="btn btn-ghost-light btn-lg">How it works</a>
              </div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.18)", padding: 4 }}>
              <ScarcityPanel remaining={remaining} total={total} teamsFormed={teamsFormed} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroTactical({ remaining, total, teamsFormed, onRegister }) {
  return (
    <section className="hero">
      <div className="container">
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 36 }}>
          <div>
            <div className="hero-meta">
              <span className="chip chip-mono">Polish launch · ACE BATTLE MILE</span>
              <span className="chip chip-mono">27 Jun 2026 · Warsaw</span>
            </div>
            <h1 style={{ fontSize: "clamp(2.4rem, 8vw, 7rem)", lineHeight: 0.88 }}>
              Seven athletes.<br />
              One mile.<br />
              <span style={{ color: "var(--accent)" }}>One baton.</span>
            </h1>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
            <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--ink)" }}>
              <div style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--ink)", flexWrap: "wrap", gap: 12, background: "var(--ink)", color: "#fff" }}>
                <span className="eyebrow" style={{ color: "rgba(255,255,255,0.65)" }}>Race configuration</span>
                <div className="row gap-md">
                  <span className="chip" style={{ background: "rgba(255,255,255,0.08)", color: "#fff", borderColor: "rgba(255,255,255,0.18)" }}>3 Racers</span>
                  <span className="chip" style={{ background: "rgba(255,255,255,0.08)", color: "#fff", borderColor: "rgba(255,255,255,0.18)" }}>2 Aces</span>
                  <span className="chip" style={{ background: "rgba(255,255,255,0.08)", color: "#fff", borderColor: "rgba(255,255,255,0.18)" }}>2 Jokers</span>
                </div>
              </div>
              <div style={{ padding: 32, background: "var(--bg-2)" }}>
                <div style={{ aspectRatio: "360/140", maxWidth: 720, margin: "0 auto" }}>
                  <TrackDiagram withJokerZone withRunners />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid var(--ink)" }}>
                <div style={{ padding: 20, borderRight: "1px solid var(--line)" }}>
                  <div className="eyebrow">Distance</div>
                  <div style={{ fontFamily: "var(--f-display)", fontStyle: "italic", fontWeight: 900, fontSize: 28, textTransform: "uppercase", marginTop: 6 }}>1 mile</div>
                  <div className="text-mono text-xs text-muted">1,609 m</div>
                </div>
                <div style={{ padding: 20, borderRight: "1px solid var(--line)" }}>
                  <div className="eyebrow">Race time</div>
                  <div style={{ fontFamily: "var(--f-display)", fontStyle: "italic", fontWeight: 900, fontSize: 28, textTransform: "uppercase", marginTop: 6 }}>13:00–14:00</div>
                  <div className="text-mono text-xs text-muted">27 Jun 2026</div>
                </div>
                <div style={{ padding: 20 }}>
                  <div className="eyebrow">Venue</div>
                  <div style={{ fontFamily: "var(--f-display)", fontStyle: "italic", fontWeight: 900, fontSize: 28, textTransform: "uppercase", marginTop: 6 }}>Podskarb.</div>
                  <div className="text-mono text-xs text-muted">Warsaw, PL</div>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              <ScarcityPanel remaining={remaining} total={total} teamsFormed={teamsFormed} />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-lg" onClick={onRegister}>Start registering →</button>
                <a href="#sport" className="btn btn-ghost btn-lg">Read the rules</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------- PICKER VARIANTS -------------------- */

function PickerGrid({ onPick }) {
  const cards = [
    { id: "start", num: "01", rank: "A", title: "Start a team", desc: "Be the captain. Pick your category. Share your code.", meta: "7–12 runners", primary: true },
    { id: "join", num: "02", rank: "K", title: "Join a team", desc: "You've got a captain's code or an invite link.", meta: "30-second flow" },
    { id: "free", num: "03", rank: "Q", title: "Find me a team", desc: "Race with people we match you to.", meta: "Free agent" },
    { id: "solo", num: "04", rank: "J", title: "Run solo", desc: "Individual rating mile. Get on the ladder.", meta: "Individual" },
  ];
  return (
    <div className="picker-grid">
      {cards.map((c) => (
        <button key={c.id} className={cn("picker-card", c.primary && "is-primary")} onClick={() => onPick(c.id)}>
          <div className="picker-rank-row">
            <span className={cn("rank", c.primary ? "rank-outline" : "rank-red")} style={{ color: c.primary ? "#fff" : "#fff", borderColor: c.primary ? "rgba(255,255,255,0.5)" : "transparent" }}>{c.rank}</span>
            <span className="picker-num">{c.num}</span>
          </div>
          <div>
            <div className="picker-title">{c.title}</div>
            <p className="picker-desc">{c.desc}</p>
          </div>
          <div className="picker-meta">
            <span>{c.meta}</span>
            <span className="picker-arrow" aria-hidden>→</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function PickerTwoTier({ onPick }) {
  return (
    <div className="picker-tier-grid">
      <div className="picker-tier">
        <div className="picker-tier-head">
          <div>
            <span className="eyebrow">Primary · the main product</span>
            <h3 style={{ marginTop: 8 }}>Race with a team</h3>
          </div>
          <span className="chip chip-red">Recommended</span>
        </div>
        <div className="picker-tier-cards">
          <button className="picker-sub" onClick={() => onPick("start")}>
            <span className="rank rank-red" style={{ width: 26, height: 32, fontSize: 14 }}>A</span>
            <span className="picker-sub-title">Start a team</span>
            <span className="picker-sub-desc">Be the captain. Invite your crew. Choose a category.</span>
          </button>
          <button className="picker-sub" onClick={() => onPick("join")}>
            <span className="rank" style={{ width: 26, height: 32, fontSize: 14 }}>K</span>
            <span className="picker-sub-title">Join a team</span>
            <span className="picker-sub-desc">You have a captain's code or invite link.</span>
          </button>
        </div>
      </div>
      <div className="picker-tier" style={{ background: "var(--bg-2)" }}>
        <div className="picker-tier-head">
          <div>
            <span className="eyebrow">Also valid</span>
            <h3 style={{ marginTop: 8 }}>Race on your own</h3>
          </div>
        </div>
        <div className="picker-tier-cards">
          <button className="picker-sub" onClick={() => onPick("free")}>
            <span className="rank rank-red" style={{ width: 26, height: 32, fontSize: 14 }}>Q</span>
            <span className="picker-sub-title">Find me a team</span>
            <span className="picker-sub-desc">We'll match you. No commitment yet.</span>
          </button>
          <button className="picker-sub" onClick={() => onPick("solo")}>
            <span className="rank" style={{ width: 26, height: 32, fontSize: 14 }}>J</span>
            <span className="picker-sub-title">Run solo</span>
            <span className="picker-sub-desc">Individual rating mile. Just your time.</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PickerTabs({ onPick }) {
  const [tab, setTab] = useStateL("start");
  const tabs = {
    start: {
      label: "Start a team",
      suit: "♠",
      title: "You captain a team",
      desc: "Pick your category, name your team, and you'll get a shareable code your runners can use to join. Captains run the show — but you race too.",
      bullets: [
        ["You need", "7 – 12 runners total"],
        ["You pick", "Men's · Women's · Mixed"],
        ["You get", "Team code, dashboard, magic link"],
      ],
    },
    join: {
      label: "Join a team",
      suit: "♥",
      title: "Your captain sent a link",
      desc: "You'll see who you're joining, fill in your runner info, and you're in. Two minutes if you've got your stuff in front of you.",
      bullets: [
        ["You need", "A team code or invite link"],
        ["You'll see", "Team preview before submitting"],
        ["You get", "Roster slot + member dashboard"],
      ],
    },
    free: {
      label: "Find me a team",
      suit: "♦",
      title: "Race, but we'll match you",
      desc: "Tell us your preferences, we'll match you with a team that has open slots and email you for consent before locking it in.",
      bullets: [
        ["You need", "Just your runner info"],
        ["You pick", "Region preference, teammates (optional)"],
        ["You get", "Pending dashboard until matched"],
      ],
    },
    solo: {
      label: "Run solo",
      suit: "♣",
      title: "Individual rating mile",
      desc: "Just you, the mile, the clock. Run in the morning block, get an official time on the ABR ranking ladder.",
      bullets: [
        ["You need", "Just your runner info"],
        ["You race", "10:30 – 12:00 · by age category"],
        ["You get", "Official ranking time"],
      ],
    },
  };
  const t = tabs[tab];
  return (
    <div>
      <div className="picker-tabs">
        {Object.entries(tabs).map(([k, v]) => (
          <button key={k} className={cn("picker-tab", tab === k && "is-active")} onClick={() => setTab(k)}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="picker-tab-panel">
        <div className="picker-tab-panel-grid">
          <div className="picker-tab-info">
            <span className="eyebrow">Flow 0{Object.keys(tabs).indexOf(tab) + 1}</span>
            <h3 style={{ marginTop: 6 }}>{t.title}</h3>
            <p>{t.desc}</p>
            <ul className="picker-tab-bullets">
              {t.bullets.map(([k, v]) => (
                <li key={k}><span className="k">{k}</span><span>{v}</span></li>
              ))}
            </ul>
            <button className="btn btn-primary btn-lg" onClick={() => onPick(tab)}>
              Start this flow →
            </button>
          </div>
          <div style={{ aspectRatio: "1", maxHeight: 360, background: "var(--bg-2)", borderRadius: 12, padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrackDiagram withJokerZone withRunners={tab === "start" || tab === "join"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PickerGuided({ onPick }) {
  const [step, setStep] = useStateL(0);
  const q0 = [
    { id: "with-team", label: "I want to race with a team", desc: "Either captain or join one" },
    { id: "solo", label: "I want to race on my own", desc: "Free agent or solo mile" },
  ];
  const q1Team = [
    { id: "start", label: "Start a team — I'll captain", desc: "Pick category, invite runners" },
    { id: "join", label: "Join an existing team", desc: "I have a code or link" },
  ];
  const q1Solo = [
    { id: "free", label: "Match me with a team", desc: "I want to race in a team but don't have one yet" },
    { id: "solo", label: "Individual rating mile", desc: "Just my time on the ladder" },
  ];
  const [path, setPath] = useStateL(null);
  return (
    <div className="picker-guided">
      <div className="row-between" style={{ marginBottom: 18 }}>
        <span className="eyebrow" style={{ color: "rgba(255,255,255,0.6)" }}>Step {step + 1} of 2</span>
        {step > 0 && (
          <button onClick={() => setStep(0)} style={{ background: "transparent", border: 0, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13 }}>
            ← back
          </button>
        )}
      </div>
      {step === 0 ? (
        <>
          <h3>How do you want to take part?</h3>
          <div className="picker-guided-opts">
            {q0.map((o) => (
              <button key={o.id} className="picker-guided-opt" onClick={() => { setPath(o.id); setStep(1); }}>
                <strong>{o.label}</strong>
                <span>{o.desc}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <h3>{path === "with-team" ? "Team flow:" : "Solo flow:"}</h3>
          <div className="picker-guided-opts">
            {(path === "with-team" ? q1Team : q1Solo).map((o) => (
              <button key={o.id} className="picker-guided-opt" onClick={() => onPick(o.id)}>
                <strong>{o.label}</strong>
                <span>{o.desc}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Picker({ variant, onPick }) {
  if (variant === "two-tier") return <PickerTwoTier onPick={onPick} />;
  if (variant === "tabs") return <PickerTabs onPick={onPick} />;
  if (variant === "guided") return <PickerGuided onPick={onPick} />;
  return <PickerGrid onPick={onPick} />;
}

/* -------------------- Side-by-side explainer -------------------- */

function YouTubeEmbed({ videoId, title }) {
  const isPlaceholder = !videoId || videoId === "PLACEHOLDER";
  return (
    <div className="yt-embed">
      {isPlaceholder ? (
        <div className="yt-embed-poster">
          <span className="yt-embed-play" aria-hidden>▶</span>
          <span className="yt-embed-label">YouTube video</span>
          <span className="yt-embed-hint">Drop a video ID in Tweaks</span>
        </div>
      ) : (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
          title={title || "Video"}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  );
}

function NormalVsTeams({ normalVideoId, teamsVideoId }) {
  return (
    <div className="cmp">
      <div className="cmp-card is-normal">
        <span className="cmp-tag">Normal mile</span>
        <h3>One runner.<br />One mile.</h3>
        <YouTubeEmbed videoId={normalVideoId} title="Normal mile reference" />
        <ul className="cmp-list">
          <li><span className="k">Runners</span><span>1 individual on the line</span></li>
          <li><span className="k">Distance</span><span>1 mile · 4 laps · run all of it yourself</span></li>
          <li><span className="k">Tactics</span><span>Pace your own race</span></li>
          <li><span className="k">Result</span><span>Your finish time</span></li>
        </ul>
      </div>
      <div className="cmp-card is-this">
        <span className="cmp-tag">TEAMS MILE</span>
        <h3>Seven athletes.<br />One mile each.</h3>
        <YouTubeEmbed videoId={teamsVideoId} title="TEAMS MILE explainer" />
        <ul className="cmp-list">
          <li><span className="k">Runners</span><span>3 Racers + 2 Ace–Joker pairs · everyone on the track at once</span></li>
          <li><span className="k">Distance</span><span>Racers run a full mile · Ace + Joker split a mile via baton</span></li>
          <li><span className="k">Tactics</span><span>The Joker Zone hand-off is the whole game</span></li>
          <li><span className="k">Result</span><span>Team time + LEVEL &amp; DIVISION rankings</span></li>
        </ul>
      </div>
    </div>
  );
}

/* -------------------- Roles strip -------------------- */

function RoleCards() {
  return (
    <div className="roles-grid">
      {Roles.map((r) => (
        <div key={r.name} className="role-card">
          <div className="role-rank-row">
            <span className={cn("rank", r.name === "Racer" ? "" : "rank-red")}>{r.rank}</span>
            <span className="eyebrow">{r.detail}</span>
          </div>
          <h4>{r.name}</h4>
          <p>{r.line}</p>
        </div>
      ))}
    </div>
  );
}

/* -------------------- Schedule -------------------- */

function ScheduleList() {
  return (
    <div className="schedule">
      {SCHEDULE.map((s) => (
        <div key={s.time} className={cn("sched-row", s.key && "is-key")}>
          <span className="sched-time">{s.time}</span>
          <span className="sched-dot" />
          <span className="sched-name">{s.name}</span>
          <span className="sched-meta">{s.meta}</span>
        </div>
      ))}
    </div>
  );
}

/* -------------------- Categories -------------------- */

function Categories() {
  return (
    <div className="cat-grid">
      {AGE_CATEGORIES.map((c) => (
        <div key={c.code} className="cat-cell">
          <div className="cat-code">{c.code}</div>
          <div className="cat-name">{c.name}</div>
          <div className="cat-age">{c.age}</div>
        </div>
      ))}
    </div>
  );
}

/* -------------------- FAQ -------------------- */

function Faq() {
  const [open, setOpen] = useStateL(0);
  return (
    <div className="faq-list">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={cn("faq-item", isOpen && "is-open")}>
            <button className="faq-q" onClick={() => setOpen(isOpen ? -1 : i)}>
              <span>{f.q}</span>
              <span className="faq-icon">+</span>
            </button>
            <div className="faq-a">
              <div className="faq-a-inner">{f.a}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------- Venue -------------------- */

const DOCUMENTS = [
  {
    id: "warsaw-regs",
    tag: "Event regulations",
    title: "TEAMS MILE Warsaw — Event Regulations",
    desc: "The binding regulations for the Polish launch event — entry rules, schedule, equipment, medical, refunds, GDPR. Required reading for captains.",
    href: "docs/teams-mile-warsaw-regulations.pdf",
    meta: "PDF · EN · v1.0",
    primary: true,
  },
  {
    id: "abr-rating",
    tag: "ABA rating system",
    title: "ACE BATTLE Rating System Regulations",
    desc: "The master document defining the sport — roles, ratings, divisions, LEVEL vs DIVISION math, time corrections, ranks, penalties.",
    href: "docs/abr-rating-system-v2.pdf",
    meta: "PDF · EN · v2.0 · 22.02.2025",
  },
  {
    id: "brand",
    tag: "Brand",
    title: "ACE BATTLE MILE — Brandbook",
    desc: "Logo system, colour, typography and identity elements. For partners, press and sponsors.",
    href: "#",
    meta: "PDF · coming soon",
    pending: true,
  },
  {
    id: "raceday",
    tag: "Briefing",
    title: "Race-day Briefing & Logistics",
    desc: "What to bring, where to park, chip pickup, warm-up zones, medical, on-track protocol. Auto-emailed 72 hours before the event.",
    href: "#",
    meta: "PDF · published 20 Jun 2026",
    pending: true,
  },
];

function Documents() {
  return (
    <div className="docs-grid">
      {DOCUMENTS.map((d) => (
        <a key={d.id} href={d.href} target={d.pending ? "_self" : "_blank"} rel="noopener"
           className={cn("doc-card", d.primary && "is-primary", d.pending && "is-pending")}
           onClick={d.pending ? (e) => e.preventDefault() : undefined}>
          <div className="doc-card-top">
            <span className="doc-card-tag">{d.tag}</span>
            <span className="doc-card-icon" aria-hidden>
              <span className="doc-card-icon-label">PDF</span>
            </span>
          </div>
          <div>
            <h4 className="doc-card-title">{d.title}</h4>
            <p className="doc-card-desc">{d.desc}</p>
          </div>
          <div className="doc-card-foot">
            <span className="doc-card-meta">{d.meta}</span>
            <span className="doc-card-action">
              {d.pending ? "Soon" : "Download"} <span aria-hidden>{d.pending ? "" : "↓"}</span>
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}

function Venue() {
  return (
    <div className="venue-grid">
      <div className="venue-image">
        <image-slot id="venue-map" placeholder="Drop a venue photo or a styled map of Stadion Podskarbińska" radius="16" />
      </div>
      <div>
        <span className="eyebrow">The venue</span>
        <h2 style={{ marginTop: 8, marginBottom: 20 }}>Stadion Podskarbińska</h2>
        <p style={{ color: "var(--muted)", fontSize: 17, lineHeight: 1.6, maxWidth: "44ch", margin: "0 0 24px" }}>
          A historic Warsaw athletics stadium in the Praga-Południe district. Full 400 m outdoor track, certified for sanctioned competition.
        </p>
        <div className="card" style={{ background: "var(--bg)", padding: 0 }}>
          <div style={{ padding: 18, borderBottom: "1px solid var(--line)" }}>
            <div className="eyebrow">Address</div>
            <div style={{ fontFamily: "var(--f-display)", fontWeight: 600, marginTop: 4 }}>
              Wojciecha Chrzanowskiego 23<br />
              04-394 Warsaw, Poland
            </div>
          </div>
          <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div className="eyebrow">Track</div>
              <div style={{ fontFamily: "var(--f-display)", fontWeight: 600, marginTop: 4 }}>400 m · 8 lanes</div>
            </div>
            <div>
              <div className="eyebrow">Surface</div>
              <div style={{ fontFamily: "var(--f-display)", fontWeight: 600, marginTop: 4 }}>Tartan</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Landing -------------------- */

function Landing({ remaining, total, teamsFormed, heroVariant, pickerVariant, normalVideoId, teamsVideoId, onNav }) {
  const goFlow = (id) => onNav({ name: "flow", flow: id });
  const HeroComp = heroVariant === "stadium" ? HeroStadium : heroVariant === "tactical" ? HeroTactical : HeroEditorial;
  return (
    <>
      <HeroComp
        remaining={remaining}
        total={total}
        teamsFormed={teamsFormed}
        onRegister={() => onNav({ name: "register-pick" })}
      />

      {/* Picker */}
      <section id="register" className="section section-bg">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Pick your path</span>
            <h2 className="shout shout-md" style={{ marginTop: 14 }}>Four ways in.<br/>One race day.</h2>
            <p>Every runner pays 50 PLN — unless you grab one of the first 300 free slots. All four flows share the free tier and run on the same atomic counter.</p>
          </div>
          <Picker variant={pickerVariant} onPick={goFlow} />
        </div>
      </section>

      {/* Side-by-side explainer */}
      <section id="sport" className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">The sport · in 60 seconds</span>
            <h2 className="shout shout-md" style={{ marginTop: 14 }}>It's a mile.<br/>But not the mile you know.</h2>
            <p>Most race sites would bury this. We're putting it up front: TEAMS MILE looks like a mile, but the tactics are completely different.</p>
          </div>
          <NormalVsTeams normalVideoId={normalVideoId} teamsVideoId={teamsVideoId} />
          <div style={{ marginTop: 64 }}>
            <div className="row-between" style={{ marginBottom: 12 }}>
              <span className="eyebrow">Three roles · one team</span>
              <a href="#" className="btn-link" style={{ fontSize: 13 }}>Full rules &amp; ratings →</a>
            </div>
            <RoleCards />
          </div>
        </div>
      </section>

      {/* Schedule */}
      <section id="schedule" className="section section-bg">
        <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 40 }}>
          <div className="section-head" style={{ marginBottom: 0 }}>
            <span className="eyebrow">Race day · 27 June 2026</span>
            <h2 className="shout shout-md" style={{ marginTop: 14 }}>One day.<br/>Two race blocks.</h2>
            <p>Individual rating mile in the morning. Team mile races after lunch. Show up at 09:00 for chip pickup; don't be late — once the block starts, the gate closes.</p>
          </div>
          <div className="card" style={{ padding: 36, background: "var(--bg)", border: "1px solid var(--ink)" }}>
            <ScheduleList />
          </div>
        </div>
      </section>

      {/* Venue */}
      <section id="venue" className="section section-bg">
        <div className="container">
          <Venue />
        </div>
      </section>

      {/* Documents */}
      <section id="documents" className="section">
        <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 40 }}>
          <div className="section-head" style={{ marginBottom: 0 }}>
            <span className="eyebrow">Official documents</span>
            <h2 className="shout shout-md" style={{ marginTop: 14 }}>Read before<br/>you toe the line.</h2>
            <p>Everything official — the Warsaw event regulations, the master ABA rating system, brand and race-day briefing. PDFs in English; Polish translations follow registration close.</p>
          </div>
          <Documents />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section">
        <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 40 }}>
          <div className="section-head" style={{ marginBottom: 0 }}>
            <span className="eyebrow">FAQ</span>
            <h2 className="shout shout-md" style={{ marginTop: 14 }}>Most of what<br/>runners ask.</h2>
            <p>Can't find what you need? Reach out at <a href="#" style={{ borderBottom: "1px solid currentColor" }}>warsaw@acebattle.run</a> — we usually reply same day.</p>
          </div>
          <div className="card" style={{ padding: "8px 32px", background: "var(--bg)", border: "1px solid var(--ink)" }}>
            <Faq />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section section-red" style={{ paddingTop: 96, paddingBottom: 96 }}>
        <div className="container" style={{ textAlign: "center" }}>
          <span className="eyebrow" style={{ color: "rgba(255,255,255,0.7)" }}>Ready when you are</span>
          <div className="shout shout-lg" style={{ marginTop: 18, marginBottom: 32, color: "#fff" }}>
            27 June 2026.<br/>
            Stadion Podskarbińska.<br/>
            <span style={{ color: "var(--ink)" }}>Be on the line.</span>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn btn-dark btn-lg" onClick={() => onNav({ name: "register-pick" })}>
              Start your registration →
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

/* expose */
Object.assign(window, {
  Landing, HeroEditorial, HeroStadium, HeroTactical, Picker,
  Documents, YouTubeEmbed,
});
