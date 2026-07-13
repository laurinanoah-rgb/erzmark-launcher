// Boss-Event-Countdown: liest denselben öffentlichen JSON-Endpunkt wie der
// Desktop-Launcher (siehe src-tauri/src/events.rs im Projekt-Root). Bewusst
// NICHT über den Sanctum-app-api-Client (client.js), da dieser Endpunkt
// öffentlich/unauthentifiziert ist und schon vom Launcher direkt angesprochen
// wird - kein Grund, ihn hinter unserem eigenen Backend zu duplizieren.
const EVENTS_URL = "https://erzmark.de/launcher/events.json";

/**
 * Liefert den nächsten Boss-Event-Termin oder `null`, falls keiner gesetzt
 * ist / die Datei (noch) nicht existiert / ein Netzwerkfehler auftritt -
 * rein dekorativ, soll den HomeScreen nie blockieren.
 */
export async function getBossEvent() {
  try {
    const cacheBust = Date.now();
    const response = await fetch(`${EVENTS_URL}?_=${cacheBust}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.nextBossEventAt) return null;
    return data;
  } catch {
    return null;
  }
}
