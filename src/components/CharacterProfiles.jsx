import { useEffect, useRef, useState } from "react";
import { getCharacterProfiles } from "../api/profiles.js";

const AUTO_REFRESH_MS = 30 * 1000;

/** "WARRIOR" -> "Warrior" – reine Anzeige-Formatierung, keine feste
 * Übersetzungstabelle, da sich die Klassen serverseitig ändern können. */
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
 * Zeigt die MMOProfiles-Charakterprofile des eingeloggten Spielers an – das
 * aktuell/zuletzt gespielte Profil hervorgehoben, alle weiteren angelegten
 * Profile kompakt darunter. Jedes Profil hat eine eigene, unabhaengige
 * Kasse und Spielzeit (siehe profiles.php/ProfileController::mine() im
 * Backend) - deshalb Quests/Spielzeit/Münzen statt Kampfwerten
 * (Leben/Mana/Ausdauer), die kaum Aussagekraft ohne Kontext hatten.
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
            <span className="erzmark-profile-name-row">
              {active.rankIconUrl && (
                <span className="erzmark-rank-icon-ring">
                  <img className="erzmark-rank-icon" src={active.rankIconUrl} alt={active.rankName ?? ""} />
                </span>
              )}
              <span className="erzmark-profile-class">{active.name ?? prettifyClassName(active.class)}</span>
            </span>
            <span className="erzmark-profile-badge">Aktiv</span>
          </div>
          <span className="erzmark-profile-level">{prettifyClassName(active.class)} · Level {active.level}</span>
          <div className="erzmark-profile-stats">
            <StatChip label="Quests" value={`📜 ${active.questsCompleted ?? 0}`} />
            <StatChip label="Spielzeit" value={`⏱ ${formatPlayTime(active.playTime)}`} />
            <StatChip label="Münzen" value={`🪙 ${active.coins ?? 0}`} />
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="erzmark-profile-others">
          {others.map((p) => (
            <div key={p.uuid} className="erzmark-profile-row">
              <span className="erzmark-profile-row-class">{p.name ?? prettifyClassName(p.class)}</span>
              <span className="erzmark-profile-row-level">Lvl {p.level}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
