import { invoke } from "@tauri-apps/api/core";

export async function getSettings() {
  return invoke("get_settings");
}

export async function saveSettings(settings) {
  return invoke("save_settings", { settings });
}

export async function getLauncherVersion() {
  return invoke("get_launcher_version");
}

export async function openGameFolder() {
  return invoke("open_game_folder");
}

export async function openLogFile() {
  return invoke("open_log_file");
}

export async function resetInstallation() {
  return invoke("reset_installation");
}
