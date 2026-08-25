const PHASE_COPY = {
  awakening: ["Die Runen erwachen", "Erzmark bereitet Minecraft 26.2 vor"],
  opening: ["Das Tor öffnet sich", "Der Pfad nach Erzmark wird freigegeben"],
  crossing: ["Übergang nach Erzmark", "Deine Chronik wird fortgesetzt"],
  entered: ["Willkommen zurück", "Minecraft 26.2 wurde gerufen"],
  fractured: ["Das Tor antwortet nicht", "Der Übergang wurde sicher abgebrochen"],
};

/**
 * Kurze, bildschirmfüllende Abreise-Sequenz. Sie liegt nur über der Bühne,
 * damit Docks und Fensternavigation jederzeit stabil bleiben. Reduced Motion
 * bekommt dieselbe Rückmeldung ohne Tore, Glitch-Schnitte oder Kamerafahrt.
 */
export default function GateDepartureSequence({ phase = "idle", reducedMotion = false }) {
  if (phase === "idle") return null;
  const [title, detail] = PHASE_COPY[phase] ?? PHASE_COPY.awakening;

  return (
    <div
      className={`erzmark-departure is-${phase}${reducedMotion ? " is-reduced" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="erzmark-departure-veil" aria-hidden="true" />
      <div className="erzmark-departure-gate is-left" aria-hidden="true"><i>ᛖ</i></div>
      <div className="erzmark-departure-gate is-right" aria-hidden="true"><i>ᛗ</i></div>
      <div className="erzmark-departure-portal" aria-hidden="true">
        <span /><span /><span />
      </div>
      <div className="erzmark-departure-glitches" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="erzmark-departure-copy">
        <small>World Gate · 26.2</small>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}
