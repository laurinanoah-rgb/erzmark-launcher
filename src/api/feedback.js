// Mock-API für Feature-Voting, Vorschlagsbox und die Übermittlung von
// Bug-Reports (Launcher-Update-TODO, Abschnitt 6) - genau wie bei
// achievements.js gibt es dafür noch kein echtes Backend/Ticket-System.
// Sammeln der Diagnose-Daten selbst (Log/OS/Version) läuft dagegen bereits
// echt über getBugReportContext() (siehe api/settings.js).

const MOCK_DELAY_MS = 200;

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

let features = [
  { id: "housing", title: "Grundstücks-Housing-System", description: "Eigene Parzellen mit Bau-Schutz.", upvotes: 142, downvotes: 8, myVote: 0 },
  { id: "arena-pvp", title: "Arena-PvP mit Ranglisten", description: "Separate Kampf-Arena losgelöst vom Open-World-PvP.", upvotes: 97, downvotes: 21, myVote: 0 },
  { id: "player-shops", title: "Spieler-Shops im Marktviertel", description: "Eigene Verkaufsstände statt nur Server-Shop.", upvotes: 88, downvotes: 4, myVote: 0 },
  { id: "seasonal-events", title: "Saisonale Event-Reihe", description: "Wiederkehrende Feiertags-Events mit eigenen Belohnungen.", upvotes: 61, downvotes: 3, myVote: 0 },
];

export async function getFeatures() {
  await delay(MOCK_DELAY_MS);
  return features.map((f) => ({ ...f }));
}

/** `direction`: 1 (Daumen hoch), -1 (Daumen runter). Erneutes Klicken auf die
 * bereits gewählte Richtung macht die Stimme rückgängig. */
export async function voteFeature(id, direction) {
  const feature = features.find((f) => f.id === id);
  if (!feature) return null;

  if (feature.myVote === 1) feature.upvotes -= 1;
  if (feature.myVote === -1) feature.downvotes -= 1;

  feature.myVote = feature.myVote === direction ? 0 : direction;

  if (feature.myVote === 1) feature.upvotes += 1;
  if (feature.myVote === -1) feature.downvotes += 1;

  await delay(MOCK_DELAY_MS);
  return { ...feature };
}

export const SUGGESTION_CATEGORIES = [
  { key: "balance", label: "Balance" },
  { key: "bugs", label: "Bugs" },
  { key: "ideen", label: "Ideen" },
];

let suggestions = [];

export async function getSuggestions() {
  await delay(MOCK_DELAY_MS);
  return [...suggestions];
}

export async function submitSuggestion({ category, text }) {
  await delay(MOCK_DELAY_MS);
  const entry = {
    id: `${Date.now()}`,
    category,
    text,
    submittedAt: new Date().toISOString(),
    status: "eingereicht",
  };
  suggestions = [entry, ...suggestions];
  return entry;
}

export async function submitBugReport(payload) {
  await delay(350);
  return { id: `${Date.now()}`, status: "received" };
}
