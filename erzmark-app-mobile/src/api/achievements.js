// Mock-API für Achievements & Stats — 1:1 dieselbe Datenstruktur wie der
// Desktop-Launcher (src/api/achievements.js im Projekt-Root), damit ein
// künftiger echter Backend-Wechsel (siehe Launcher-Update-TODO.md Abschnitt
// 3) an beiden Stellen identisch aussieht. Es gibt aktuell kein
// Achievement-Plugin im Backend — nur Quests/Spielzeit/Münzen/Level aus
// MMOCore (siehe profiles.js).
//
// Datenmodell: 4 thematische Kategorien, jede eine eskalierende
// Fortschritts-Kette (`step` legt die Reihenfolge fest), kein Sammelsurium
// unabhängiger Erfolge.

const MOCK_DELAY_MS = 220;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STATS = {
  playTimeSeconds: 152_430, // ~42h
};

// Deterministisch aus der Achievement-ID abgeleitet, damit der Wert bei
// jedem Laden gleich bleibt (kein Math.random() für Anzeige-Werte).
function stablePercent(id, min, max) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return min + (hash % (max - min));
}

const ACHIEVEMENT_DEFS = [
  // --- Meilensteine (Bosse, Server-Events) ---
  {
    id: "ms-1",
    category: "milestones",
    step: 1,
    title: "Erster Fall",
    description: "An einem Boss-Event teilgenommen.",
    icon: "🐉",
    unlockedDaysAgo: 33,
    contextSentence: "Freigeschaltet während des ersten großen Boss-Events.",
  },
  {
    id: "ms-2",
    category: "milestones",
    step: 2,
    title: "Kapitel-Bezwinger",
    description: "5 Bosse besiegt.",
    icon: "⚔️",
    unlockedDaysAgo: 10,
    contextSentence: null,
  },
  {
    id: "ms-3",
    category: "milestones",
    step: 3,
    title: "Kapitel-1-Meister",
    description: "Alle Kapitel-1-Bosse besiegt.",
    icon: "🏆",
    unlockedDaysAgo: null,
    contextSentence: null,
    progressPercent: 60,
  },
  {
    id: "ms-4",
    category: "milestones",
    step: 4,
    title: "Event-Teilnehmer",
    description: "An einem Server-Event teilgenommen.",
    icon: "🎉",
    unlockedDaysAgo: null,
    contextSentence: null,
    progressPercent: 20,
  },
  {
    id: "ms-5",
    category: "milestones",
    step: 5,
    title: "Event-Champion",
    description: "Ein Server-Event als Erster abgeschlossen.",
    icon: "👑",
    unlockedDaysAgo: null,
    contextSentence: null,
    progressPercent: 5,
  },
  {
    id: "ms-6",
    category: "milestones",
    step: 6,
    title: "Legende der Arena",
    description: "Alle Bosse aller Kapitel besiegt.",
    icon: "🌋",
    unlockedDaysAgo: null,
    contextSentence: null,
    progressPercent: 2,
  },

  // --- Sozial (Freunde, Gilde, Handel) ---
  {
    id: "so-1",
    category: "social",
    step: 1,
    title: "Erster Kontakt",
    description: "Ersten Freund hinzugefügt.",
    icon: "🤝",
    unlockedDaysAgo: 55,
    contextSentence: null,
  },
  {
    id: "so-2",
    category: "social",
    step: 2,
    title: "Kleiner Kreis",
    description: "5 Freunde erreicht.",
    icon: "👥",
    unlockedDaysAgo: 40,
    contextSentence: null,
  },
  {
    id: "so-3",
    category: "social",
    step: 3,
    title: "Bund fürs Leben",
    description: "Einer Gilde beigetreten oder eine gegründet.",
    icon: "🛡️",
    unlockedDaysAgo: 20,
    contextSentence: null,
  },
  {
    id: "so-4",
    category: "social",
    step: 4,
    title: "Handelspartner",
    description: "Mit 10 Spielern gehandelt.",
    icon: "💰",
    unlockedDaysAgo: null,
    contextSentence: null,
    progressPercent: 70,
  },
  {
    id: "so-5",
    category: "social",
    step: 5,
    title: "Gildenoberhaupt",
    description: "Eine Gilde mit 20 Mitgliedern angeführt.",
    icon: "🏰",
    unlockedDaysAgo: null,
    contextSentence: null,
    progressPercent: 15,
  },
  {
    id: "so-6",
    category: "social",
    step: 6,
    title: "Serverikone",
    description: "Von der ganzen Community als feste Größe anerkannt.",
    icon: "🌟",
    unlockedDaysAgo: null,
    contextSentence: null,
    progressPercent: 8,
  },

  // --- Gaming (Spielzeit, Münzen, Level) ---
  {
    id: "ga-1",
    category: "gaming",
    step: 1,
    title: "Erste Schritte",
    description: "Erzmark zum ersten Mal betreten.",
    icon: "🥾",
    unlockedDaysAgo: 60,
    contextSentence: "Freigeschaltet in der Eröffnungswoche des Servers.",
  },
  {
    id: "ga-2",
    category: "gaming",
    step: 2,
    title: "Warmgespielt",
    description: "8 Stunden Spielzeit erreicht.",
    icon: "⏱️",
    unlockedDaysAgo: 55,
    contextSentence: null,
  },
  {
    id: "ga-3",
    category: "gaming",
    step: 3,
    title: "Eingespielt",
    description: "20 Stunden Spielzeit erreicht.",
    icon: "🕐",
    unlockedDaysAgo: 30,
    contextSentence: null,
  },
  {
    id: "ga-4",
    category: "gaming",
    step: 4,
    title: "Ausdauernd",
    description: "100 Stunden Spielzeit erreicht.",
    icon: "⏳",
    unlockedDaysAgo: null,
    contextSentence: null,
    progressPercent: 42,
  },
  {
    id: "ga-5",
    category: "gaming",
    step: 5,
    title: "Münzsammler",
    description: "10.000 Münzen gesammelt.",
    icon: "🪙",
    unlockedDaysAgo: null,
    contextSentence: null,
    progressPercent: 65,
  },
  {
    id: "ga-6",
    category: "gaming",
    step: 6,
    title: "Uralter Spieler",
    description: "500 Stunden Spielzeit erreicht.",
    icon: "🕰️",
    unlockedDaysAgo: null,
    contextSentence: null,
    progressPercent: 9,
  },

  // --- Entdeckung & Geheimnisse (Erkundung, Verstecktes) ---
  {
    id: "di-1",
    category: "discovery",
    step: 1,
    title: "Erster Schritt ins Unbekannte",
    description: "Erste unentdeckte Region betreten.",
    icon: "🧭",
    unlockedDaysAgo: 45,
    contextSentence: null,
  },
  {
    id: "di-2",
    category: "discovery",
    step: 2,
    title: "Kartograph",
    description: "50 unentdeckte Orte gefunden.",
    icon: "🗺️",
    unlockedDaysAgo: null,
    contextSentence: null,
    progressPercent: 82,
  },
  {
    id: "di-3",
    category: "discovery",
    step: 3,
    title: "Weltenbummler",
    description: "Alle Biome besucht.",
    icon: "🌍",
    unlockedDaysAgo: null,
    contextSentence: null,
    progressPercent: 30,
  },
  {
    id: "di-4",
    category: "discovery",
    step: 4,
    title: "Höhlenforscher",
    description: "Die Tiefen der Nether-Minen erreicht.",
    icon: "🔥",
    unlockedDaysAgo: null,
    contextSentence: null,
    progressPercent: 45,
  },
  {
    id: "di-5",
    category: "discovery",
    step: 5,
    title: "R.U.D.O.L.F.s Vertrauter",
    description: "??? — wird erst nach Freischaltung sichtbar.",
    icon: "👁️",
    unlockedDaysAgo: null,
    contextSentence: null,
    progressPercent: 12,
  },
];

let achievementsState = null;

function buildInitialState() {
  const now = Date.now();
  return ACHIEVEMENT_DEFS.map((def) => ({
    id: def.id,
    category: def.category,
    step: def.step,
    title: def.title,
    description: def.description,
    icon: def.icon,
    unlocked: def.unlockedDaysAgo != null,
    unlockedAt: def.unlockedDaysAgo != null ? new Date(now - def.unlockedDaysAgo * 86_400_000).toISOString() : null,
    contextSentence: def.contextSentence,
    percentUnlocked: stablePercent(def.id, 2, 78),
    // Eigener Fortschritt des Spielers zum Freischalten (0-100), nur für
    // gesperrte Achievements relevant.
    progressPercent: def.unlockedDaysAgo != null ? 100 : def.progressPercent ?? 0,
    justUnlocked: false,
  }));
}

const listeners = new Set();
let unlockTimerStarted = false;

function scheduleSimulatedUnlock() {
  if (unlockTimerStarted) return;
  unlockTimerStarted = true;
  // Rein zur Demonstration des Freischalt-Moments während laufender Session
  // - ein späterer echter Endpunkt würde hierfür Push/Polling liefern statt
  // eines Timers (analog zum Freundes-/Benachrichtigungssystem).
  setTimeout(() => {
    const target = achievementsState.find((a) => !a.unlocked);
    if (!target) return;
    target.unlocked = true;
    target.unlockedAt = new Date().toISOString();
    target.progressPercent = 100;
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

/** Markiert ein frisch freigeschaltetes Achievement als "gesehen". */
export function acknowledgeJustUnlocked(id) {
  const entry = achievementsState?.find((a) => a.id === id);
  if (entry) entry.justUnlocked = false;
}
