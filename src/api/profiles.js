import { invoke } from "@tauri-apps/api/core";

/**
 * Liefert die MMOCore-Klassen/-Profile des eingeloggten Spielers (aktive
 * Klasse + alle weiteren angelegten Klassen), gelesen über die read-only
 * Spielstände-API auf erzmark.de (siehe profiles.rs).
 */
export async function getCharacterProfiles() {
  return invoke("get_character_profiles");
}
