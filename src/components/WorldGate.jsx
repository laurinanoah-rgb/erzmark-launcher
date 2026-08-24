const GATE_STEPS = [
  { id: "source", label: "Quelle", phases: ["manifest", "mojang-manifest"] },
  { id: "runtime", label: "Runtime", phases: ["java"] },
  { id: "world", label: "Spielwelt", phases: ["client", "libraries", "assets", "fabric"] },
  { id: "erzmark", label: "Erzmark", phases: ["erzmark-files", "done"] },
];

const PHASE_ORDER = ["manifest", "mojang-manifest", "java", "client", "libraries", "assets", "fabric", "erzmark-files", "done"];
const GATE_RUNES = ["ᚨ", "ᛉ", "ᚱ", "ᛃ", "ᛟ", "ᚾ", "ᛏ", "ᛖ"];

function GateGem({ active = false }) {
  return (
    <svg viewBox="0 0 24 24" className={active ? "is-active" : ""} aria-hidden="true">
      <path d="M12 2 19 8 12 22 5 8 12 2Z" fill="currentColor" />
      <path d="m5 8 7 14 7-14M5 8h14M9 8l3-6 3 6" fill="none" stroke="rgba(10,15,21,.62)" strokeWidth=".7" />
    </svg>
  );
}

function getStepIndex(phase) {
  const index = GATE_STEPS.findIndex((step) => step.phases.includes(phase));
  return index < 0 ? 0 : index;
}

function versionValue(value) {
  return value || "–";
}

export default function WorldGate({
  status,
  statusMeta,
  progress,
  percent,
  busy,
  launching,
  gameRunning,
  justPrepared,
  disabled,
  buttonLabel,
  statusError,
  actionError,
  onAction,
  onRetryStatus,
  children,
}) {
  const activeStep = getStepIndex(progress?.phase);
  const gateState = gameRunning
    ? "open"
    : launching
      ? "opening"
      : busy
        ? "forging"
        : justPrepared
          ? "prepared"
        : status?.state ?? "checking";
  const hasError = Boolean(statusError || actionError || status?.state === "error");
  const phasePercent = percent == null ? null : Math.max(0, Math.min(100, percent));
  const phaseIndex = Math.max(0, PHASE_ORDER.indexOf(progress?.phase));
  const overallPercent = busy
    ? Math.min(100, Math.round(((phaseIndex + (phasePercent ?? 22) / 100) / PHASE_ORDER.length) * 100))
    : null;
  const headline = gameRunning
    ? "Das Tor ist geöffnet"
    : launching
      ? "Der Übergang beginnt"
      : busy
        ? "Deine Welt wird geschmiedet"
        : justPrepared
          ? "Deine Welt ist bereit"
        : status?.state === "update_available"
          ? "Neue Spuren in Erzmark"
          : status?.state === "not_installed"
            ? "Bereite dein erstes Abenteuer vor"
            : "Das Tor nach Erzmark";

  return (
    <div className={`erzmark-world-gate is-${gateState}${hasError ? " has-error" : ""}`} style={{ "--gate-progress": `${overallPercent ?? 0}%` }}>
      <div className="erzmark-world-gate-visual" aria-hidden="true">
        <span className="erzmark-world-gate-veil" />
        <span className="erzmark-world-gate-shockwave" />
        <span className="erzmark-world-gate-arch" />
        <span className="erzmark-world-gate-runes">
          {GATE_RUNES.map((rune, index) => <i key={`${rune}-${index}`} style={{ "--rune-index": index }}>{rune}</i>)}
        </span>
        <span className="erzmark-world-gate-ring is-outer" />
        <span className="erzmark-world-gate-ring is-inner" />
        <span className="erzmark-world-gate-core"><GateGem active={busy || launching || gameRunning} /></span>
        <span className="erzmark-world-gate-sparks">{Array.from({ length: 10 }, (_, index) => <i key={index} style={{ "--gate-spark": index }} />)}</span>
      </div>

      <div className="erzmark-world-gate-heading">
        <span>{gameRunning ? "VERBUNDEN" : busy ? `VORBEREITUNG ${overallPercent ?? 0}%` : justPrepared ? "BEREIT" : "WORLD GATE"}</span>
        <strong>{headline}</strong>
        <small>{gameRunning ? "Minecraft läuft – wir sehen uns auf dem Server." : statusMeta.detail}</small>
      </div>

      {busy && progress ? (
        <div className="erzmark-world-gate-progress" aria-live="polite">
          <div className="erzmark-world-gate-steps">
            {GATE_STEPS.map((step, index) => {
              const stepState = index < activeStep || progress.phase === "done"
                ? "complete"
                : index === activeStep
                  ? "active"
                  : "pending";
              return (
                <div className={`erzmark-world-gate-step is-${stepState}`} key={step.id}>
                  <i>{stepState === "complete" ? "✓" : index + 1}</i>
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
          <div className="erzmark-world-gate-progress-copy">
            <span>{progress.label}</span>
            <strong>{phasePercent == null ? "…" : `${phasePercent}%`}</strong>
          </div>
          <div className="erzmark-world-gate-track" role="progressbar" aria-label={progress.label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={overallPercent ?? undefined}>
            <span style={{ width: `${overallPercent ?? 8}%` }} />
          </div>
        </div>
      ) : (
        <div className="erzmark-world-gate-versions" aria-label="Installierte Versionen">
          <span><small>Minecraft</small><strong>{versionValue(status?.minecraft_version)}</strong></span>
          <span><small>Installiert</small><strong>{versionValue(status?.installed_client_version)}</strong></span>
          <span><small>Aktuell</small><strong>{versionValue(status?.latest_client_version)}</strong></span>
        </div>
      )}

      {children}

      <button className="erzmark-btn-launch erzmark-world-gate-action" onClick={onAction} disabled={disabled} aria-label={busy && progress ? progress.label : buttonLabel}>
        <GateGem active={busy || launching || gameRunning} />
        <span className="erzmark-btn-launch-text">
          <span className="erzmark-btn-launch-label">{launching ? "Tor wird geöffnet…" : busy && progress ? progress.label : buttonLabel}</span>
          <span className="erzmark-btn-launch-sub">{gameRunning ? "Mit Erzmark verbunden" : statusMeta.detail}</span>
        </span>
        <span className="erzmark-btn-launch-arrow" aria-hidden="true">→</span>
      </button>

      <div className="erzmark-world-gate-ritual" aria-hidden="true">
        <i />
        <span>{hasError ? "Rune gebrochen" : gameRunning ? "Verbindung steht" : launching ? "Runen werden gebunden" : busy ? "Pforte wird geschmiedet" : "Berühre das Siegel"}</span>
        <i />
      </div>

      {hasError && (
        <div className="erzmark-world-gate-error" role="alert">
          <span><strong>Das Tor konnte nicht antworten.</strong><small>{actionError || statusError || status?.error || "Unbekannter Fehler"}</small></span>
          {status?.state === "error" || statusError ? <button type="button" onClick={onRetryStatus}>Erneut prüfen</button> : null}
        </div>
      )}
    </div>
  );
}
