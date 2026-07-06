import { invoke } from "@tauri-apps/api/core";

export async function getCurrentSkinUrl() {
  return invoke("get_current_skin_url");
}

export async function setSkinUrl(variant, url) {
  return invoke("set_skin_url", { variant, url });
}

/** `file` ist ein Browser-File-Objekt (aus einem <input type="file">). */
export async function uploadSkinFile(variant, file) {
  const buffer = await file.arrayBuffer();
  const fileBytes = Array.from(new Uint8Array(buffer));
  return invoke("upload_skin_file", { variant, fileBytes, fileName: file.name });
}

export async function resetSkin() {
  return invoke("reset_skin");
}
