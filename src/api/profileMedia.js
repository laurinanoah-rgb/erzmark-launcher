import { invoke } from "@tauri-apps/api/core";

/**
 * Account-Profilbild/-Titelbild (22.07.2026, Nutzerwunsch) - haengt am
 * eingeloggten Account (nicht am MMOProfiles-Charakter), siehe social.rs
 * und ProfileController::resolveOwnProfile() im Backend.
 */
export async function getProfileMedia() {
  return invoke("get_profile_media");
}

/** `file` ist ein Browser-File-Objekt (aus einem <input type="file">), analog zu skin.js. */
async function fileToBytes(file) {
  const buffer = await file.arrayBuffer();
  return Array.from(new Uint8Array(buffer));
}

export async function uploadProfilePhoto(file) {
  const fileBytes = await fileToBytes(file);
  return invoke("upload_profile_photo", { fileBytes, fileName: file.name });
}

export async function removeProfilePhoto() {
  return invoke("remove_profile_photo");
}

export async function uploadProfileCover(file) {
  const fileBytes = await fileToBytes(file);
  return invoke("upload_profile_cover", { fileBytes, fileName: file.name });
}

export async function removeProfileCover() {
  return invoke("remove_profile_cover");
}
