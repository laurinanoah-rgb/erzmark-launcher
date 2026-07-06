//! Tauri-Commands: Brücke zwischen React-Frontend und dem Manifest-/
//! Install-/Start-System in `game/`.

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::game::{install, install_state, launch};
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct GameError {
    pub message: String,
}

impl From<anyhow::Error> for GameError {
    fn from(e: anyhow::Error) -> Self {
        GameError {
            message: e.to_string(),
        }
    }
}

/// Schneller Status für den Install/Update/Play-Button (kein Datei-Hashing,
/// nur Versionsvergleich – siehe install::check_status).
#[tauri::command]
pub async fn get_play_status() -> install::PlayStatus {
    let client = reqwest::Client::new();
    install::check_status(&client).await
}

/// Führt die komplette Installation/Aktualisierung durch. Sendet laufend
/// `install-progress`-Events ans Frontend (Fortschrittsbalken).
#[tauri::command]
pub async fn install_or_update(app: AppHandle) -> Result<(), GameError> {
    let client = reqwest::Client::new();
    let app_for_progress = app.clone();

    install::install_or_update(&client, &move |progress| {
        let _ = app_for_progress.emit("install-progress", &progress);
    })
    .await
    .map_err(GameError::from)?;

    Ok(())
}

/// Startet Minecraft: sorgt zuerst für eine frische Session (Access-Token),
/// lädt das beim Installieren gespeicherte Start-Profil und startet den
/// Java-Prozess mit automatischem Connect zu erzmark.de.
#[tauri::command]
pub async fn launch_game(state: State<'_, AppState>) -> Result<(), GameError> {
    let info = crate::commands::ensure_fresh_session_internal(state.inner())
        .await
        .map_err(GameError::from)?;

    let Some(local_state) = install_state::load() else {
        return Err(GameError {
            message: "Das Spiel ist noch nicht installiert – bitte zuerst installieren.".to_string(),
        });
    };

    let profile = launch::load_profile(&local_state.profile_id).map_err(GameError::from)?;

    let access_token = {
        let guard = state.session.lock().unwrap();
        let session = guard.as_ref().ok_or_else(|| GameError {
            message: "Keine aktive Session".to_string(),
        })?;
        session.mc_access_token.clone()
    };

    let session_args = launch::SessionArgs {
        player_name: info.username,
        player_uuid: info.uuid,
        access_token,
    };

    launch::launch(&profile, &session_args)
        .await
        .map_err(GameError::from)?;

    Ok(())
}

/// Liefert die neuesten Screenshots (mit kleinen JPEG-Vorschaubildern als
/// Data-URLs) für die Screenshot-Galerie im Hauptbildschirm.
#[tauri::command]
pub fn list_screenshots(limit: Option<usize>) -> Result<Vec<crate::game::screenshots::ScreenshotEntry>, GameError> {
    crate::game::screenshots::list_recent(limit.unwrap_or(8)).map_err(GameError::from)
}

/// Öffnet den Screenshot-Ordner im Datei-Explorer des Betriebssystems.
#[tauri::command]
pub fn open_screenshots_folder() -> Result<(), GameError> {
    crate::game::screenshots::open_folder().map_err(GameError::from)
}

/// Öffnet einen einzelnen Screenshot in Originalgröße.
#[tauri::command]
pub fn open_screenshot(filename: String) -> Result<(), GameError> {
    crate::game::screenshots::open_file(&filename).map_err(GameError::from)
}
