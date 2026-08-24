import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTalk } from "../state/TalkContext.jsx";

function formatLastSeen(unixSeconds) {
  if (!unixSeconds) return "Keine letzte Spur überliefert";
  const date = new Date(unixSeconds * 1000);
  return `Zuletzt gesehen: ${date.toLocaleDateString("de-DE", { day: "2-digit", month: "long" })} · ${date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
}

function ActionIcon({ type }) {
  if (type === "talk") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M8 10v4a4 4 0 0 0 8 0v-4"/><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M12 18v3M8 21h8"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 5h14v10H9l-4 4V5Z"/></svg>;
}

/**
 * Discord-artiges Profil-Popup für einen Freund (22.07.2026, Nutzerwunsch) -
 * öffnet sich beim Klick auf den Namen in der Freundesliste und zeigt
 * Avatar/Status/letztes-Online sowie den Entfernen-Button, den es bisher nur
 * inline in der Freundesliste gab. Der Chat-Button ist bewusst als
 * "Bald verfügbar" markiert - die eigentliche Chat-Funktion (Reverb/
 * Realtime) ist ein eigenes, noch nicht gebautes Vorhaben.
 *
 * Der frühere "🎙️ Talk (Vorschau)"-Button (22.08.2026) war eine reine
 * Client-Demo ohne Backend. Kurz darauf (23.08.2026 vormittags) wurde er
 * zwischenzeitlich ganz entfernt, weil das Anker-Widget stattdessen nur noch
 * passiv anzeigte, wer laut R.U.D.O.L.F. bereits im Voice ist - ohne
 * Möglichkeit, von hier aus einen neuen Talk anzustoßen. Jetzt (23.08.2026
 * nachmittags) gibt es den echten Trigger dafür (`startRealTalk` in
 * TalkContext.jsx, ruft `app-api/talk/start` auf) - der Button ist deshalb
 * zurück, diesmal ohne "(Vorschau)"-Zusatz. Aktiv ist er nur, wenn der
 * Freund laut `friend.discordLinked` seinen Account per Discord verknüpft
 * hat (Voraussetzung, damit R.U.D.O.L.F. ihn einem privaten Voice-Channel
 * zuordnen kann).
 */
export default function FriendProfilePopup({ friend, onClose, onRemove, removing }) {
  const [confirming, setConfirming] = useState(false);
  const { talkRequest, startRealTalk, resetTalkRequest } = useTalk();

  // Beim Öffnen eines (ggf. anderen) Freundes-Popups keinen veralteten
  // Fehler-/Pending-Zustand eines vorherigen Talk-Versuchs anzeigen.
  useEffect(() => {
    resetTalkRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend?.uuid]);

  if (!friend) return null;

  const isTalkRequestForThisFriend = talkRequest.friendUuid === friend.uuid;
  const talkPending = isTalkRequestForThisFriend && talkRequest.status === "pending";
  const talkFailed = isTalkRequestForThisFriend && talkRequest.status === "failed";
  const talkButtonTitle = !friend.discordLinked
    ? "Freund hat Discord noch nicht verknüpft"
    : talkPending
      ? "Talk-Anfrage läuft…"
      : "Erstellt einen privaten Discord-Voice-Channel mit diesem Freund";

  return createPortal(
    <div className="erzmark-modal-backdrop erzmark-encounter-backdrop" onClick={onClose}>
      <div
        className="erzmark-modal-panel erzmark-friend-popup-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Begegnung mit ${friend.name}`}
      >
        <div className="erzmark-encounter-banner" aria-hidden="true">
          <span className="erzmark-encounter-moon" />
          <span className="erzmark-encounter-ridge" />
          <span className="erzmark-encounter-runes">ᚨ · ᛉ · ᚱ</span>
        </div>
        <div className="erzmark-encounter-topline">
          <span>Begegnung · Weggefährte</span>
          <button className="erzmark-modal-close" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
        <div className="erzmark-modal-body">
          <div className="erzmark-friend-popup-hero">
            <span className="erzmark-friend-popup-avatar-frame">
              <img className="erzmark-friend-popup-avatar" src={friend.photoUrl ?? `https://crafatar.com/avatars/${friend.uuid}?size=128&overlay`} alt="" />
              <i className={friend.online ? "is-online" : ""} />
            </span>
            <div className="erzmark-friend-popup-info">
              <small>{friend.online ? "Am Feuer erreichbar" : "Auf fernen Wegen"}</small>
              <span className="erzmark-friend-popup-name">{friend.name}</span>
              <span className={`erzmark-friend-popup-status${friend.online ? " is-online" : ""}`}>
                {friend.online ? "Jetzt online" : formatLastSeen(friend.lastSeen)}
              </span>
            </div>
          </div>

          <div className="erzmark-encounter-thread">
            <span aria-hidden="true">✦</span>
            <div>
              <small>Gemeinsamer Faden</small>
              <p>{friend.online ? "Euer Band ist wach. Ein guter Augenblick, gemeinsam nach Erzmark aufzubrechen." : "Auch getrennte Wege bleiben verbunden. Beim nächsten Wiedersehen wartet euer gemeinsames Abenteuer."}</p>
            </div>
          </div>

          <div className="erzmark-friend-popup-actions">
            <button type="button" className="erzmark-encounter-action" disabled title="Chat kommt bald (Realtime via Reverb)">
              <ActionIcon type="chat" /><span><strong>Botschaft</strong><small>Bald verfügbar</small></span>
            </button>
            <button
              type="button"
              className="erzmark-encounter-action is-primary"
              disabled={!friend.discordLinked || talkPending}
              title={talkButtonTitle}
              onClick={() => startRealTalk(friend)}
            >
              <ActionIcon type="talk" /><span><strong>{talkPending ? "Ruf wird gesendet…" : "Gesprächsruf"}</strong><small>{friend.discordLinked ? "Privaten Talk öffnen" : "Discord nicht verknüpft"}</small></span>
            </button>
            {talkFailed && (
              <span className="erzmark-error">{talkRequest.error ?? "Talk konnte nicht gestartet werden"}</span>
            )}
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
                Band lösen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.querySelector(".erzmark-app") ?? document.body
  );
}
