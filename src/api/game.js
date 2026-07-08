import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * Fragt den aktuellen Install/Update/Play-Status ab (schneller
 * Versionsvergleich gegen erzmark.de/launcher/manifest.json, kein
 * Datei-Hashing). Rückgabe-Form (siehe install.rs `PlayStatus`):
 * { state: "not_installed"|"update_available"|"ready"|"error",
 *   installedClientVersion, latestClientVersion, minecraftVersion, error }
 *
 * Tauri serialisiert Rust-`snake_case`-Felder standardmäßig 1:1 (kein
 * automatisches CamelCase) – daher unten Zugriff über die Originalnamen.
 */
export async function getPlayStatus() {
  return invoke("get_play_status");
}

/**
 * Startet Installation/Update. `onProgress` wird wiederholt mit
 * { phase, label, current, total } aufgerufen, bis `phase === "done"` (oder
 * ein Fehler geworfen wird). Läuft komplett im Rust-Backend – hier wird nur
 * zugehört und der Startbefehl abgesetzt.
 */
export async function installOrUpdate(onProgress) {
  const unlisten = onProgress
    ? await listen("install-progress", (event) => onProgress(event.payload))
    : null;
  try {
    await invoke("install_or_update");
  } finally {
    unlisten?.();
  }
}

/** Startet Minecraft (nach erfolgreicher Installation) mit Auto-Connect. */
export async function launchGame() {
  return invoke("launch_game");
}

/**
 * Feuert, sobald der Minecraft-Prozess erfolgreich gestartet wurde (nicht
 * erst wenn das Fenster sichtbar ist, aber deutlich zuverlässiger als ein
 * Timer). Für den Play-Button -> "Spiel läuft…".
 */
export function onGameStarted(callback) {
  return listen("game-started", callback);
}

/**
 * Feuert, sobald der Minecraft-Prozess beendet wurde – egal ob durch
 * normales Beenden, Verlassen des Servers (Quick-Play beendet den Client
 * automatisch) oder Absturz. Setzt den Play-Button zurück.
 */
export function onGameExited(callback) {
  return listen("game-exited", callback);
}
