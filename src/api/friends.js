import { invoke } from "@tauri-apps/api/core";

/**
 * Liefert die Freundesliste des eingeloggten Spielers (Name + Online-Status),
 * gelesen über die read-only Freunde-API auf erzmark.de (siehe friends.rs).
 */
export async function getFriends() {
  return invoke("get_friends");
}
