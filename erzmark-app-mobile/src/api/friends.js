import { apiRequest } from "./client";

// Freundesliste (MMOCore), gelesen über dieselbe öffentliche, read-only
// PHP-API wie der Desktop-Launcher (siehe src-tauri/src/friends.rs im
// Projekt-Root und ERZMARK_FRIENDS_API_URL in src-tauri/src/config.rs).
const FRIENDS_API_URL = "https://erzmark.de/launcher/friends.php";

/** UUID ohne Bindestriche -> Standardformat, siehe friends.rs::to_dashed_uuid. */
function toDashedUuid(uuid) {
  if (!uuid || uuid.includes("-") || uuid.length !== 32) return uuid;
  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20, 32)}`;
}

/**
 * Liefert die Freundesliste (Name + Online-Status) für die übergebene
 * Account-UUID (nicht die MMOProfiles-Profil-UUID, siehe auth.js::getAccountUuid).
 */
export async function getFriends(accountUuid) {
  if (!accountUuid) return [];
  const url = `${FRIENDS_API_URL}?uuid=${encodeURIComponent(toDashedUuid(accountUuid))}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Freunde-API antwortete mit Fehler (${response.status})`);
  }
  const data = await response.json();
  return data?.friends ?? [];
}

// Freund entfernen (22.07.2026, Nutzerwunsch) - wirkt asynchron: live ingame,
// falls einer von beiden gerade online ist (ErzmarkSocial-Plugin), sonst
// sobald offline (Laravel-Scheduler). Gleicher Endpunkt wie im Desktop-
// Launcher (siehe FriendRequestController::remove auf dem Server).
export function removeFriend(token, uuid) {
  return apiRequest("/friends/remove", { method: "POST", token, body: { uuid } });
}
