import { useState } from "react";

/**
 * Discord-artiges Profil-Popup für einen Freund (22.07.2026, Nutzerwunsch) -
 * öffnet sich beim Klick auf den Namen in der Freundesliste und zeigt
 * Avatar/Status/letztes-Online sowie den Entfernen-Button, den es bisher nur
 * inline in der Freundesliste gab. Der Chat-Button ist bewusst als
 * "Bald verfügbar" markiert - die eigentliche Chat-Funktion (Reverb/
 * Realtime) ist ein eigenes, noch nicht gebautes Vorhaben.
 */
export default function FriendProfilePopup({ friend, onClose, onRemove, removing }) {
  const [confirming, setConfirming] = useState(false);
  if (!friend) return null;

  return (
    <div className="erzmark-modal-backdrop" onClick={onClose}>
      <div
        className="erzmark-modal-panel erzmark-friend-popup-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="erzmark-modal-header">
          <h2>Profil</h2>
          <button className="erzmark-modal-close" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
        <div className="erzmark-modal-body">
          <div className="erzmark-friend-popup-hero">
            <img
              className="erzmark-friend-popup-avatar"
              src={friend.photoUrl ?? `https://crafatar.com/avatars/${friend.uuid}?size=96&overlay`}
              alt=""
            />
            <div className="erzmark-friend-popup-info">
              <span className="erzmark-friend-popup-name">{friend.name}</span>
              <span className={`erzmark-friend-popup-status${friend.online ? " is-online" : ""}`}>
                {friend.online ? "Online" : "Offline"}
              </span>
            </div>
          </div>

          <div className="erzmark-friend-popup-actions">
            <button type="button" className="erzmark-btn-primary-small" disabled title="Chat kommt bald (Realtime via Reverb)">
              💬 Chat (bald verfügbar)
            </button>
            {confirming ? (
              <span className="erzmark-friend-remove-confirm">
                <button
                  type="button"
                  className="erzmark-friend-remove-confirm-btn"
                  onClick={() => onRemove(friend.uuid)}
                  disabled={removing}
                >
                  {removing ? "…" : "Wirklich entfernen?"}
                </button>
                <button type="button" className="erzmark-link-btn" onClick={() => setConfirming(false)} disabled={removing}>
                  Abbrechen
                </button>
              </span>
            ) : (
              <button type="button" className="erzmark-friend-popup-remove" onClick={() => setConfirming(true)}>
                Freund entfernen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
