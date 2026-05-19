/* global React, ReactDOM, Header, Footer, Landing, FlowStart, FlowJoin, FlowFree, FlowSolo, RegisterPick, TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakSelect, TweakSlider, TweakToggle, TweakColor */
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "stadium",
  "heroVariant": "editorial",
  "pickerVariant": "grid",
  "motif": "on",
  "freeRemaining": 178,
  "teamsFormed": 19,
  "normalVideoId": "PLACEHOLDER",
  "teamsVideoId": "PLACEHOLDER"
}/*EDITMODE-END*/;

const FREE_TOTAL = 300;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState({ name: "landing" });

  // apply palette + motif to document
  useEffect(() => {
    document.documentElement.setAttribute("data-palette", tweaks.palette);
    document.documentElement.setAttribute("data-motif", tweaks.motif);
  }, [tweaks.palette, tweaks.motif]);

  const remaining = Math.max(0, Math.min(FREE_TOTAL, tweaks.freeRemaining));
  const free = remaining > 0;

  const nav = (r) => {
    setRoute(r);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const backToLanding = () => nav({ name: "landing" });

  let view;
  if (route.name === "register-pick") {
    view = <RegisterPick onPick={(id) => nav({ name: "flow", flow: id })} onBack={backToLanding} remaining={remaining} total={FREE_TOTAL} />;
  } else if (route.name === "flow") {
    const props = { remaining, total: FREE_TOTAL, teamsFormed: tweaks.teamsFormed, onBack: backToLanding, free };
    view = route.flow === "start" ? <FlowStart {...props} />
      : route.flow === "join" ? <FlowJoin {...props} />
      : route.flow === "free" ? <FlowFree {...props} />
      : route.flow === "solo" ? <FlowSolo {...props} />
      : null;
  } else {
    view = (
      <Landing
        remaining={remaining}
        total={FREE_TOTAL}
        teamsFormed={tweaks.teamsFormed}
        heroVariant={tweaks.heroVariant}
        pickerVariant={tweaks.pickerVariant}
        normalVideoId={tweaks.normalVideoId}
        teamsVideoId={tweaks.teamsVideoId}
        onNav={nav}
      />
    );
  }

  return (
    <>
      <Header remaining={remaining} total={FREE_TOTAL} onNav={nav} route={route} />
      {view}
      <Footer onNav={nav} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Visual">
          <TweakRadio
            label="Color palette"
            value={tweaks.palette}
            onChange={(v) => setTweak("palette", v)}
            options={[
              { value: "stadium", label: "Stadium" },
              { value: "paper", label: "Paper" },
              { value: "midnight", label: "Midnight" },
            ]}
          />
          <TweakToggle
            label="Playing-card motif"
            value={tweaks.motif === "on"}
            onChange={(v) => setTweak("motif", v ? "on" : "off")}
          />
        </TweakSection>

        <TweakSection label="Landing variants">
          <TweakSelect
            label="Hero variant"
            value={tweaks.heroVariant}
            onChange={(v) => setTweak("heroVariant", v)}
            options={[
              { value: "editorial", label: "Editorial — type + photo" },
              { value: "stadium", label: "Stadium — bold black/red" },
              { value: "tactical", label: "Tactical — track + config" },
            ]}
          />
          <TweakSelect
            label="Four-path picker"
            value={tweaks.pickerVariant}
            onChange={(v) => setTweak("pickerVariant", v)}
            options={[
              { value: "grid", label: "2 × 2 card grid" },
              { value: "two-tier", label: "Two-tier (Team / Solo)" },
              { value: "tabs", label: "Tabs with detail panel" },
              { value: "guided", label: "Guided 'how do you race?'" },
            ]}
          />
        </TweakSection>

        <TweakSection label="Scarcity testing">
          <TweakSlider
            label="Free slots remaining"
            value={tweaks.freeRemaining}
            onChange={(v) => setTweak("freeRemaining", v)}
            min={0}
            max={300}
            step={1}
            unit={` / ${FREE_TOTAL}`}
          />
          <TweakSlider
            label="Teams formed"
            value={tweaks.teamsFormed}
            onChange={(v) => setTweak("teamsFormed", v)}
            min={0}
            max={80}
            step={1}
          />
        </TweakSection>

        <TweakSection label="YouTube videos">
          <TweakText
            label="TEAMS MILE video ID"
            value={tweaks.teamsVideoId}
            onChange={(v) => setTweak("teamsVideoId", v)}
            placeholder="e.g. dQw4w9WgXcQ"
          />
          <TweakText
            label="Normal mile video ID"
            value={tweaks.normalVideoId}
            onChange={(v) => setTweak("normalVideoId", v)}
            placeholder="YouTube ID"
          />
        </TweakSection>

        <TweakSection label="Jump to a screen">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => nav({ name: "landing" })}>Landing</button>
            <button className="btn btn-ghost btn-sm" onClick={() => nav({ name: "register-pick" })}>Picker</button>
            <button className="btn btn-ghost btn-sm" onClick={() => nav({ name: "flow", flow: "start" })}>Flow · Start</button>
            <button className="btn btn-ghost btn-sm" onClick={() => nav({ name: "flow", flow: "join" })}>Flow · Join</button>
            <button className="btn btn-ghost btn-sm" onClick={() => nav({ name: "flow", flow: "free" })}>Flow · Free</button>
            <button className="btn btn-ghost btn-sm" onClick={() => nav({ name: "flow", flow: "solo" })}>Flow · Solo</button>
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
