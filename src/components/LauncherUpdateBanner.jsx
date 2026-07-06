import { useEffect, useState } from "react";
import { checkForLauncherUpdate, installLauncherUpdate } from "../api/appUpdater.js";

/**
 * Dezenter Banner im Hauptbildschirm: informiert, wenn eine neue Version des
 * Launchers selbst verfügbar ist (Auto-Update der App, analog zu anderen
 * bekannten Launchern). Rendert nichts, solange kein Update gefunden wurde
 * oder der Update-Server nicht erreichbar ist (blockiert den Start nie).
 */
export default function LauncherUpdateBanner() {
  const [update, setUpdate] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    checkForLauncherUpdate()
      .then((result) => {
        if (!cancelled) setUpdate(result);
      })
      .catch(() => {
        // Kein Update-Server erreichbar o.ä. – bewusst leise ignorieren.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update) return null;

  async function handleInstall() {
    setInstalling(true);
    setError(null);
    try {
      await installLauncherUpdate(update, setProgress);
    } catch (err) {
      setError(err?.message ?? String(err));
      setInstalling(false);
    }
  }

  return (
    <div className="erzmark-update-banner">
      <span>
        Launcher-Update verfügbar (v{update.version})
        {installing && progress != null && ` – ${progress}%`}
        {installing && progress == null && " – wird installiert…"}
      </span>
      <div className="erzmark-update-banner-actions">
        {!installing && (
          <button
            className="erzmark-btn erzmark-btn-primary erzmark-update-banner-btn"
            onClick={handleInstall}
          >
            Jetzt aktualisieren
          </button>
        )}
        {error && <span className="erzmark-error">{error}</span>}
      </div>
    </div>
  );
}
