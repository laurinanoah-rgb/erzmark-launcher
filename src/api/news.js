import { invoke } from "@tauri-apps/api/core";

/** Liefert die neuesten Neuigkeiten von erzmark.de/news. */
export async function getNews(limit = 6) {
  return invoke("get_news", { limit });
}

/** Öffnet einen Link (z. B. den vollen Artikel) im System-Standardbrowser. */
export async function openExternalUrl(url) {
  return invoke("open_external_url", { url });
}
