import { invoke } from "@tauri-apps/api/core";

/** Liefert die neuesten Screenshots inkl. kleiner JPEG-Vorschau als Data-URL. */
export async function listScreenshots(limit = 8) {
  return invoke("list_screenshots", { limit });
}

/** Öffnet den echten Screenshot-Ordner im Datei-Explorer des Betriebssystems. */
export async function openScreenshotsFolder() {
  return invoke("open_screenshots_folder");
}

/** Öffnet einen einzelnen Screenshot in Originalgröße mit dem Standard-Bildbetrachter. */
export async function openScreenshot(filename) {
  return invoke("open_screenshot", { filename });
}
