import { invoke } from "@tauri-apps/api/core";

/**
 * Liefert die echte Voice-Presence der Freunde (+ ggf. der eigenen UUID,
 * falls man selbst gerade im Voice ist), gelesen über den Sanctum-
 * authentifizierten `app-api/voice/presence`-Endpoint (siehe voice.rs).
 * Leeres Array, wenn niemand von den Freunden gerade im Voice ist.
 *
 * Format je Eintrag: `{ uuid, channelId, channelName, micMuted, deafened,
 * joinedAt }`. Enthält KEINE Namen/Avatare - die müssen anhand der `uuid`
 * gegen die bereits geladene Freundesliste (siehe `friends.js`) aufgelöst
 * werden, siehe TalkContext.jsx.
 */
export async function getVoicePresence() {
  return invoke("get_voice_presence");
}
