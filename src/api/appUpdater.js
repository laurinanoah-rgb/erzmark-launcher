import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Prüft, ob eine neue Version des Launchers selbst verfügbar ist (nicht zu
 * verwechseln mit dem Minecraft-Manifest-Update-System, das die Spieldateien
 * aktualisiert). Fragt den Endpoint aus tauri.conf.json (plugins.updater.endpoints)
 * ab. Gibt `null` zurück, wenn der Launcher schon aktuell ist.
 */
export async function checkForLauncherUpdate() {
  return check();
}

/**
 * Lädt das Update herunter, installiert es und startet den Launcher neu.
 * `onProgress` wird mit einem Wert 0–100 aufgerufen (oder `null`, falls die
 * Downloadgröße vom Server nicht mitgeliefert wird).
 */
export async function installLauncherUpdate(update, onProgress) {
  let downloaded = 0;
  let total = 0;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? 0;
      downloaded = 0;
      onProgress?.(total ? 0 : null);
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress?.(total ? Math.round((downloaded / total) * 100) : null);
    } else if (event.event === "Finished") {
      onProgress?.(100);
    }
  });

  await relaunch();
}
