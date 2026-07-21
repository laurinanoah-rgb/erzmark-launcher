// Mock-Verlaufsdaten für das Session-Stats-Dashboard (Launcher-Update-TODO,
// Abschnitt 6) - es gibt keine echte historische Aufzeichnung im Backend
// (MMOCore liefert nur den aktuellen Stand, siehe profiles.js), ein echter
// Verlauf bräuchte periodische Snapshots serverseitig (z. B. ein taeglicher
// Scheduler-Job wie `friends:sync-accepted`). Deterministisch generiert,
// damit die Kurve bei jedem Öffnen gleich aussieht.
const DAYS = 14;

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export async function getStatsHistory() {
  await delay(180);
  const today = new Date();
  const entries = [];
  let playTimeSeconds = 4_200;

  for (let i = DAYS - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dailyMinutes = Math.round(15 + pseudoRandom(i + 1) * 90);
    playTimeSeconds += dailyMinutes * 60;
    entries.push({
      date: date.toISOString().slice(0, 10),
      dailyPlayMinutes: dailyMinutes,
      cumulativePlayTimeSeconds: playTimeSeconds,
    });
  }

  return entries;
}
