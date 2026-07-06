import { invoke } from "@tauri-apps/api/core";

/** Liefert den nächsten Boss-Event-Termin (oder leere Felder, falls keiner gesetzt ist). */
export async function getBossEvent() {
  return invoke("get_boss_event");
}

/** Öffnet die Event-Übersichtsseite auf erzmark.de im System-Standardbrowser. */
export async function openExternalUrl(url) {
  return invoke("open_external_url", { url });
}
