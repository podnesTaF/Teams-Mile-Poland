/* global React, Stepper, Field, Input, Select, Textarea, CheckRow, PricingLine, Roster, TrackDiagram, cn, useUrgency, formatN */
const { useState: useStateF, useMemo: useMemoF, useEffect: useEffectF } = React;

const REGIONS = ["Mazowieckie (Warsaw)", "Małopolskie (Kraków)", "Pomorskie (Gdańsk)", "Wielkopolskie (Poznań)", "Dolnośląskie (Wrocław)", "Other / national"];

const SAMPLE_TEAM = {
  name: "Warsaw Wolves",
  code: "WAW-WOLVES-7K2P",
  captain: "Anna Kowalska",
  category: "Mixed",
  region: "Mazowieckie (Warsaw)",
  filled: 4,
  cap: 12,
  roster: ["AK", "PJ", "MR", "TN"],
};

/* -------------------- Flow shell -------------------- */

function FlowShell({ title, step, steps, onBack, onNav, body, side, footer }) {
  return (
    <div className="flow">
      <div className="flow-grid">
        <div>
          <button className="flow-back" onClick={onBack}>← back to all paths</button>
          <div className="flow-form-card">
            <div className="flow-form-card-head">
              <div>
                <span className="eyebrow">Registration</span>
                <h2 style={{ marginTop: 4 }}>{title}</h2>
              </div>
              <span className="flow-step-meta">Step {Math.min(step + 1, steps.length)} of {steps.length}</span>
            </div>
            <Stepper steps={steps} current={step} />
            <div className="flow-form-body">{body}</div>
            {footer && <div className="flow-form-foot">{footer}</div>}
          </div>
        </div>
        <aside className="flow-side">{side}</aside>
      </div>
    </div>
  );
}

/* -------------------- Reusable runner-info section -------------------- */

function RunnerInfo({ data, set, includeRole = false }) {
  return (
    <div className="form-section">
      <div className="form-section-head">
        <h3>Your details</h3>
        <p>Used to verify entry, contact you about race day, and place you in the right age category.</p>
      </div>
      <div className="form-grid-2">
        <Field label="First name" required>
          <Input value={data.first} onChange={(e) => set({ first: e.target.value })} placeholder="Anna" />
        </Field>
        <Field label="Last name" required>
          <Input value={data.last} onChange={(e) => set({ last: e.target.value })} placeholder="Kowalska" />
        </Field>
      </div>
      <div className="form-grid-2">
        <Field label="Email" required hint="We'll send a magic link to your dashboard">
          <Input type="email" value={data.email} onChange={(e) => set({ email: e.target.value })} placeholder="anna@example.com" />
        </Field>
        <Field label="Phone" required>
          <Input type="tel" value={data.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+48 600 000 000" />
        </Field>
      </div>
      <div className="form-grid-2">
        <Field label="Date of birth" required hint="Determines your age category">
          <Input type="date" value={data.dob} onChange={(e) => set({ dob: e.target.value })} />
        </Field>
        <Field label="Gender" required hint="Required for team category eligibility">
          <Select value={data.gender} onChange={(e) => set({ gender: e.target.value })}>
            <option value="">Select…</option>
            <option value="F">Female</option>
            <option value="M">Male</option>
            <option value="X">Non-binary / other</option>
            <option value="N">Prefer not to say</option>
          </Select>
        </Field>
      </div>
      <Field label="Nationality" required>
        <Select value={data.nat} onChange={(e) => set({ nat: e.target.value })}>
          <option value="">Select…</option>
          <option>Poland</option>
          <option>Germany</option>
          <option>Czechia</option>
          <option>Lithuania</option>
          <option>Ukraine</option>
          <option>United Kingdom</option>
          <option>Other</option>
        </Select>
      </Field>
      <details style={{ background: "var(--bg-2)", borderRadius: 10, padding: "12px 16px" }}>
        <summary style={{ cursor: "pointer", fontFamily: "var(--f-display)", fontWeight: 600, fontSize: 14 }}>
          Optional — club, coach, personal best
        </summary>
        <div className="form-grid-2" style={{ marginTop: 14 }}>
          <Field label="Running club"><Input value={data.club} onChange={(e) => set({ club: e.target.value })} placeholder="e.g. AZS Warsaw" /></Field>
          <Field label="Coach"><Input value={data.coach} onChange={(e) => set({ coach: e.target.value })} placeholder="Coach name" /></Field>
        </div>
        <Field label="Personal best mile time" hint="Used to seed your team's division — be honest">
          <Input value={data.pb} onChange={(e) => set({ pb: e.target.value })} placeholder="e.g. 5:42" />
        </Field>
      </details>
      {includeRole && (
        <Field label="Preferred role" hint="Captains have final say — this is a hint, not a promise">
          <Select value={data.role || ""} onChange={(e) => set({ role: e.target.value })}>
            <option value="">No preference</option>
            <option value="racer">Racer · full mile</option>
            <option value="ace">Ace · first leg, hand off the baton</option>
            <option value="joker">Joker · wait in zone, finish the mile</option>
          </Select>
        </Field>
      )}
    </div>
  );
}

/* -------------------- Consents + medical -------------------- */

function ConsentsAndMedical({ data, set, free }) {
  return (
    <>
      <div className="form-section">
        <div className="form-section-head">
          <h3>Medical self-declaration</h3>
          <p>Required for entry. We're not asking for a certificate, but a certificate from your GP is strongly recommended.</p>
        </div>
        <CheckRow id="med" checked={data.med} onChange={(e) => set({ med: e.target.checked })}>
          <strong>I declare I have no medical contraindications</strong> to running a mile at competition pace, and I will not race if I feel unwell on race day.
        </CheckRow>
      </div>
      <div className="form-section">
        <div className="form-section-head">
          <h3>Consents</h3>
          <p>All three are required to complete registration. Image rights apply to event photos &amp; broadcast.</p>
        </div>
        <CheckRow id="gdpr" checked={data.gdpr} onChange={(e) => set({ gdpr: e.target.checked })}>
          I consent to the processing of my personal data by ACE BATTLE POLAND Ltd. for race administration, ranking, and contact, per the <a href="#" style={{ borderBottom: "1px solid currentColor" }}>privacy policy</a>.
        </CheckRow>
        <CheckRow id="rules" checked={data.rules} onChange={(e) => set({ rules: e.target.checked })}>
          I have read and accept the <a href="#" style={{ borderBottom: "1px solid currentColor" }}>TEAMS MILE Warsaw race rules</a> and the <a href="#" style={{ borderBottom: "1px solid currentColor" }}>ABA rating regulations</a>.
        </CheckRow>
        <CheckRow id="img" checked={data.img} onChange={(e) => set({ img: e.target.checked })}>
          I consent to the use of my image in event photography, broadcast, and post-race publications.
        </CheckRow>
        <CheckRow id="liab" checked={data.liab} onChange={(e) => set({ liab: e.target.checked })}>
          I acknowledge the <strong>liability waiver</strong> — I race at my own risk and release the organizer from injury claims arising from my own conduct.
        </CheckRow>
      </div>
      <div className="form-section">
        <div className="form-section-head">
          <h3>Pricing</h3>
        </div>
        <PricingLine free={free} />
      </div>
    </>
  );
}

/* -------------------- Side panels -------------------- */

function SummarySide({ remaining, total, teamsFormed, label, sublabel, accentBlock, lines = [] }) {
  const urgency = useUrgency(remaining, total);
  return (
    <>
      {accentBlock}
      <div className="side-card">
        <div className="side-head"><h4>Registration summary</h4></div>
        <div className="side-rows">
          {lines.map(([k, v]) => (
            <div key={k} className="side-row"><span className="side-k">{k}</span><span className="side-v">{v}</span></div>
          ))}
        </div>
        <hr className="divider" style={{ margin: "16px 0" }} />
        <div className="side-rows">
          <div className="side-row">
            <span className="side-k">Free tier</span>
            <span className="side-v" style={{ color: urgency === "gone" ? "var(--muted)" : urgency === "red" ? "var(--accent)" : urgency === "amber" ? "var(--amber)" : "var(--green)" }}>
              {urgency === "gone" ? "Closed" : `${formatN(remaining)} left`}
            </span>
          </div>
          <div className="side-row">
            <span className="side-k">Teams forming</span>
            <span className="side-v">{teamsFormed}</span>
          </div>
        </div>
      </div>
      <div className="side-card" style={{ background: "var(--bg-2)", borderColor: "transparent" }}>
        <div className="side-head"><h4>Race day</h4></div>
        <div className="side-rows">
          <div className="side-row"><span className="side-k">Date</span><span className="side-v">27 Jun 2026</span></div>
          <div className="side-row"><span className="side-k">Venue</span><span className="side-v" style={{ textAlign: "right" }}>Stadion<br />Podskarbińska</span></div>
          <div className="side-row"><span className="side-k">Block</span><span className="side-v">{label}</span></div>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "14px 0 0", lineHeight: 1.5 }}>{sublabel}</p>
      </div>
    </>
  );
}

/* -------------------- Flow 1 — Start a team -------------------- */

function FlowStart({ remaining, total, teamsFormed, onBack, onDone, free }) {
  const [step, setStep] = useStateF(0);
  const [data, setData] = useStateF({
    teamName: "",
    teamCategory: "",
    region: "",
    notes: "",
    first: "", last: "", email: "", phone: "", dob: "", gender: "", nat: "",
    club: "", coach: "", pb: "", role: "",
    med: false, gdpr: false, rules: false, img: false, liab: false,
  });
  const set = (patch) => setData((d) => ({ ...d, ...patch }));
  const steps = ["Team", "Captain", "Confirm", "Done"];
  const isDone = step === 3;

  if (isDone) {
    return (
      <div className="flow">
        <div className="flow-grid">
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="reveal">
              <span className="reveal-eyebrow">
                <span className="suit suit-spade" style={{ color: "var(--accent)" }} /> Team created · 27 June 2026
              </span>
              <h2>Welcome, Captain.</h2>
              <p>Share this code with your runners. They'll see your team's preview, fill in their info, and lock their roster slot. You'll see them appear on the dashboard in real time.</p>
              <div className="reveal-code">
                <span className="reveal-code-text">{generateCode(data.teamName || "WARSAW-CREW")}</span>
                <button className="reveal-copy">⎘ Copy code</button>
              </div>
              <div className="reveal-share">
                <button className="reveal-share-btn">📋 Copy invite link</button>
                <button className="reveal-share-btn">💬 Share via WhatsApp</button>
                <button className="reveal-share-btn">✉ Email template</button>
                <button className="reveal-share-btn">⌗ QR code</button>
              </div>
              <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,0.1)", margin: "40px auto 24px", maxWidth: 480 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 480, margin: "0 auto", textAlign: "left" }}>
                <div>
                  <div className="eyebrow" style={{ color: "var(--muted-2)" }}>Roster status</div>
                  <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 22, color: "#fff", marginTop: 4 }}>1 / 12 · You</div>
                </div>
                <div>
                  <div className="eyebrow" style={{ color: "var(--muted-2)" }}>Next step</div>
                  <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 22, color: "#fff", marginTop: 4 }}>Recruit 6+</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 32, flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-lg">Go to team dashboard →</button>
                <button className="btn btn-lg" style={{ background: "rgba(255,255,255,0.08)", color: "#fff", borderColor: "rgba(255,255,255,0.18)" }} onClick={onBack}>Back to home</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const body = step === 0 ? (
    <div className="form-section">
      <div className="form-section-head">
        <h3>Tell us about the team</h3>
        <p>You'll lock this in now, but you can rename and adjust until 7 days before the event.</p>
      </div>
      <Field label="Team name" required hint="Will appear on results boards and the public roster">
        <Input value={data.teamName} onChange={(e) => set({ teamName: e.target.value })} placeholder="e.g. Warsaw Wolves" />
      </Field>
      <Field label="Team category" required hint="Determines which standings your team competes in">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {["Men's", "Women's", "Mixed"].map((c) => (
            <button key={c} type="button"
              className={cn("btn", data.teamCategory === c ? "btn-dark" : "btn-ghost")}
              onClick={() => set({ teamCategory: c })}>{c}</button>
          ))}
        </div>
      </Field>
      <Field label="Region" required>
        <Select value={data.region} onChange={(e) => set({ region: e.target.value })}>
          <option value="">Select…</option>
          {REGIONS.map((r) => <option key={r}>{r}</option>)}
        </Select>
      </Field>
      <Field label="Team description" hint="Optional. Visible to runners considering your team.">
        <Textarea value={data.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="What's the vibe? Who are you looking for?" />
      </Field>
    </div>
  ) : step === 1 ? (
    <>
      <RunnerInfo data={data} set={set} />
    </>
  ) : (
    <>
      <ConsentsAndMedical data={data} set={set} free={free} />
    </>
  );

  const filledRoster = SAMPLE_TEAM.filled;

  return (
    <FlowShell
      title="Start a team"
      step={step}
      steps={steps}
      onBack={onBack}
      body={body}
      side={
        <SummarySide
          remaining={remaining}
          total={total}
          teamsFormed={teamsFormed}
          label="Team race · 13:00"
          sublabel="Team mile races run between 13:00 and 14:00. You'll need at least 7 runners locked in by 20 June."
          lines={[
            ["Flow", "Start a team"],
            ["Team name", data.teamName || "—"],
            ["Category", data.teamCategory || "—"],
            ["Region", data.region || "—"],
            ["Captain", data.first ? `${data.first} ${data.last}` : "—"],
          ]}
          accentBlock={
            <div className="side-card side-card-dark">
              <div className="side-head"><h4>You're the captain</h4></div>
              <p style={{ fontSize: 13, color: "var(--muted-2)", margin: "0 0 14px", lineHeight: 1.5 }}>
                After registration you'll get a team code and a shareable link. Send it to your runners — each one fills their own info.
              </p>
              <div className="row gap-md">
                <span className="suit suit-spade" style={{ fontSize: 22, color: "var(--accent)" }} />
                <span style={{ fontFamily: "var(--f-display)", fontWeight: 700, color: "#fff", fontSize: 15 }}>Captains race too</span>
              </div>
            </div>
          }
        />
      }
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => step === 0 ? onBack() : setStep(step - 1)}>
            ← {step === 0 ? "Cancel" : "Previous step"}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => step < 2 ? setStep(step + 1) : setStep(3)}
          >
            {step === 2 ? `Create team & continue →` : "Continue →"}
          </button>
        </>
      }
    />
  );
}

function generateCode(name) {
  const slug = (name || "WARSAW").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 7) || "TEAM";
  return `WAW-${slug}-7K2P`;
}

/* -------------------- Flow 2 — Join a team -------------------- */

function FlowJoin({ remaining, total, teamsFormed, onBack, free }) {
  const [step, setStep] = useStateF(0);
  const [code, setCode] = useStateF("WAW-WOLVES-7K2P");
  const [codeValid, setCodeValid] = useStateF(true);
  const [data, setData] = useStateF({
    first: "Marek", last: "Nowak", email: "marek@example.com", phone: "+48 600 000 000",
    dob: "1995-04-12", gender: "M", nat: "Poland",
    club: "", coach: "", pb: "5:42", role: "",
    med: false, gdpr: false, rules: false, img: false, liab: false,
  });
  const set = (p) => setData((d) => ({ ...d, ...p }));
  const steps = ["Code", "Your info", "Confirm", "Done"];
  const isDone = step === 3;

  if (isDone) {
    return (
      <div className="flow">
        <div className="flow-grid">
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="reveal" style={{ background: "var(--bg)", color: "var(--ink)" }}>
              <span className="reveal-eyebrow" style={{ color: "var(--accent)" }}>♥ Slot locked · 27 June 2026</span>
              <h2 style={{ color: "var(--ink)" }}>You're in.</h2>
              <p style={{ color: "var(--muted)" }}>You're now on the {SAMPLE_TEAM.name} roster. We've sent a magic link to your email so you can access your team dashboard.</p>
              <div className="team-preview" style={{ background: "var(--bg-2)", maxWidth: 480, margin: "0 auto 24px", textAlign: "left" }}>
                <div className="team-preview-head">
                  <div>
                    <div className="team-preview-name">{SAMPLE_TEAM.name}</div>
                    <div className="team-preview-cat">{SAMPLE_TEAM.category} · {SAMPLE_TEAM.region}</div>
                  </div>
                  <span className="chip chip-red">YOU'RE IN</span>
                </div>
                <Roster filled={SAMPLE_TEAM.filled} you names={SAMPLE_TEAM.roster} />
                <div className="team-progress">
                  <div className="team-progress-fill" style={{ width: `${((SAMPLE_TEAM.filled + 1) / SAMPLE_TEAM.cap) * 100}%` }} />
                </div>
                <div className="team-progress-meta">
                  <span>{SAMPLE_TEAM.filled + 1} of {SAMPLE_TEAM.cap} runners</span>
                  <span>{SAMPLE_TEAM.cap - SAMPLE_TEAM.filled - 1} slots open</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-lg">Open my dashboard →</button>
                <button className="btn btn-ghost btn-lg" onClick={onBack}>Back to home</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const body = step === 0 ? (
    <div className="form-section">
      <div className="form-section-head">
        <h3>Got a code?</h3>
        <p>Your captain shared either an invite link or a code that looks like <span className="mono">WAW-XXXXXX-XXXX</span>.</p>
      </div>
      <Field label="Team code" required hint="We validate this against the live roster">
        <div className="row gap-md">
          <Input value={code} onChange={(e) => { setCode(e.target.value); setCodeValid(true); }} placeholder="WAW-WOLVES-7K2P" style={{ textTransform: "uppercase", fontFamily: "var(--f-mono)" }} />
          <button className="btn btn-dark" onClick={() => setCodeValid(code.toUpperCase().startsWith("WAW"))}>Check</button>
        </div>
      </Field>
      {codeValid && code && (
        <div className="team-preview" style={{ marginTop: 8 }}>
          <div className="team-preview-head">
            <div>
              <span className="chip chip-green" style={{ marginBottom: 8 }}>✓ Valid code</span>
              <div className="team-preview-name">{SAMPLE_TEAM.name}</div>
              <div className="team-preview-cat">Captain · {SAMPLE_TEAM.captain} · {SAMPLE_TEAM.category}</div>
            </div>
          </div>
          <Roster filled={SAMPLE_TEAM.filled} you names={SAMPLE_TEAM.roster} />
          <div className="team-progress"><div className="team-progress-fill" style={{ width: `${(SAMPLE_TEAM.filled / SAMPLE_TEAM.cap) * 100}%` }} /></div>
          <div className="team-progress-meta">
            <span>{SAMPLE_TEAM.filled} of {SAMPLE_TEAM.cap} runners</span>
            <span>{SAMPLE_TEAM.cap - SAMPLE_TEAM.filled} slots open</span>
          </div>
        </div>
      )}
      {!codeValid && (
        <div className="card" style={{ background: "var(--accent-soft)", borderColor: "transparent", padding: 14, fontSize: 13, color: "var(--accent)" }}>
          <strong>That code didn't match a team.</strong> Double-check with your captain, or <a href="#" style={{ borderBottom: "1px solid currentColor" }}>ask the organizer</a>.
        </div>
      )}
    </div>
  ) : step === 1 ? (
    <RunnerInfo data={data} set={set} includeRole />
  ) : (
    <ConsentsAndMedical data={data} set={set} free={free} />
  );

  return (
    <FlowShell
      title="Join a team"
      step={step}
      steps={steps}
      onBack={onBack}
      body={body}
      side={
        <SummarySide
          remaining={remaining}
          total={total}
          teamsFormed={teamsFormed}
          label="Team race · 13:00"
          sublabel="You'll race in the team block. Your captain will assign your role closer to race day."
          lines={[
            ["Flow", "Join a team"],
            ["Team", SAMPLE_TEAM.name],
            ["Captain", SAMPLE_TEAM.captain],
            ["Category", SAMPLE_TEAM.category],
            ["Your name", data.first ? `${data.first} ${data.last}` : "—"],
          ]}
          accentBlock={
            <div className="side-card" style={{ background: "var(--accent-soft)", borderColor: "transparent" }}>
              <div className="side-head"><h4 style={{ color: "var(--accent)" }}>You're joining</h4></div>
              <div className="team-preview-name" style={{ fontSize: 20, marginBottom: 6 }}>{SAMPLE_TEAM.name}</div>
              <Roster filled={SAMPLE_TEAM.filled} you names={SAMPLE_TEAM.roster} />
              <div className="team-progress" style={{ background: "rgba(225,29,42,0.15)" }}>
                <div className="team-progress-fill" style={{ background: "var(--accent)", width: `${((SAMPLE_TEAM.filled + (step > 0 ? 1 : 0)) / SAMPLE_TEAM.cap) * 100}%` }} />
              </div>
              <div className="team-progress-meta">
                <span>{SAMPLE_TEAM.filled + (step > 0 ? 1 : 0)} of {SAMPLE_TEAM.cap} runners</span>
                <span>+ YOU</span>
              </div>
            </div>
          }
        />
      }
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => step === 0 ? onBack() : setStep(step - 1)}>
            ← {step === 0 ? "Cancel" : "Previous step"}
          </button>
          <button className="btn btn-primary" onClick={() => step < 2 ? setStep(step + 1) : setStep(3)}>
            {step === 2 ? `Lock my slot →` : "Continue →"}
          </button>
        </>
      }
    />
  );
}

/* -------------------- Flow 3 — Free agent -------------------- */

function FlowFree({ remaining, total, teamsFormed, onBack, free }) {
  const [step, setStep] = useStateF(0);
  const [data, setData] = useStateF({
    first: "", last: "", email: "", phone: "", dob: "", gender: "", nat: "",
    club: "", coach: "", pb: "", role: "",
    prefRegion: "", prefTeammates: "",
    med: false, gdpr: false, rules: false, img: false, liab: false,
  });
  const set = (p) => setData((d) => ({ ...d, ...p }));
  const steps = ["Your info", "Preferences", "Confirm", "Pending"];
  const isDone = step === 3;

  if (isDone) {
    return (
      <div className="flow">
        <div className="flow-grid">
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="pending-card" style={{ maxWidth: 640, margin: "0 auto" }}>
              <div className="pending-icon">♦</div>
              <span className="eyebrow" style={{ color: "var(--accent)" }}>Pending team assignment</span>
              <h2 style={{ marginTop: 8, marginBottom: 12 }}>You're in the pool.</h2>
              <p style={{ color: "var(--muted)", maxWidth: "46ch", margin: "0 auto 24px", fontSize: 15 }}>
                We've added you to the free-agent pool with your preferences. The organizer will match you to a team with open slots, then send you an email — you confirm in your dashboard before the slot is locked.
              </p>
              <div className="card" style={{ background: "var(--bg-2)", borderColor: "transparent", padding: 20, marginBottom: 20, textAlign: "left" }}>
                <div className="side-rows">
                  <div className="side-row"><span className="side-k">Status</span><span className="side-v"><span className="chip chip-amber">Pending match</span></span></div>
                  <div className="side-row"><span className="side-k">Expected wait</span><span className="side-v">48–72 hours</span></div>
                  <div className="side-row"><span className="side-k">You'll hear</span><span className="side-v">Email + dashboard</span></div>
                  <div className="side-row"><span className="side-k">Magic link</span><span className="side-v">Sent to {data.email || "your email"}</span></div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-lg">Open my dashboard →</button>
                <button className="btn btn-ghost btn-lg" onClick={onBack}>Back to home</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const body = step === 0 ? <RunnerInfo data={data} set={set} includeRole /> :
    step === 1 ? (
      <div className="form-section">
        <div className="form-section-head">
          <h3>Matching preferences</h3>
          <p>All optional. We'll do our best — if there's no perfect fit, you can decline the match and stay in the pool.</p>
        </div>
        <Field label="Preferred region" hint="If you'd rather race with a local team">
          <Select value={data.prefRegion} onChange={(e) => set({ prefRegion: e.target.value })}>
            <option value="">Any region</option>
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Preferred teammates" hint="Comma-separated names or emails — we'll try to keep you together">
          <Textarea value={data.prefTeammates} onChange={(e) => set({ prefTeammates: e.target.value })} placeholder="e.g. anna.k@example.com, my brother Tomek" />
        </Field>
      </div>
    ) : <ConsentsAndMedical data={data} set={set} free={free} />;

  return (
    <FlowShell
      title="Find me a team"
      step={step}
      steps={steps}
      onBack={onBack}
      body={body}
      side={
        <SummarySide
          remaining={remaining}
          total={total}
          teamsFormed={teamsFormed}
          label="Team race · 13:00"
          sublabel="If we can't match you to a team in time, you can switch to the individual rating mile or get a full refund."
          lines={[
            ["Flow", "Find me a team"],
            ["Name", data.first ? `${data.first} ${data.last}` : "—"],
            ["Region", data.prefRegion || "Any"],
            ["Role", data.role || "No preference"],
            ["Status", <span className="chip chip-amber">Pending</span>],
          ]}
          accentBlock={
            <div className="side-card" style={{ background: "#fff7eb", borderColor: "transparent" }}>
              <div className="side-head"><h4 style={{ color: "var(--amber)" }}>How matching works</h4></div>
              <ol style={{ paddingLeft: 18, fontSize: 13, color: "var(--ink)", lineHeight: 1.6, margin: 0 }}>
                <li>You register with your preferences</li>
                <li>Organizer finds a team with an open slot</li>
                <li>We email you to confirm the match</li>
                <li>You accept → slot locked</li>
              </ol>
            </div>
          }
        />
      }
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => step === 0 ? onBack() : setStep(step - 1)}>
            ← {step === 0 ? "Cancel" : "Previous step"}
          </button>
          <button className="btn btn-primary" onClick={() => step < 2 ? setStep(step + 1) : setStep(3)}>
            {step === 2 ? `Join the pool →` : "Continue →"}
          </button>
        </>
      }
    />
  );
}

/* -------------------- Flow 4 — Solo -------------------- */

function FlowSolo({ remaining, total, teamsFormed, onBack, free }) {
  const [step, setStep] = useStateF(0);
  const [data, setData] = useStateF({
    first: "", last: "", email: "", phone: "", dob: "", gender: "", nat: "",
    club: "", coach: "", pb: "",
    med: false, gdpr: false, rules: false, img: false, liab: false,
  });
  const set = (p) => setData((d) => ({ ...d, ...p }));
  const steps = ["Your info", "Confirm", "Done"];
  const isDone = step === 2;

  if (isDone) {
    return (
      <div className="flow">
        <div className="flow-grid">
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="reveal" style={{ background: "var(--bg)", color: "var(--ink)" }}>
              <span className="reveal-eyebrow" style={{ color: "var(--accent)" }}>♣ Locked in · Individual rating mile</span>
              <h2 style={{ color: "var(--ink)" }}>See you at 10:30.</h2>
              <p style={{ color: "var(--muted)" }}>You're registered for the individual rating mile. Your finish time will land you on the official ABR ranking ladder.</p>
              <div className="card" style={{ background: "var(--bg-2)", borderColor: "transparent", padding: 24, maxWidth: 480, margin: "0 auto 24px", textAlign: "left" }}>
                <div className="side-rows">
                  <div className="side-row"><span className="side-k">Block</span><span className="side-v">10:30 – 12:00</span></div>
                  <div className="side-row"><span className="side-k">Chip pickup</span><span className="side-v">09:00 – 10:00</span></div>
                  <div className="side-row"><span className="side-k">Age category</span><span className="side-v">Seniors (assigned)</span></div>
                  <div className="side-row"><span className="side-k">Magic link</span><span className="side-v">Sent to {data.email || "you"}</span></div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-lg">Open my dashboard →</button>
                <button className="btn btn-ghost btn-lg" onClick={onBack}>Back to home</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const body = step === 0 ? <RunnerInfo data={data} set={set} /> : <ConsentsAndMedical data={data} set={set} free={free} />;

  return (
    <FlowShell
      title="Run solo · individual rating mile"
      step={step}
      steps={steps}
      onBack={onBack}
      body={body}
      side={
        <SummarySide
          remaining={remaining}
          total={total}
          teamsFormed={teamsFormed}
          label="Solo race · 10:30"
          sublabel="Run in the morning block, by age category. Your time enters the official rating ladder."
          lines={[
            ["Flow", "Run solo"],
            ["Name", data.first ? `${data.first} ${data.last}` : "—"],
            ["Distance", "1 mile · 1,609 m"],
            ["Result", "Official ABR rating"],
          ]}
          accentBlock={
            <div className="side-card side-card-dark">
              <div className="side-head"><h4>Solo, but on the ladder</h4></div>
              <p style={{ fontSize: 13, color: "var(--muted-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
                Your solo time is convertible — a captain can later invite you to join their team using the same profile.
              </p>
              <div className="row gap-md">
                <span className="suit suit-club" style={{ fontSize: 22, color: "var(--accent)" }} />
                <span style={{ fontFamily: "var(--f-display)", fontWeight: 700, color: "#fff", fontSize: 15 }}>Solo → team convertible</span>
              </div>
            </div>
          }
        />
      }
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => step === 0 ? onBack() : setStep(step - 1)}>
            ← {step === 0 ? "Cancel" : "Previous step"}
          </button>
          <button className="btn btn-primary" onClick={() => step < 1 ? setStep(step + 1) : setStep(2)}>
            {step === 1 ? `Lock in my solo entry →` : "Continue →"}
          </button>
        </>
      }
    />
  );
}

/* -------------------- Pick step (when user clicks generic "Register") -------------------- */

function RegisterPick({ onPick, onBack, remaining, total }) {
  const urgency = useUrgency(remaining, total);
  const flows = [
    { id: "start", suit: "♠", title: "Start a team", desc: "Be the captain. Pick a category. Invite your crew. You'll get a shareable code at the end.", meta: "~ 4 minutes" },
    { id: "join", suit: "♥", title: "Join a team", desc: "You have a code or invite link. Fill in your info and lock your roster slot.", meta: "~ 2 minutes" },
    { id: "free", suit: "♦", title: "Find me a team", desc: "You want to race in a team but don't have one. We'll match you.", meta: "~ 3 minutes" },
    { id: "solo", suit: "♣", title: "Run solo", desc: "Individual rating mile. Your time on the ABR ranking ladder.", meta: "~ 2 minutes" },
  ];
  return (
    <div className="flow">
      <div className="container" style={{ maxWidth: 920 }}>
        <button className="flow-back" onClick={onBack}>← back to landing</button>
        <div className="flow-form-card">
          <div className="flow-form-card-head">
            <div>
              <span className="eyebrow">Registration</span>
              <h2 style={{ marginTop: 4 }}>How are you racing?</h2>
            </div>
            <span className="chip" style={{ background: urgency === "gone" ? "var(--bg-2)" : urgency === "red" ? "var(--accent-soft)" : "var(--bg-2)", color: urgency === "red" ? "var(--accent)" : "var(--ink)" }}>
              {urgency === "gone" ? "Free tier closed · 50 PLN" : `${formatN(remaining)} free slots left`}
            </span>
          </div>
          <div className="flow-form-body" style={{ padding: 28 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              {flows.map((f, i) => (
                <button key={f.id} className="picker-sub" style={{ padding: 22, display: "grid", gridTemplateColumns: "32px 1fr auto auto", gap: 18, alignItems: "center" }}
                  onClick={() => onPick(f.id)}>
                  <span style={{ fontSize: 24, color: i % 2 ? "var(--accent)" : "var(--ink)" }} className="suit">{f.suit}</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: 18 }}>{f.title}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{f.desc}</div>
                  </div>
                  <span className="chip">{f.meta}</span>
                  <span className="picker-arrow">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* expose */
Object.assign(window, {
  FlowStart, FlowJoin, FlowFree, FlowSolo, RegisterPick,
});
