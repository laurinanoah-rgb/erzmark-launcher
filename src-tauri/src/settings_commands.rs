//! Tauri-Commands für den Einstellungen-Bildschirm.

use serde::Serialize;

use crate::settings::LauncherSettings;

#[derive(Debug, Serialize)]
pub struct SettingsError {
    pub message: String,
}

impl From<anyhow::Error> for SettingsError {
    fn from(e: anyhow::Error) -> Self {
        SettingsError {
            message: e.to_string(),
        }
    }
}

impl From<std::io::Error> for SettingsError {
    fn from(e: std::io::Error) -> Self {
        SettingsError {
            message: e.to_string(),
        }
    }
}

#[tauri::command]
pub fn get_settings() -> LauncherSettings {
    crate::settings::load()
}

#[tauri::command]
pub fn save_settings(settings: LauncherSettings) -> Result<(), SettingsError> {
    crate::settings::save(&settings).map_err(SettingsError::from)
}

#[tauri::command]
pub fn get_launcher_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Öffnet den Spielordner (Mods/Saves/Resourcepacks/Screenshots) im
/// Datei-Explorer des Betriebssystems.
#[tauri::command]
pub fn open_game_folder() -> Result<(), SettingsError> {
    let dir = crate::game::paths::game_dir().map_err(SettingsError::from)?;
    std::fs::create_dir_all(&dir)?;
    open::that(dir).map_err(|e| SettingsError {
        message: e.to_string(),
    })?;
    Ok(())
}

/// Öffnet die Log-Datei des letzten Spielstarts (nützlich bei Abstürzen).
#[tauri::command]
pub fn open_log_file() -> Result<(), SettingsError> {
    let path = crate::game::paths::launcher_root()
        .map_err(SettingsError::from)?
        .join("logs")
        .join("latest.log");
    if !path.exists() {
        return Err(SettingsError {
            message: "Noch keine Log-Datei vorhanden – starte zuerst das Spiel einmal.".to_string(),
        });
    }
    open::that(path).map_err(|e| SettingsError {
        message: e.to_string(),
    })?;
    Ok(())
}

/// Setzt nur den lokal gemerkten Installations-Status zurück (nicht die
/// bereits heruntergeladenen Dateien) – erzwingt beim nächsten Start eine
/// vollständige Neuprüfung/Neuinstallation über den Install/Update-Button.
#[tauri::command]
pub fn reset_installation() -> Result<(), SettingsError> {
    if let Some(state) = crate::game::install_state::load() {
        if let Ok(profile_dir) = crate::game::paths::version_dir(&state.profile_id) {
            let _ = std::fs::remove_dir_all(profile_dir);
        }
    }
    if let Ok(path) = crate::game::paths::install_state_file() {
        let _ = std::fs::remove_file(path);
    }
    Ok(())
}
