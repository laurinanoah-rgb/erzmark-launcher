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

// ---- Gilden-Verwaltung (Beschreibung/Regeln/Rollen/Events) ----
// Mitgliedschaft selbst bleibt In-Game (siehe Kommentar oben), aber alles
// rund um Beschreibung/Regeln/Rollen/Events lebt in eigenen Laravel-Tabellen
// (guild_profiles/guild_roles/guild_member_roles/guild_events), verknüpft
// über den Gilden-Tag - siehe GuildController.php auf dem Server. Jeder
// Endpunkt prüft serverseitig die Berechtigung, `guild.myPermissions` aus
// `getMyGuild()` steuert nur, was die UI überhaupt anbietet.

export function updateGuildDescription(token, description) {
  return apiRequest("/guild/description", { method: "PATCH", token, body: { description } });
}

export function updateGuildRules(token, rules) {
  return apiRequest("/guild/rules", { method: "PATCH", token, body: { rules } });
}

export function createGuildRole(token, { name, tagPrefix, permissions }) {
  return apiRequest("/guild/roles", {
    method: "POST",
    token,
    body: { name, tag_prefix: tagPrefix, permissions },
  });
}

export function updateGuildRole(token, roleId, { name, tagPrefix, permissions }) {
  return apiRequest(`/guild/roles/${roleId}`, {
    method: "PATCH",
    token,
    body: { name, tag_prefix: tagPrefix, permissions },
  });
}

export function deleteGuildRole(token, roleId) {
  return apiRequest(`/guild/roles/${roleId}`, { method: "DELETE", token });
}

export function assignMemberRole(token, uuid, roleId) {
  return apiRequest(`/guild/members/${uuid}/role`, {
    method: "POST",
    token,
    body: { guild_role_id: roleId },
  });
}

export function createGuildEvent(token, { title, description, startsAt }) {
  return apiRequest("/guild/events", {
    method: "POST",
    token,
    body: { title, description, starts_at: startsAt },
  });
}

export function updateGuildEvent(token, eventId, { title, description, startsAt }) {
  return apiRequest(`/guild/events/${eventId}`, {
    method: "PATCH",
    token,
    body: { title, description, starts_at: startsAt },
  });
}

export function deleteGuildEvent(token, eventId) {
  return apiRequest(`/guild/events/${eventId}`, { method: "DELETE", token });
}
