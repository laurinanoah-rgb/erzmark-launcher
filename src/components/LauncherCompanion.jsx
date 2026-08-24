import { useEffect, useMemo, useRef, useState } from "react";

const PHASE_MESSAGES = {
  manifest: "Ich prüfe, welche Spuren sich seit deinem letzten Besuch verändert haben.",
  "mojang-manifest": "Die Minecraft-Grundlagen werden abgeglichen.",
  java: "Die passende Laufzeit wird vorbereitet – du musst nichts einrichten.",
  client: "Der Minecraft-Client kommt gerade in die Schmiede.",
  libraries: "Die Werkzeuge für deine Welt werden sortiert.",
  assets: "Texturen und Klänge wandern an ihren Platz.",
  fabric: "Fabric verbindet die einzelnen Bausteine.",
  "erzmark-files": "Jetzt fehlen nur noch die echten Erzmark-Dateien.",
  done: "Alles sitzt. Das World Gate ist gleich bereit.",
};

function CompanionMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3 27 9v12l-11 8L5 21V9l11-6Z" fill="currentColor" opacity=".18" />
      <path d="m9 12 7-4 7 4v8l-7 5-7-5v-8Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 15h2M18 15h2M12 20c2.6 1.5 5.4 1.5 8 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function companionContent({ status, progress, busy, launching, gameRunning, statusError, actionError }) {
  if (gameRunning) return { mood: "success", title: "Gute Reise", message: "Minecraft läuft. Ich halte den Launcher im Hintergrund für dich bereit." };
  if (launching) return { mood: "gold", title: "Tor wird geöffnet", message: "Der Übergang nach Erzmark beginnt. Das kann einen kurzen Moment dauern." };
  if (actionError || statusError || status?.state === "error") return { mood: "danger", title: "Ich bleibe dran", message: "Die Verbindung war nicht erfolgreich. Nutze „Erneut prüfen“ direkt am World Gate." };
  if (busy) return { mood: "working", title: "In der Schmiede", message: PHASE_MESSAGES[progress?.phase] ?? "Ich bereite deine Welt Schritt für Schritt vor." };
  if (status?.state === "update_available") return { mood: "gold", title: "Neue Spuren entdeckt", message: "Ein Update wartet. Deine bestehenden Einstellungen bleiben dabei erhalten." };
  if (status?.state === "not_installed") return { mood: "blue", title: "Dein erster Übergang", message: "Ein Klick genügt – Java, Minecraft und Erzmark werden automatisch vorbereitet." };
  if (status?.state === "ready") return { mood: "success", title: "Alles bereit", message: "Das World Gate ist stabil. Wir sehen uns drüben in Erzmark." };
  return { mood: "blue", title: "R.U.D.O.L.F. prüft", message: "Ich gleiche gerade den Zustand deiner Installation ab." };
}

export default function LauncherCompanion(props) {
  const [expanded, setExpanded] = useState(true);
  const timerRef = useRef(null);
  const content = companionContent(props);
  const signalKey = useMemo(
    () => [props.status?.state, props.progress?.phase, props.launching, props.gameRunning, Boolean(props.statusError || props.actionError)].join(":"),
    [props.status?.state, props.progress?.phase, props.launching, props.gameRunning, props.statusError, props.actionError]
  );

  useEffect(() => {
    setExpanded(true);
    window.clearTimeout(timerRef.current);
    if (!props.busy && !props.launching && !props.gameRunning && !props.statusError && !props.actionError) {
      timerRef.current = window.setTimeout(() => setExpanded(false), 6500);
    }
    return () => window.clearTimeout(timerRef.current);
  }, [signalKey]);

  return (
    <aside className={`erzmark-companion is-${content.mood}${expanded ? " is-expanded" : " is-collapsed"}`} aria-label="R.U.D.O.L.F. Launcher-Begleiter">
      <button
        type="button"
        className="erzmark-companion-mark"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        title={expanded ? "Begleiter einklappen" : "R.U.D.O.L.F. öffnen"}
      >
        <CompanionMark />
        <i aria-hidden="true" />
      </button>
      {expanded && (
        <div className="erzmark-companion-copy" aria-live="polite">
          <span>R.U.D.O.L.F.</span>
          <strong>{content.title}</strong>
          <small>{content.message}</small>
        </div>
      )}
      {expanded && <button type="button" className="erzmark-companion-close" onClick={() => setExpanded(false)} aria-label="Begleiter einklappen">×</button>}
    </aside>
  );
}
