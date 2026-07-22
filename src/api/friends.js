import { invoke } from "@tauri-apps/api/core";

/**
 * Liefert die Freundesliste des eingeloggten Spielers (Name + Online-Status),
 * gelesen über die read-only Freunde-API auf erzmark.de (siehe friends.rs).
 */
export async function getFriends() {
  return invoke("get_friends");
}

/**
 * Löst die aktuelle Skin-URL eines Freundes anhand seiner UUID auf - über
 * Mojangs öffentlichen Session-Server (kein eigener Account/Auth nötig,
 * siehe friend_skin.rs), genutzt vom "Sozialer Modus" im Skin Mirror.
 * Liefert `null`, falls der Spieler keinen eigenen Skin gesetzt hat oder
 * die Anfrage fehlschlägt (kein kritischer Pfad, Vorschau bleibt dann leer).
 */
export async function getFriendSkinUrl(uuid) {
  return invoke("get_friend_skin_url", { uuid });
}

/**
 * Entfernt einen Freund (22.07.2026, Nutzerwunsch) - wirkt asynchron: live
 * ingame, falls einer von beiden gerade online ist (ErzmarkSocial-Plugin),
 * sonst sobald offline (Laravel-Scheduler), siehe social.rs::remove_friend.
 */
export async function removeFriend(uuid) {
  return invoke("remove_friend", { uuid });
}
