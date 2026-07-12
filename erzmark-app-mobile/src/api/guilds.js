import { apiRequest } from "./client";

// WICHTIG: MMOCore (das Gildensystem im Spiel) erlaubt nur eine Gilde pro
// Spieler - Daten liegen als YAML-Dateien direkt auf dem Server
// (plugins/MMOCore/guilds/<tag>.yml, kein MySQL). MMOCore ist Closed-Source
// und nicht erweiterbar, deshalb spiegelt die App bewusst nur diese eine
// Gilde statt eines eigenen Mehrfach-Mitgliedschafts-Systems (siehe
// PLANNING.md -> "Technische Erkenntnis: Gildensystem").
//
// Mitgliedschaft (Beitreten/Verlassen) verwaltet weiterhin MMOCore direkt
// per In-Game-Befehl - die App liest nur, verändert keine Mitgliedschaft.

// Liefert `null`, wenn der Spieler aktuell in keiner Gilde ist.
export function getMyGuild(token) {
  return apiRequest("/guild/mine", { token });
}

// Chat-Historie der eigenen Gilde (Realtime-Nachrichten kommen separat über
// den Websocket-Kanal, siehe PLANNING.md -> "Realtime-Infrastruktur").
export function getGuildChatHistory(token, { before } = {}) {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  return apiRequest(`/guild/chat${query}`, { token });
}

export function sendGuildChatMessage(token, message) {
  return apiRequest("/guild/chat", {
    method: "POST",
    token,
    body: { message },
  });
}
