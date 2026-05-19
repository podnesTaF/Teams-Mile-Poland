/* global React */
const { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } = React;

/* -------------------- Tokens / data -------------------- */

const AGE_CATEGORIES = [
  { code: "U12", name: "Youth", age: "Born 2014–2015" },
  { code: "U14", name: "Youth", age: "Born 2012–2013" },
  { code: "U16", name: "Cadets", age: "Born 2010–2011" },
  { code: "U18", name: "Juniors", age: "Born 2008–2009" },
  { code: "U20", name: "Juniors", age: "Born 2006–2007" },
  { code: "U23", name: "Espoirs", age: "Born 2003–2005" },
  { code: "SEN", name: "Seniors", age: "23 – 39" },
  { code: "M40", name: "Masters", age: "40 – 54" },
  { code: "V55", name: "Veterans", age: "55+" },
];

const SCHEDULE = [
  { time: "09:00–10:00", name: "Registration & chip pickup", meta: "All athletes", key: false },
  { time: "10:00–10:15", name: "Opening ceremony", meta: "Centre track", key: false },
  { time: "10:30–12:00", name: "Individual rating mile runs", meta: "By age category", key: true },
  { time: "12:00–13:00", name: "Team prep break", meta: "Warm-up", key: false },
  { time: "13:00–14:00", name: "Team mile races", meta: "Headline event", key: true },
  { time: "14:30–15:00", name: "Awards ceremony", meta: "Podium", key: false },
  { time: "15:00–15:30", name: "Closing", meta: "—", key: false },
];

const FAQS = [
  {
    q: "What is TEAMS MILE in one sentence?",
    a: "It's a team mile race with tactical role-switching on a 400 m track — three Racers run the full mile, while two Ace/Joker pairs split a mile each via a baton hand-off inside a marked Joker Zone.",
  },
  {
    q: "What does the 50 PLN cover?",
    a: "Per-runner participation: timing chip, race bib, finisher medal, hydration, post-race recovery zone, and official ranking entry on the ACE BATTLE rating ladder. There are no team fees, captain fees or setup costs.",
  },
  {
    q: "How does the free tier work?",
    a: "The first 300 registered runners across all four flows pay nothing. It's first-come, first-served and atomic — the moment you complete registration, your slot is locked. After 300, every runner pays 50 PLN.",
  },
  {
    q: "I don't have a team. Can I still race?",
    a: "Yes — pick \"Find me a team\" and you'll be added to the pool. We match free agents into teams with open slots and email you for consent before adding you. Or sign up for the individual rating mile and run solo.",
  },
  {
    q: "Do I need a medical certificate?",
    a: "Not mandatory, but strongly recommended. You'll complete a short medical self-declaration during registration confirming no contraindications to running.",
  },
  {
    q: "What gear is or isn't allowed?",
    a: "Standard running shoes — no metal spikes on the track surface. No headphones during competitive runs. Bring your own training kit; bibs and chips are provided.",
  },
  {
    q: "When does registration close?",
    a: "Seven days before the event (20 June 2026) per Warsaw event regulations, or the moment all slots are filled — whichever comes first.",
  },
];

const Roles = [
  { rank: "10", suit: "♠", name: "Racer", line: "Runs the full mile, start to finish.", detail: "3 per team" },
  { rank: "J", suit: "♥", name: "Ace", line: "Starts with everyone, hands off the baton inside the Joker Zone, then stays put.", detail: "Pairs with a Joker" },
  { rank: "Q", suit: "♦", name: "Joker", line: "Waits in the Joker Zone, takes the baton, runs to the finish line.", detail: "Pairs with an Ace" },
];

/* -------------------- Helpers -------------------- */

const cn = (...xs) => xs.filter(Boolean).join(" ");

const useUrgency = (remaining, total) => {
  if (remaining <= 0) return "gone";
  const pct = (remaining / total) * 100;
  if (pct <= 20) return "red";
  if (pct <= 50) return "amber";
  return "ok";
};

const formatN = (n) => n.toLocaleString("en-US");

/* -------------------- Logo / Wordmark -------------------- */

function Wordmark({ light = false, size = 18 }) {
  return (
    <span className={cn("wordmark", light && "wordmark-light")} style={{ fontSize: size }}>
      <span>TEAMS</span>
      <span className="slash" aria-hidden />
      <span>MILE</span>
    </span>
  );
}

/* -------------------- Header -------------------- */

function Header({ remaining, total, onNav, route }) {
  const urgency = useUrgency(remaining, total);
  const goLanding = () => onNav({ name: "landing" });
  return (
    <header className="hdr">
      <div className="container hdr-row">
        <a className="hdr-brand" href="#" onClick={(e) => { e.preventDefault(); goLanding(); }}>
          <Wordmark size={20} />
          <span className="sub">Warsaw<br/>27 Jun 2026</span>
        </a>
        <nav className="hdr-nav">
          <a href="#sport" onClick={() => goLanding()}>The Sport</a>
          <a href="#schedule" onClick={() => goLanding()}>Schedule</a>
          <a href="#venue" onClick={() => goLanding()}>Venue</a>
          <a href="#documents" onClick={() => goLanding()}>Documents</a>
          <a href="#faq" onClick={() => goLanding()}>FAQ</a>
          <a href="#rules" onClick={() => goLanding()}>Rules</a>
        </nav>
        <div className="hdr-actions">
          <div className="hdr-counter" data-urgency={urgency}>
            <span className="dot" />
            <span>
              {urgency === "gone"
                ? `Free tier sold out · 50 PLN/runner`
                : `${formatN(remaining)}/${formatN(total)} free slots`}
            </span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => onNav({ name: "register-pick" })}>
            Register
          </button>
        </div>
      </div>
    </header>
  );
}

/* -------------------- Scarcity components -------------------- */

function ScarcityPanel({ remaining, total, teamsFormed }) {
  const urgency = useUrgency(remaining, total);
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const banner = {
    ok: { tag: "Free tier open", line: "First-come, first-served. No payment required." },
    amber: { tag: "Filling up", line: "Half the free slots are gone — secure yours." },
    red: { tag: "Almost gone", line: "Less than 20% of free slots left." },
    gone: { tag: "Free tier closed", line: "All flows continue at 50 PLN per runner." },
  }[urgency];
  return (
    <div className="scarcity" data-urgency={urgency}>
      <div className="scarcity-head">
        <div>
          <div className="eyebrow eyebrow-ink" style={{ marginBottom: 6 }}>
            <span className="suit suit-spade" style={{ marginRight: 6 }} />Free slots
          </div>
          <div className="scarcity-num">
            <span className="num">{formatN(remaining)}</span>
            <span className="of">/ {formatN(total)}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Teams forming</div>
          <div className="scarcity-num" style={{ fontSize: "clamp(20px, 2.6vw, 28px)" }}>
            <span className="num">{teamsFormed}</span>
          </div>
        </div>
      </div>
      <div className="scarcity-bar" aria-hidden>
        <div className="scarcity-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="scarcity-foot">
        <span>0</span>
        <span>{banner.tag}</span>
        <span>{formatN(total)}</span>
      </div>
      <div className="scarcity-banner">
        <strong style={{ fontFamily: "var(--f-display)", fontWeight: 700, marginRight: 6 }}>
          {banner.tag}.
        </strong>
        <span>{banner.line}</span>
      </div>
    </div>
  );
}

/* -------------------- Track diagram (inline SVG) -------------------- */

function TrackDiagram({ withJokerZone = false, dark = false, withRunners = false }) {
  const stroke = dark ? "rgba(255,255,255,0.4)" : "rgba(10,10,10,0.4)";
  const ink = dark ? "#f3f0e8" : "#0a0a0a";
  const muted = dark ? "rgba(255,255,255,0.55)" : "#6b6b6b";
  return (
    <svg className="track-svg" viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* outer track */}
      <rect x="6" y="6" width="348" height="128" rx="64" fill="none" stroke={stroke} strokeWidth="1.5" />
      <rect x="22" y="22" width="316" height="96" rx="48" fill="none" stroke={stroke} strokeWidth="1.5" />
      <rect x="38" y="38" width="284" height="64" rx="32" fill="none" stroke={stroke} strokeDasharray="2 4" strokeWidth="1" />
      {/* start/finish */}
      <line x1="180" y1="6" x2="180" y2="40" stroke={ink} strokeWidth="2" />
      <text x="186" y="20" fill={muted} fontFamily="JetBrains Mono, monospace" fontSize="8" letterSpacing="0.05em">START · FINISH</text>

      {withJokerZone && (
        <g>
          {/* Joker Zone — back straight */}
          <rect x="100" y="100" width="60" height="34" fill="#E11D2A" fillOpacity="0.15" stroke="#E11D2A" strokeWidth="1.5" />
          <text x="130" y="124" textAnchor="middle" fill="#E11D2A" fontFamily="Manrope, sans-serif" fontWeight="700" fontSize="9" letterSpacing="0.04em">JOKER ZONE</text>
          <text x="130" y="146" textAnchor="middle" fill={muted} fontFamily="JetBrains Mono, monospace" fontSize="7" letterSpacing="0.05em">20 m</text>
        </g>
      )}

      {withRunners && (
        <g>
          {/* runner dots */}
          <circle cx="180" cy="6" r="3.5" fill="#0a0a0a" />
          <circle cx="190" cy="7" r="3.5" fill="#0a0a0a" />
          <circle cx="170" cy="7" r="3.5" fill="#E11D2A" />
          <circle cx="200" cy="9" r="3.5" fill="#0a0a0a" />
        </g>
      )}

      {/* lap label */}
      <text x="180" y="78" textAnchor="middle" fill={muted} fontFamily="JetBrains Mono, monospace" fontSize="9" letterSpacing="0.1em">400 m · 1 LAP</text>
    </svg>
  );
}

/* -------------------- Footer -------------------- */

function Footer({ onNav }) {
  return (
    <footer className="foot">
      <div className="container">
        <div className="foot-grid">
          <div>
            <div style={{ marginBottom: 18 }}>
              <Wordmark light size={22} />
            </div>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, maxWidth: "44ch", lineHeight: 1.6, margin: "0 0 22px" }}>
              The Polish launch event of ACE BATTLE MILE — a team mile race with tactical role-switching, on a 400 m outdoor track.
            </p>
            <div className="row gap-md" style={{ flexWrap: "wrap" }}>
              <span className="chip chip-red">27 JUN 2026</span>
              <span className="chip" style={{ background: "rgba(255,255,255,0.08)", color: "#fff", borderColor: "rgba(255,255,255,0.15)" }}>Warsaw · PL</span>
            </div>
          </div>
          <div>
            <h5>Event</h5>
            <ul>
              <li><a href="#sport">The sport</a></li>
              <li><a href="#schedule">Schedule</a></li>
              <li><a href="#venue">Venue</a></li>
              <li><a href="#documents">Documents</a></li>
            </ul>
          </div>
          <div>
            <h5>Register</h5>
            <ul>
              <li><a onClick={() => onNav({ name: "flow", flow: "start" })} style={{ cursor: "pointer" }}>Start a team</a></li>
              <li><a onClick={() => onNav({ name: "flow", flow: "join" })} style={{ cursor: "pointer" }}>Join a team</a></li>
              <li><a onClick={() => onNav({ name: "flow", flow: "free" })} style={{ cursor: "pointer" }}>Find me a team</a></li>
              <li><a onClick={() => onNav({ name: "flow", flow: "solo" })} style={{ cursor: "pointer" }}>Run solo</a></li>
            </ul>
          </div>
          <div>
            <h5>Legal</h5>
            <ul>
              <li><a href="#">Rules &amp; regulations</a></li>
              <li><a href="#">Refund policy</a></li>
              <li><a href="#">Privacy</a></li>
              <li><a href="#">Terms</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="foot-wordmark">TEAMS·MILE</div>
        <div className="foot-bottom">
          <div>© 2026 ACE BATTLE POLAND Ltd · Licensed event under ACE BATTLE ASSOCIATION · Luxembourg</div>
          <div>v1.0 · Warsaw edition</div>
        </div>
      </div>
    </footer>
  );
}

/* -------------------- Form primitives -------------------- */

function Field({ label, hint, error, children, required }) {
  return (
    <div className="field">
      <label className="field-label">
        {label} {required && <span style={{ color: "var(--accent)" }}>*</span>}
      </label>
      {children}
      {error ? <span className="field-err">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

function Input(props) { return <input className={cn("input", props.error && "has-err")} {...props} />; }
function Select({ children, ...props }) { return <select className="select" {...props}>{children}</select>; }
function Textarea(props) { return <textarea className="textarea" {...props} />; }

function CheckRow({ id, checked, onChange, children }) {
  return (
    <div className="checkbox-row">
      <input id={id} type="checkbox" checked={checked} onChange={onChange} />
      <label htmlFor={id}>{children}</label>
    </div>
  );
}

/* -------------------- Stepper -------------------- */

function Stepper({ steps, current }) {
  return (
    <div className="stepper">
      {steps.map((s, i) => {
        const status = i < current ? "is-done" : i === current ? "is-active" : "";
        return (
          <div key={i} className={cn("stepper-step", status)}>
            <span className="stepper-num">{i + 1}</span>
            <span>{s}</span>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------- Pricing line -------------------- */

function PricingLine({ free, runners = 1 }) {
  if (free) {
    return (
      <div className="pricing-line is-free">
        <span><strong>Free tier</strong> · You'll claim {runners > 1 ? `${runners} of 300` : "1 of 300"} free runner slots</span>
        <strong>0 PLN</strong>
      </div>
    );
  }
  return (
    <div className="pricing-line is-paid">
      <span><strong>Paid registration</strong> · Free tier is sold out</span>
      <strong>{50 * runners} PLN</strong>
    </div>
  );
}

/* -------------------- Roster grid (12 slots) -------------------- */

function Roster({ filled = 4, you = false, names = [] }) {
  const slots = Array.from({ length: 12 }, (_, i) => i);
  return (
    <div className="roster">
      {slots.map((i) => {
        const isFilled = i < filled;
        const isYou = you && i === filled; // "you" slot is next one
        return (
          <div key={i} className={cn("roster-slot", isFilled && "is-filled", isYou && "is-you")}>
            {isYou ? "YOU" : isFilled && names[i] ? names[i] : isFilled ? `R${i + 1}` : i + 1}
          </div>
        );
      })}
    </div>
  );
}

/* expose globals */
Object.assign(window, {
  AGE_CATEGORIES, SCHEDULE, FAQS, Roles, cn, useUrgency, formatN,
  Header, Footer, ScarcityPanel, TrackDiagram,
  Field, Input, Select, Textarea, CheckRow, Stepper, PricingLine, Roster,
  Wordmark,
});
