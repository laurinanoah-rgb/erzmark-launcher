import { useEffect, useState } from "react";
import { getCharacterProfiles } from "../api/profiles.js";

/** "WARRIOR" -> "Warrior" – gleiche Formatierung wie in CharacterProfiles.jsx. */
function prettifyClassName(rawClass) {
  return rawClass
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Kompakte Charakter-Karte direkt unter dem Spielen-Button im
 * Hauptbildschirm – zeigt nur die aktive Klasse mit Level auf einen Blick
 * (ausführliche Liste aller Profile bleibt im Dock, siehe
 * CharacterProfiles.jsx). Rendert bewusst nichts, solange kein Charakter
 * gefunden wurde (z.B. neuer Account, der noch nie gespielt hat) oder die
 * API nicht erreichbar ist – blockiert den Hauptbildschirm nie.
 */
export default function ActiveCharacterCard() {
  const [active, setActive] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getCharacterProfiles()
      .then((profiles) => {
        if (cancelled) return;
        setActive(profiles.find((p) => p.active) ?? null);
      })
      .catch(() => {
        // Bewusst leise ignorieren – nur eine dezente Zusatzinfo, kein
        // kritischer Bestandteil des Hauptbildschirms.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!active) return null;

  return (
    <div className="erzmark-active-char-card">
      <span className="erzmark-active-char-class">{prettifyClassName(active.class)}</span>
      <span className="erzmark-active-char-level">Level {active.level}</span>
      <div className="erzmark-active-char-stats">
        {active.health != null && <span title="Leben">❤ {active.health}</span>}
        {active.mana != null && <span title="Mana">✦ {active.mana}</span>}
        {active.stamina != null && <span title="Ausdauer">⚡ {active.stamina}</span>}
      </div>
    </div>
  );
}
