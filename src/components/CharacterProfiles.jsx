import { useEffect, useRef, useState } from "react";
import { getCharacterProfiles } from "../api/profiles.js";

// Stats ändern sich nur durch Spielen, nicht in Echtzeit -> reicht, seltener
// als z.B. die Freundesliste neu zu laden.
const AUTO_REFRESH_MS = 5 * 60 * 1000;

/** "WARRIOR" -> "Warrior" – reine Anzeige-Formatierung, keine feste
 * Übersetzungstabelle, da sich die Klassen serverseitig ändern können. */
function prettifyClassName(rawClass) {
  return rawClass
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Die API liefert nur den zuletzt gespeicherten Wert (z.B. Leben beim
// Ausloggen), keinen bekannten Maximalwert -> bewusst als schlichte Zahl
// statt als (potenziell irreführender) Fortschrittsbalken dargestellt.
function StatChip({ label, value }) {
  if (value == null) return null;
  return (
    <div className="erzmark-profile-stat-chip">
      <span className="erzmark-profile-stat-chip-value">{value}</span>
      <span className="erzmark-profile-stat-chip-label">{label}</span>
    </div>
  );
}

/**
 * Zeigt die MMOCore-Klassen/-Profile des eingeloggten Spielers an – rein
 * visuell (Level, Erfahrung, Leben/Mana/Ausdauer). Die aktive Klasse wird
 * hervorgehoben, alle weiteren angelegten Klassen kompakt darunter.
 */
export default function CharacterProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    refresh();
    timerRef.current = window.setInterval(refresh, AUTO_REFRESH_MS);
    return () => window.clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setError(null);
    try {
      const result = await getCharacterProfiles();
      setProfiles(result);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  const active = profiles.find((p) => p.active);
  const others = profiles.filter((p) => !p.active);

  return (
    <div className="erzmark-profiles">
      <div className="erzmark-gallery-title">
        <span>Spielstände</span>
        <button className="erzmark-link-btn" onClick={refresh} disabled={loading} title="Aktualisieren">
          ↻
        </button>
      </div>

      {loading && <p className="erzmark-hint">Lädt…</p>}
      {error && <p className="erzmark-error">{error}</p>}

      {!loading && !error && profiles.length === 0 && (
        <p className="erzmark-gallery-empty">
          Noch keine Spielstände – spiel eine Runde, damit hier dein Charakter erscheint.
        </p>
      )}

      {active && (
        <div className="erzmark-profile-card erzmark-profile-card-active">
          <div className="erzmark-profile-card-header">
            <span className="erzmark-profile-class">{prettifyClassName(active.class)}</span>
            <span className="erzmark-profile-badge">Aktiv</span>
          </div>
          <span className="erzmark-profile-level">Level {active.level}</span>
          <div className="erzmark-profile-stats">
            <StatChip label="Leben" value={active.health} />
            <StatChip label="Mana" value={active.mana} />
            <StatChip label="Ausdauer" value={active.stamina} />
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="erzmark-profile-others">
          {others.map((p) => (
            <div key={p.class} className="erzmark-profile-row">
              <span className="erzmark-profile-row-class">{prettifyClassName(p.class)}</span>
              <span className="erzmark-profile-row-level">Lvl {p.level}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
