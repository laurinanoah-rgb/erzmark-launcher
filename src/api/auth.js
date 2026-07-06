import { invoke } from "@tauri-apps/api/core";

/** Öffnet den System-Browser für den Microsoft-Login und wartet auf Abschluss. */
export async function login() {
  return invoke("login");
}

/** Beim App-Start: versucht stillen Login über gespeicherten Refresh-Token. */
export async function tryRestoreSession() {
  return invoke("try_restore_session");
}

/** Vor Spielstart aufrufen: erneuert Tokens falls nötig. */
export async function ensureFreshSession() {
  return invoke("ensure_fresh_session");
}

export async function logout() {
  return invoke("logout");
}
