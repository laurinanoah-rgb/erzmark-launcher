import { useState } from "react";

/**
 * Dezente, schließbare Karte oberhalb der Freundesliste (Nutzerwunsch,
 * 22.08.2026, aus einem separaten Design-Prototyp übernommen): erscheint,
 * wenn laut echter Voice-Presence (23.08.2026, siehe TalkContext.jsx)
 * mindestens ein Freund gerade im Voice ist, man selbst aber nicht.
 *
 * WICHTIG: Der Launcher kann (Stand dieser Änderung) niemanden real in
 * einen Voice-Channel einladen/holen - dafür gibt es keinen Endpoint (nur
 * `GET voice/presence`, rein lesend, siehe voice.rs). Der Haupt-Button
 * täuscht deshalb bewusst KEINE Funktion vor, sondern ist - analog zum
 * Chat-Button in FriendProfilePopup.jsx - als "bald verfügbar" deaktiviert,
 * bis es einen echten Invite-/Notify-Endpoint dafür gibt. Die angezeigte
 * Anzahl ist aber bereits real.
 */
export default function SilentInviteRadar({ friendsInVoiceCount }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="erzmark-invite-radar">
      <button
        type="button"
        className="erzmark-invite-radar-close"
        onClick={() => setDismissed(true)}
        aria-label="Hinweis schließen"
        title="Schließen"
      >
        ✕
      </button>
      <p className="erzmark-invite-radar-text">
        {friendsInVoiceCount} {friendsInVoiceCount === 1 ? "Freund ist" : "Freunde sind"} gerade im Voice –
        dazuschalten?
      </p>
      <button
        type="button"
        className="erzmark-btn-primary-small"
        disabled
        title="Einladen/Benachrichtigen aus dem Launcher kommt bald - noch kein Endpoint dafür"
      >
        🎙️ Dazuschalten (bald verfügbar)
      </button>
    </div>
  );
}
