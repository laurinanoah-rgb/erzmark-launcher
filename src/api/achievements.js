// Mock-API für Achievements & Stats (Launcher-Update-TODO, Abschnitt 3) - es
// gibt aktuell kein Achievement-Plugin und keine kategorisierten
// Kampf-/Erkundungs-/Handwerks-Stats im Backend (nur Quests/Spielzeit/
// Münzen/Level aus MMOCore, siehe profiles.js). Genau wie beim
// Freundessystem (Teil 1: Frontend/Mock, siehe FriendsList.jsx/
// NotificationsContext.jsx) wird hier zuerst die komplette UI gegen ein
// Mock-Datenformat gebaut, in das sich ein künftiger echter Tauri-Command
// 1:1 einsetzen lässt (gleiche Feldnamen, gleiche async-Signatur).

const MOCK_DELAY_MS = 220;

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const STATS = {
  playTimeSeconds: 152_430, // ~42h
  categories: [
    { key: "combat", label: "Kampf", icon: "⚔️", current: 63, max: 100 },
    { key: "exploration", label: "Erkundung", icon: "🧭", current: 41, max: 100 },
    { key: "crafting", label: "Handwerk", icon: "🔨", current: 78, max: 100 },
  ],
};

// Deterministisch aus der Achievement-ID abgeleitet, damit der Wert bei
// jedem Laden gleich bleibt (kein Math.random() für Anzeige-Werte).
function stablePercent(id, min, max) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return min + (hash % (max - min));
}

const ACHIEVEMENT_DEFS = [
  {
    id: "first-steps",
    title: "Erste Schritte",
    description: "Erzmark zum ersten Mal betreten.",
    tier: "bronze",
    icon: "🥾",
    unlockedDaysAgo: 60,
    contextSentence: "Freigeschaltet in der Eröffnungswoche des Servers.",
  },
  {
    id: "coin-pouch",
    title: "Volle Tasche",
    description: "1.000 Münzen angesammelt.",
    tier: "bronze",
    icon: "🪙",
    unlockedDaysAgo: 51,
    contextSentence: null,
  },
  {
    id: "first-boss",
    title: "Erster Fall",
    description: "An einem Boss-Event teilgenommen.",
    tier: "silver",
    icon: "🐉",
    unlockedDaysAgo: 33,
    contextSentence: "Freigeschaltet während des ersten großen Boss-Events.",
  },
  {
    id: "guild-founder",
    title: "Bund fürs Leben",
    description: "Einer Gilde beigetreten.",
    tier: "silver",
    icon: "🛡️",
    unlockedDaysAgo: 20,
    contextSentence: null,
  },
  {
    id: "master-smith",
    title: "Meisterschmied",
    description: "Ein legendäres Item selbst hergestellt.",
    tier: "gold",
    icon: "🔥",
    unlockedDaysAgo: 6,
    contextSentence: "Freigeschaltet kurz vor dem Winter-Update.",
  },
  {
    id: "explorer-100",
    title: "Kartograph",
    description: "100 unentdeckte Orte gefunden.",
    tier: "gold",
    icon: "🗺️",
    unlockedDaysAgo: null,
    contextSentence: null,
  },
  {
    id: "rudolf-friend",
    title: "R.U.D.O.L.F.s Vertrauter",
    description: "??? — wird erst nach Freischaltung sichtbar.",
    tier: "legendary",
    icon: "👁️",
    unlockedDaysAgo: null,
    contextSentence: null,
  },
  {
    id: "dungeon-clear",
    title: "Ohne Kratzer",
    description: "Einen Dungeon ohne Tode abgeschlossen.",
    tier: "silver",
    icon: "🗡️",
    unlockedDaysAgo: null,
    contextSentence: null,
  },
  {
    id: "champion",
    title: "Champion von Erzmark",
    description: "Rang 1 der Server-Bestenliste erreicht.",
    tier: "legendary",
    icon: "👑",
    unlockedDaysAgo: null,
    contextSentence: null,
  },
];

let achievementsState = null;

function buildInitialState() {
  const now = Date.now();
  return ACHIEVEMENT_DEFS.map((def) => ({
    id: def.id,
    title: def.title,
    description: def.description,
    tier: def.tier,
    icon: def.icon,
    unlocked: def.unlockedDaysAgo != null,
    unlockedAt: def.unlockedDaysAgo != null ? new Date(now - def.unlockedDaysAgo * 86_400_000).toISOString() : null,
    contextSentence: def.contextSentence,
    percentUnlocked: stablePercent(def.id, 2, 78),
    justUnlocked: false,
  }));
}

const listeners = new Set();
let unlockTimerStarted = false;

function scheduleSimulatedUnlock() {
  if (unlockTimerStarted) return;
  unlockTimerStarted = true;
  // Rein zur Demonstration des Freischalt-Moments/Lichtscheins während
  // laufender Session - ein späterer echter Endpunkt würde hierfür einen
  // Event-/Push-Mechanismus liefern statt eines Timers.
  window.setTimeout(() => {
    const target = achievementsState.find((a) => !a.unlocked);
    if (!target) return;
    target.unlocked = true;
    target.unlockedAt = new Date().toISOString();
    target.justUnlocked = true;
    target.contextSentence = target.contextSentence ?? "Soeben freigeschaltet.";
    listeners.forEach((fn) => fn({ ...target }));
  }, 25_000);
}

export async function getStats() {
  await delay(MOCK_DELAY_MS);
  return STATS;
}

export async function getAchievements() {
  await delay(MOCK_DELAY_MS);
  if (!achievementsState) achievementsState = buildInitialState();
  scheduleSimulatedUnlock();
  return achievementsState.map((a) => ({ ...a }));
}

/** Feuert einmalig, sobald während der laufenden Session ein Achievement
 * neu freigeschaltet wird (siehe scheduleSimulatedUnlock). */
export function subscribeNewUnlock(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Markiert ein frisch freigeschaltetes Achievement als "gesehen", damit der
 * Frisch-geschmiedet-Effekt nur einmal abläuft (danach nur noch das
 * dauerhafte Abkühl-Glühen). */
export function acknowledgeJustUnlocked(id) {
  const entry = achievementsState?.find((a) => a.id === id);
  if (entry) entry.justUnlocked = false;
}
