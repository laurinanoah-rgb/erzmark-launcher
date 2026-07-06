import { useEffect, useRef, useState } from "react";
import { getFriends } from "../api/friends.js";

// Online-Status kann sich jederzeit ändern -> regelmäßig neu laden, während
// der Launcher offen bleibt.
const AUTO_REFRESH_MS = 60 * 1000;

function formatLastSeen(unixSeconds) {
  if (!unixSeconds) return "";
  const diffMs = Date.now() - unixSeconds * 1000;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days === 1 ? "" : "en"}`;
}

/**
 * Zeigt die MMOCore-Freundesliste des eingeloggten Spielers an – rein
 * visuell (kein Hinzufügen/Entfernen im Launcher, das bleibt im Spiel über
 * MMOCore selbst). Online-Status kommt aus `lastloginapi_players`
 * (lastLogin > lastLogout = aktuell online).
 */
export default function FriendsList({ onOnlineCountChange }) {
  const [friends, setFriends] = useState([]);
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
      const result = await getFriends();
      const sorted = [...result].sort((a, b) => Number(b.online) - Number(a.online));
      setFriends(sorted);
      onOnlineCountChange?.(sorted.filter((f) => f.online).length);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  const onlineCount = friends.filter((f) => f.online).length;

  return (
    <div className="erzmark-friends">
      <div className="erzmark-gallery-title">
        <span>
          Freunde
          {friends.length > 0 && (
            <span className="erzmark-friends-count"> ({onlineCount}/{friends.length})</span>
          )}
        </span>
        <button className="erzmark-link-btn" onClick={refresh} disabled={loading} title="Aktualisieren">
          ↻
        </button>
      </div>

      {loading && <p className="erzmark-hint">Lädt…</p>}
      {error && <p className="erzmark-error">{error}</p>}

      {!loading && !error && friends.length === 0 && (
        <p className="erzmark-gallery-empty">Noch keine Freunde – füge welche im Spiel hinzu.</p>
      )}

      <div className="erzmark-friends-list">
        {friends.map((friend) => (
          <div key={friend.uuid} className="erzmark-friend-row">
            <span
              className={
                friend.online
                  ? "erzmark-friend-dot erzmark-friend-dot-online"
                  : "erzmark-friend-dot erzmark-friend-dot-offline"
              }
            />
            <span className="erzmark-friend-name">{friend.name}</span>
            {!friend.online && (
              <span className="erzmark-friend-lastseen">{formatLastSeen(friend.lastSeen)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
