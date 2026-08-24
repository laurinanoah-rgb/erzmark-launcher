import { invoke } from "@tauri-apps/api/core";

// Echter Talk-Start (23.08.2026, siehe TalkController.php + talk.rs/
// talk_commands.rs auf der Tauri-Seite - Backend wird parallel von einem
// anderen Agenten gebaut, Formate hier folgen dem abgestimmten Plan). Baut
// auf der bereits vorhandenen, rein lesenden Voice-Presence-Anzeige
// (voice.js) auf - dieser Wrapper stößt nur den aktiven Trigger an
// (R.U.D.O.L.F. erstellt einen echten privaten Voice-Channel), siehe
// TalkContext.jsx für den vollen Flow.

/**
 * Startet einen echten Talk-Request mit einem Freund. Liefert nur
 * `{ requestId }` - der Fortschritt wird per `getTalkStatus()` gepollt.
 */
export async function startTalk(friendUuid) {
  return invoke("start_talk", { friendUuid });
}

/**
 * Fragt den Status eines zuvor gestarteten Talk-Requests ab. Format:
 * `{ status: "pending"|"created"|"failed", channelId, inviteUrl, errorReason }`.
 */
export async function getTalkStatus(requestId) {
  return invoke("get_talk_status", { requestId });
}
