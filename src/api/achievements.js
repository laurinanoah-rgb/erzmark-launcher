import { invoke } from "@tauri-apps/api/core";

// Echtes Achievement-Backend (23.08.2026, siehe AchievementController.php +
// achievements.rs/achievements_commands.rs auf der Tauri-Seite) - ersetzt
// den bisherigen reinen Client-Mock. Gleiche Feldnamen/async-Signatur wie
// vorher, damit AchievementsScreen.jsx unverändert bleiben konnte.
//
// `condition`/interne Tracking-Logik bleiben serverseitig - der Launcher
// bekommt nur das fertige JSON (id/category/step/title/description/icon/
// unlocked/unlockedAt/contextSentence/percentUnlocked/progressPercent/
// justUnlocked), siehe Backend-Kommentar in AchievementController.php.

export async function getStats() {
  const stats = await invoke("get_achievement_stats");
  trackForNewUnlocks(await getAchievementsQuiet());
  return stats;
}

export async function getAchievements() {
  const achievements = await invoke("get_achievements");
  trackForNewUnlocks(achievements);
  return achievements;
}

/** Wie getAchievements(), aber ohne den Unlock-Tracking-Seiteneffekt
 * auszulösen - genutzt intern von getStats(), damit dort nicht doppelt
 * getrackt wird, falls beide kurz hintereinander aufgerufen werden. */
async function getAchievementsQuiet() {
  return invoke("get_achievements");
}

// --- Polling-Ersatz für den früheren rein clientseitigen Unlock-Timer ---
//
// Der Mock hatte einen simulierten Freischalt-Moment während der laufenden
// Session (scheduleSimulatedUnlock). Das echte Backend hat KEIN Push-/
// Event-System für neue Freischaltungen (die schreibt der
// achievements:check-Scheduler alle 15 Minuten serverseitig weg) - deshalb
// wird hier stattdessen periodisch neu abgerufen und mit dem zuletzt
// bekannten Freischalt-Zustand verglichen. Ein Wechsel unlocked:false ->
// unlocked:true (oder ein frisches justUnlocked:true) zwischen zwei Abrufen
// gilt als "neu freigeschaltet" und löst denselben Frisch-geschmiedet-Effekt
// aus wie vorher der Mock-Timer.
const POLL_INTERVAL_MS = 60_000;

let lastKnownUnlocked = null; // Map<id, bool> | null (null = noch kein Abruf)
const listeners = new Set();
let pollTimerStarted = false;

function trackForNewUnlocks(achievements) {
  const previous = lastKnownUnlocked;
  const current = new Map(achievements.map((a) => [a.id, a.unlocked]));

  if (previous) {
    for (const a of achievements) {
      const wasUnlocked = previous.get(a.id) ?? false;
      if (a.unlocked && !wasUnlocked) {
        listeners.forEach((fn) => fn({ ...a, justUnlocked: true }));
      } else if (a.unlocked && a.justUnlocked) {
        // Bereits freigeschaltet, aber serverseitig noch nicht bestätigt
        // (seen_at NULL) - z. B. weil der Nutzer die Schmiede seit der
        // Freischaltung nicht mehr geöffnet hat. Trotzdem als "neu" melden.
        listeners.forEach((fn) => fn({ ...a }));
      }
    }
  }

  lastKnownUnlocked = current;
}

function schedulePolling() {
  if (pollTimerStarted) return;
  pollTimerStarted = true;
  window.setInterval(() => {
    if (listeners.size === 0) return;
    getAchievements().catch(() => {
      // Netzwerkfehler beim Hintergrund-Poll - kein kritischer Pfad, nächster
      // Poll versucht es erneut.
    });
  }, POLL_INTERVAL_MS);
}

/** Feuert, sobald ein Achievement neu freigeschaltet erkannt wird (entweder
 * durch einen Wechsel seit dem letzten Abruf, oder weil der letzte Abruf
 * bereits ein noch unbestätigtes justUnlocked:true zurückgab). */
export function subscribeNewUnlock(callback) {
  listeners.add(callback);
  schedulePolling();
  return () => listeners.delete(callback);
}

/** Markiert ein frisch freigeschaltetes Achievement als "gesehen" (setzt
 * seen_at serverseitig), damit der Frisch-geschmiedet-Effekt nur einmal
 * abläuft. Fire-and-forget - kein kritischer Pfad für die Anzeige. */
export function acknowledgeJustUnlocked(id) {
  invoke("acknowledge_achievement", { achievementId: id }).catch(() => {
    // Bestätigung fehlgeschlagen (z. B. Netzwerk) - der Effekt läuft dann
    // beim nächsten Öffnen der Schmiede erneut ab, kein Datenverlust.
  });
}
