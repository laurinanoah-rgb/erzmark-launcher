import { apiRequest, apiUpload } from "./client";

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

// ---- Titelbild/Logo (19.07.2026) ----
// `pickerAsset` ist das Ergebnis von expo-image-picker (`{ uri, mimeType,
// fileName }`) - wird hier in ein FormData für den Multipart-Upload
// umgewandelt. Rechte-Prüfung ("manage_appearance") passiert serverseitig
// in GuildController.php, `guild.myPermissions` steuert nur die UI.
function assetToFormData(fieldName, asset) {
  const formData = new FormData();
  formData.append(fieldName, {
    uri: asset.uri,
    name: asset.fileName ?? `${fieldName}.jpg`,
    type: asset.mimeType ?? "image/jpeg",
  });
  return formData;
}

export function uploadGuildBanner(token, asset) {
  return apiUpload("/guild/banner", { token, formData: assetToFormData("banner", asset) });
}

export function removeGuildBanner(token) {
  return apiRequest("/guild/banner", { method: "DELETE", token });
}

export function uploadGuildLogo(token, asset) {
  return apiUpload("/guild/logo", { token, formData: assetToFormData("logo", asset) });
}

export function removeGuildLogo(token) {
  return apiRequest("/guild/logo", { method: "DELETE", token });
}

// ---- Gilden-Pinnwand (18.07.2026 serverseitig gebaut, 19.07.2026 in der
// App verdrahtet) - bleibende Beitraege mit Bild/Reaktionen/Kommentaren,
// im Gegensatz zum fluechtigen Chat. Jedes Mitglied darf posten/
// kommentieren/reagieren; Anpinnen und das Loeschen FREMDER Beitraege/
// Kommentare braucht "manage_posts" (serverseitig geprueft, den eigenen
// Beitrag/Kommentar darf jeder immer selbst loeschen).

export function getGuildFeed(token) {
  return apiRequest("/guild/feed", { token });
}

export function createGuildPost(token, { content, imageAsset }) {
  const formData = new FormData();
  if (content) formData.append("content", content);
  if (imageAsset) {
    formData.append("image", {
      uri: imageAsset.uri,
      name: imageAsset.fileName ?? "post.jpg",
      type: imageAsset.mimeType ?? "image/jpeg",
    });
  }
  return apiUpload("/guild/posts", { token, formData });
}

export function deleteGuildPost(token, postId) {
  return apiRequest(`/guild/posts/${postId}`, { method: "DELETE", token });
}

export function toggleGuildPostPin(token, postId) {
  return apiRequest(`/guild/posts/${postId}/pin`, { method: "PATCH", token });
}

export function toggleGuildPostReaction(token, postId) {
  return apiRequest(`/guild/posts/${postId}/react`, { method: "POST", token });
}

export function createGuildPostComment(token, postId, content) {
  return apiRequest(`/guild/posts/${postId}/comments`, { method: "POST", token, body: { content } });
}

export function deleteGuildPostComment(token, commentId) {
  return apiRequest(`/guild/comments/${commentId}`, { method: "DELETE", token });
}
