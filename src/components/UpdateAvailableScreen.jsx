import { useState } from "react";
import { installLauncherUpdate } from "../api/appUpdater.js";

/**
 * Zentrierter Update-Bildschirm, der VOR dem Login-/Startbildschirm gezeigt
 * wird, sobald `checkForLauncherUpdate()` in App.jsx eine neue Version
 * gefunden hat. Im Gegensatz zur vorherigen Logik wird das Update NICHT mehr
 * automatisch ohne Rückfrage installiert – der Nutzer muss aktiv auf
 * "Jetzt aktualisieren" klicken (die Info dazu, welche Version das ist,
 * wird angezeigt).
 *
 * Schlägt die Installation fehl (z.B. Update-Server kurz nicht erreichbar),
 * blockiert das den Launcher nicht dauerhaft: nach einem Fehlversuch
 * erscheint zusätzlich eine Möglichkeit, ohne Update fortzufahren.
 */
export default function UpdateAvailableScreen({ update, onContinueWithoutUpdate }) {
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  async function handleInstall() {
    setInstalling(true);
    setError(null);
    try {
      await installLauncherUpdate(update, setProgress);
      // installLauncherUpdate startet den Launcher am Ende neu (relaunch) –
      // ab hier läuft normalerweise schon die neue Version, dieser
      // Bildschirm wird also nie regulär "fertig".
    } catch (err) {
      setError(err?.message ?? String(err));
      setInstalling(false);
    }
  }

  return (
    <div className="erzmark-login-screen">
      <div className="erzmark-logo erzmark-logo-hero" aria-label="Erzmark" />
      <h1 className="erzmark-title">Update verfügbar</h1>
      <p className="erzmark-subtitle">
        Eine neue Version des Launchers ist bereit (v{update.version}). Bitte
        aktualisiere, um weiterzuspielen.
      </p>

      <button
        className="erzmark-btn erzmark-btn-primary"
        onClick={handleInstall}
        disabled={installing}
      >
        {installing
          ? progress != null
            ? `Wird installiert – ${progress}%`
            : "Wird installiert…"
          : "Jetzt aktualisieren"}
      </button>

      {error && (
        <>
          <p className="erzmark-error">{error}</p>
          <button className="erzmark-btn erzmark-btn-primary" onClick={handleInstall}>
            Erneut versuchen
          </button>
          <button className="erzmark-link-btn" onClick={onContinueWithoutUpdate}>
            Ohne Update fortfahren
          </button>
        </>
      )}
    </div>
  );
}
