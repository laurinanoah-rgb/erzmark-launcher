import { useEffect, useRef, useState } from "react";
import { getFriends, removeFriend } from "../api/friends.js";
import { useNotifications } from "../state/NotificationsContext.jsx";

// Online-Status kann sich jederzeit ändern -> regelmäßig neu laden, während
// der Launcher offen bleibt.
const AUTO_REFRESH_MS = 30 * 1000;

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
  const [confirmingUuid, setConfirmingUuid] = useState(null);
  const [removingUuid, setRemovingUuid] = useState(null);
  const timerRef = useRef(null);
  // Server-seitig wirkt "Entfernen" asynchron (live falls online, sonst
  // sobald offline, siehe removeFriend()) - bis MMOCore das tatsächlich
  // übernommen hat, würde ein Refresh den Freund sonst kurz wieder anzeigen.
  // Bereits angeforderte Entfernungen daher lokal ausblenden, unabhängig
  // davon, was getFriends() zwischenzeitlich noch liefert.
  const pendingRemovalsRef = useRef(new Set());
  const { friendRequests, respondFriendRequest } = useNotifications();

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
      const visible = result.filter((f) => !pendingRemovalsRef.current.has(f.uuid));
      const sorted = [...visible].sort((a, b) => Number(b.online) - Number(a.online));
      setFriends(sorted);
      onOnlineCountChange?.(sorted.filter((f) => f.online).length);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(uuid) {
    setRemovingUuid(uuid);
    try {
      await removeFriend(uuid);
      pendingRemovalsRef.current.add(uuid);
      setFriends((prev) => prev.filter((f) => f.uuid !== uuid));
      setConfirmingUuid(null);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setRemovingUuid(null);
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

      {friendRequests.length > 0 && (
        <div className="erzmark-friend-requests">
          {friendRequests.map((req) => (
            <div key={req.id} className="erzmark-friend-request-card">
              <span className="erzmark-friend-request-text">
                <strong>{req.data.requesterName}</strong> möchte mit dir befreundet sein. Akzeptieren?
              </span>
              <div className="erzmark-friend-request-actions">
                <button
                  type="button"
                  className="erzmark-btn-primary-small"
                  onClick={() => respondFriendRequest(req.id, true)}
                >
                  Annehmen
                </button>
                <button type="button" className="erzmark-link-btn" onClick={() => respondFriendRequest(req.id, false)}>
                  Ablehnen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && <p className="erzmark-hint">Lädt…</p>}
      {error && <p className="erzmark-error">{error}</p>}

      {!loading && !error && friends.length === 0 && friendRequests.length === 0 && (
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
            {confirmingUuid === friend.uuid ? (
              <span className="erzmark-friend-remove-confirm">
                <button
                  type="button"
                  className="erzmark-friend-remove-confirm-btn"
                  onClick={() => handleRemove(friend.uuid)}
                  disabled={removingUuid === friend.uuid}
                  title="Wirklich entfernen?"
                >
                  {removingUuid === friend.uuid ? "…" : "Wirklich?"}
                </button>
                <button
                  type="button"
                  className="erzmark-link-btn"
                  onClick={() => setConfirmingUuid(null)}
                  disabled={removingUuid === friend.uuid}
                >
                  Abbrechen
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="erzmark-friend-remove-btn"
                onClick={() => setConfirmingUuid(friend.uuid)}
                title={`${friend.name} entfernen`}
                aria-label={`${friend.name} entfernen`}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
