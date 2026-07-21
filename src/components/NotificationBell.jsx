import { useEffect, useRef, useState } from "react";
import { useNotifications } from "../state/NotificationsContext.jsx";
import { getPerformanceTier } from "../utils/performanceTier.js";
import { getSettings } from "../api/settings.js";
import { subscribeSettingsChanged } from "../state/settingsBus.js";

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 10.5c0-3.6 2.4-6 6-6s6 2.4 6 6c0 4.2 1.4 5.6 2 6.3H4c.6-.7 2-2.1 2-6.3Z" />
      <path d="M10 19.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

function FriendRequestIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="8" r="2.6" />
      <path d="M3.5 19c0-3.3 2.5-5 5.5-5s5.5 1.7 5.5 5" />
      <path d="M17 5.5v5M14.5 8h5" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 8v.01" strokeLinecap="round" />
    </svg>
  );
}

function formatRelativeTime(ms) {
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std`;
  return `vor ${Math.floor(diffH / 24)} Tag${Math.floor(diffH / 24) === 1 ? "" : "en"}`;
}

/**
 * Benachrichtigungs-Glocke im Header (Launcher-Update-TODO, Abschnitt 4).
 * Leuchtet/klingelt in einer Endlosschleife rot, solange ungelesene
 * Benachrichtigungen da sind (Stufe "full"; bei "reduced" nur statisch rot,
 * keine Bewegung). Klick öffnet das Popup, Schließen markiert alles als
 * gelesen ("gesehen") – Freundschaftsanfragen bleiben trotzdem bis zur
 * Annahme/Ablehnung im Freunde-Tab aktionierbar, das ist ein separater
 * Zustand von "gelesen" (siehe NotificationsContext).
 */
export default function NotificationBell() {
  const { notifications, unreadCount, respondFriendRequest, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const wrapRef = useRef(null);
  const tier = useRef(getPerformanceTier()).current;

  // "Freundschaftsanfragen"-Toggle in den Einstellungen (Abschnitt 6) schaltet
  // nur den proaktiven Hinweis (Leuchten/Klingeln/Badge) ab - offene Anfragen
  // bleiben beim manuellen Öffnen der Glocke weiterhin sichtbar/aktionierbar.
  useEffect(() => {
    getSettings()
      .then((s) => setNotifyEnabled(s.notify_friend_requests))
      .catch(() => {});
    return subscribeSettingsChanged((s) => setNotifyEnabled(s.notify_friend_requests));
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) closePopup();
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function closePopup() {
    setOpen(false);
    markAllRead();
  }

  const sorted = [...notifications].sort((a, b) => b.createdAt - a.createdAt);
  const showAlert = notifyEnabled && unreadCount > 0;

  return (
    <div className="erzmark-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`erzmark-bell-btn${showAlert ? " has-unread" : ""}${showAlert && tier === "full" ? " is-animated" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `${unreadCount} neue Benachrichtigungen` : "Benachrichtigungen"}
        title="Benachrichtigungen"
      >
        <span className="erzmark-bell-icon">
          <BellIcon />
        </span>
        {showAlert && <span className="erzmark-bell-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="erzmark-bell-popup">
          <div className="erzmark-bell-popup-header">
            <span>Benachrichtigungen</span>
            <button className="erzmark-modal-close" onClick={closePopup} aria-label="Schließen">
              ✕
            </button>
          </div>

          {sorted.length === 0 && <p className="erzmark-hint">Keine Benachrichtigungen.</p>}

          <div className="erzmark-bell-list">
            {sorted.map((n) => (
              <div key={n.id} className={`erzmark-bell-item${n.read ? "" : " is-unread"}`}>
                <span className={`erzmark-bell-item-icon erzmark-bell-item-icon-${n.type}`}>
                  {n.type === "friend_request" ? <FriendRequestIcon /> : <InfoIcon />}
                </span>
                <div className="erzmark-bell-item-body">
                  <p className="erzmark-bell-item-title">{n.title}</p>
                  {n.type === "friend_request" ? (
                    <p className="erzmark-bell-item-text">
                      <strong>{n.data.requesterName}</strong> {n.body}
                    </p>
                  ) : (
                    <p className="erzmark-bell-item-text">{n.body}</p>
                  )}
                  <span className="erzmark-bell-item-time">{formatRelativeTime(n.createdAt)}</span>

                  {n.type === "friend_request" && n.data.status === "pending" && (
                    <div className="erzmark-bell-item-actions">
                      <button
                        type="button"
                        className="erzmark-btn-primary-small"
                        onClick={() => respondFriendRequest(n.id, true)}
                      >
                        Annehmen
                      </button>
                      <button
                        type="button"
                        className="erzmark-link-btn"
                        onClick={() => respondFriendRequest(n.id, false)}
                      >
                        Ablehnen
                      </button>
                    </div>
                  )}
                  {n.type === "friend_request" && n.data.status !== "pending" && (
                    <span className={`erzmark-bell-item-status is-${n.data.status}`}>
                      {n.data.status === "accepted" ? "Angenommen" : "Abgelehnt"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
