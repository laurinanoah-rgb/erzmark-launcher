import { useEffect, useState } from "react";
import { getCharacterProfiles } from "../api/profiles.js";

/** "WARRIOR" -> "Warrior" – gleiche Formatierung wie in CharacterProfiles.jsx. */
function prettifyClassName(rawClass) {
  if (!rawClass) return "Charakter";
  return rawClass
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatPlayTime(totalSeconds) {
  if (!totalSeconds) return "0h";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/**
 * Kompakte Charakter-Karte direkt unter dem Spielen-Button im
 * Hauptbildschirm – zeigt nur das aktive Profil mit Level auf einen Blick
 * (ausführliche Liste aller Profile bleibt im Dock, siehe
 * CharacterProfiles.jsx). Zeigt Quests/Spielzeit/Münzen statt der
 * Kampfwerte (Leben/Mana/Ausdauer) - siehe CharacterProfiles.jsx für den
 * Hintergrund zu dieser Umstellung. Rendert bewusst nichts, solange kein
 * Charakter gefunden wurde (z.B. neuer Account, der noch nie gespielt hat)
 * oder die API nicht erreichbar ist – blockiert den Hauptbildschirm nie.
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
      <span className="erzmark-active-char-class">
        {active.rankIconUrl && (
          <img className="erzmark-rank-icon" src={active.rankIconUrl} alt={active.rankName ?? ""} />
        )}
        {prettifyClassName(active.class)}
      </span>
      <span className="erzmark-active-char-level">Level {active.level}</span>
      <div className="erzmark-active-char-stats">
        <span title="Abgeschlossene Quests">📜 {active.questsCompleted}</span>
        <span title="Spielzeit mit diesem Profil">⏱ {formatPlayTime(active.playTime)}</span>
        <span title="Münzen dieses Profils">🪙 {active.coins}</span>
      </div>
    </div>
  );
}
