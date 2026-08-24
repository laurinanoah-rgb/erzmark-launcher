import { useEffect, useRef, useState } from "react";
import { useTalk } from "../state/TalkContext.jsx";

function MicIcon({ muted }) {
  return muted ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M9 9v2a3 3 0 0 0 4.6 2.55M15 8.4V6a3 3 0 0 0-5.9-.75" />
      <path d="M5 11a7 7 0 0 0 8.3 6.9M19 11a7 7 0 0 1-1.4 4.2" />
      <path d="M12 18v3M9 21h6" />
      <path d="M4 4l16 16" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3M9 21h6" />
    </svg>
  );
}

function DeafenIcon({ muted }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <path d="M4 13v3a2 2 0 0 0 2 2h1v-5H5a1 1 0 0 0-1 1Z" />
      <path d="M20 13v3a2 2 0 0 1-2 2h-1v-5h1a1 1 0 0 1 1 1Z" />
      {muted && <path d="M3 3l18 18" />}
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.4M12 18.6V21M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M3 12h2.4M18.6 12H21M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
    </svg>
  );
}

function LeaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M15 16l4-4-4-4M19 12H9" />
    </svg>
  );
}

function InviteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5" />
      <path d="M18 8v6M15 11h6" />
    </svg>
  );
}

function formatDuration(startedAt, nowMs) {
  const totalSeconds = Math.max(0, Math.floor((nowMs - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function avatarUrl(member) {
  return member.photoUrl ?? `https://crafatar.com/avatars/${member.uuid}?size=64&overlay`;
}

/**
 * Schwebendes, ziehbares Overlay-Panel für den aktuellen (echten) Talk -
 * "Anker-Widget" (22.08.2026 Design-Prototyp, 23.08.2026 an echte
 * Voice-Presence-Daten angebunden). Wird nur angezeigt, wenn der eigene
 * User laut Voice-Presence gerade selbst im Voice ist, siehe
 * TalkContext.jsx für die Backend-Grenze (Launcher nimmt selbst nicht aktiv
 * an Voice-Chats teil, zeigt nur an).
 */
export default function AnchorWidget() {
  const {
    talk,
    collapsed,
    position,
    selfMicMuted,
    selfDeafened,
    speakingUuid,
    setPosition,
    setMemberVolume,
    toggleSelfMic,
    toggleSelfDeafen,
    toggleCollapse,
    leaveTalk,
  } = useTalk();

  const [now, setNow] = useState(Date.now());
  const [showDevices, setShowDevices] = useState(false);

  const dragRef = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    if (!talk) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [talk]);

  // Flyout schließt sich, sobald man wegklickt.
  useEffect(() => {
    if (!showDevices) return;
    function onDocClick(e) {
      if (widgetRef.current && !widgetRef.current.contains(e.target)) {
        setShowDevices(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showDevices]);

  // "moved"-Schwelle verhindert, dass ein Drag der Pille gleichzeitig als
  // Klick (= Ausklappen) gewertet wird.
  const draggedRef = useRef(false);

  function startDrag(e) {
    if (e.target.closest("button, input, select")) return;
    const rect = widgetRef.current.getBoundingClientRect();
    dragRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, startX: e.clientX, startY: e.clientY };
    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", stopDrag);
  }

  function onDrag(e) {
    if (!dragRef.current) return;
    if (
      Math.abs(e.clientX - dragRef.current.startX) > 4 ||
      Math.abs(e.clientY - dragRef.current.startY) > 4
    ) {
      draggedRef.current = true;
    }
    const rect = widgetRef.current.getBoundingClientRect();
    const x = Math.min(
      Math.max(0, e.clientX - dragRef.current.offsetX),
      window.innerWidth - rect.width
    );
    const y = Math.min(
      Math.max(0, e.clientY - dragRef.current.offsetY),
      window.innerHeight - rect.height
    );
    setPosition({ x, y });
  }

  function stopDrag() {
    dragRef.current = null;
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", stopDrag);
  }

  function handlePillClick() {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    toggleCollapse();
  }

  useEffect(() => () => {
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", stopDrag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!talk) return null;

  return (
    <div
      ref={widgetRef}
      className={`erzmark-anchor-widget${collapsed ? " is-collapsed" : ""}`}
      style={{ left: position.x, top: position.y }}
    >
      {collapsed ? (
        <button
          type="button"
          className="erzmark-anchor-pill"
          onMouseDown={startDrag}
          onClick={handlePillClick}
          title={`${talk.name} - klicken zum Ausklappen`}
        >
          <span className="erzmark-anchor-pill-avatars">
            {talk.members.slice(0, 4).map((m) => (
              <img key={m.uuid} className="erzmark-anchor-pill-avatar" src={avatarUrl(m)} alt="" />
            ))}
          </span>
          <span className={`erzmark-anchor-pill-mic${selfMicMuted ? " is-muted" : ""}`}>
            <MicIcon muted={selfMicMuted} />
          </span>
          <span className="erzmark-anchor-pill-count">{talk.members.length}</span>
        </button>
      ) : (
        <div className="erzmark-anchor-panel">
          <div className="erzmark-anchor-header" onMouseDown={startDrag}>
            <div className="erzmark-anchor-header-titles">
              <span className="erzmark-anchor-header-title">{talk.name}</span>
              <span className="erzmark-anchor-header-timer">{formatDuration(talk.startedAt, now)}</span>
            </div>
            <div className="erzmark-anchor-header-actions">
              <button
                type="button"
                className={`erzmark-anchor-icon-btn${selfMicMuted ? " is-muted" : ""}`}
                onClick={toggleSelfMic}
                title={selfMicMuted ? "Mikrofon aktivieren" : "Mikrofon stummschalten"}
                aria-pressed={selfMicMuted}
              >
                <MicIcon muted={selfMicMuted} />
              </button>
              <button
                type="button"
                className={`erzmark-anchor-icon-btn${selfDeafened ? " is-muted" : ""}`}
                onClick={toggleSelfDeafen}
                title={selfDeafened ? "Ton aktivieren" : "Ton stummschalten"}
                aria-pressed={selfDeafened}
              >
                <DeafenIcon muted={selfDeafened} />
              </button>
              <button
                type="button"
                className="erzmark-anchor-icon-btn"
                onClick={toggleCollapse}
                title="Einklappen"
              >
                <CollapseIcon />
              </button>
            </div>
          </div>

          <div className="erzmark-anchor-preview-note">
            Live-Anzeige aus dem echten Voice-Channel - der Launcher selbst
            überträgt kein Audio.
          </div>

          <div className="erzmark-anchor-members">
            {talk.members.map((m) => (
              <div key={m.uuid} className="erzmark-anchor-member-row">
                <img
                  className={`erzmark-anchor-member-avatar${
                    speakingUuid === m.uuid && !(m.isSelf ? selfMicMuted : m.micMuted) ? " is-speaking" : ""
                  }`}
                  src={avatarUrl(m)}
                  alt=""
                />
                <span className="erzmark-anchor-member-name">
                  {m.name}
                  {m.isSelf && " (Du)"}
                </span>
                {!m.isSelf && (
                  <input
                    type="range"
                    className="erzmark-anchor-member-volume"
                    min="0"
                    max="100"
                    value={m.volume}
                    onChange={(e) => setMemberVolume(m.uuid, Number(e.target.value))}
                    title={`Lautstärke für ${m.name} (nur lokal)`}
                  />
                )}
                <span
                  className={`erzmark-anchor-member-mic${
                    (m.isSelf ? selfMicMuted : m.micMuted) ? " is-muted" : ""
                  }`}
                  title={(m.isSelf ? selfMicMuted : m.micMuted) ? "Mikrofon stumm" : "Mikrofon an"}
                >
                  <MicIcon muted={m.isSelf ? selfMicMuted : m.micMuted} />
                </span>
              </div>
            ))}
          </div>

          <div className="erzmark-anchor-footer">
            <div className="erzmark-anchor-footer-invite-wrap">
              <button
                type="button"
                className="erzmark-anchor-footer-btn"
                disabled
                title="Einladen aus dem Launcher kommt bald - Mitglieder werden aktuell nur aus dem echten Voice-Channel angezeigt"
              >
                <InviteIcon />
                Weitere einladen (bald verfügbar)
              </button>
            </div>

            <div className="erzmark-anchor-footer-device-wrap">
              <button
                type="button"
                className="erzmark-anchor-footer-btn erzmark-anchor-footer-btn-icon-only"
                onClick={() => {
                  setShowDevices((v) => !v);
                }}
                title="Geräte-Einstellungen (Vorschau)"
              >
                <DeviceIcon />
              </button>
              {showDevices && (
                <div className="erzmark-anchor-flyout erzmark-anchor-device-popover">
                  <p className="erzmark-anchor-preview-note">
                    Vorschau - wirkt sich noch auf keine echte Audioverbindung aus.
                  </p>
                  <label className="erzmark-anchor-device-label">
                    Mikrofon
                    <select disabled>
                      <option>Standardmikrofon</option>
                    </select>
                  </label>
                  <label className="erzmark-anchor-device-label">
                    Ausgabe
                    <select disabled>
                      <option>Standard-Ausgabegerät</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

            <button
              type="button"
              className="erzmark-anchor-footer-btn erzmark-anchor-footer-btn-leave"
              onClick={leaveTalk}
              title="Talk verlassen"
            >
              <LeaveIcon />
              Verlassen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
