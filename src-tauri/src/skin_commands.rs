//! Tauri-Commands für den Skin-Wechsler (nutzt Mojangs Skin-API direkt).

use serde::Serialize;
use tauri::State;

use crate::auth::skin;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct SkinError {
    pub message: String,
}

impl From<anyhow::Error> for SkinError {
    fn from(e: anyhow::Error) -> Self {
        SkinError {
            message: e.to_string(),
        }
    }
}

fn read_access_token(state: &AppState) -> Result<String, SkinError> {
    let guard = state.session.lock().unwrap();
    guard
        .as_ref()
        .map(|s| s.mc_access_token.clone())
        .ok_or_else(|| SkinError {
            message: "Keine aktive Session – bitte zuerst einloggen".to_string(),
        })
}

/// Erneuert die Session bei Bedarf und liefert einen frischen Access-Token.
async fn fresh_access_token(state: &AppState) -> Result<String, SkinError> {
    crate::commands::ensure_fresh_session_internal(state)
        .await
        .map_err(|e| SkinError {
            message: e.to_string(),
        })?;
    read_access_token(state)
}

#[tauri::command]
pub async fn get_current_skin_url(state: State<'_, AppState>) -> Result<Option<String>, SkinError> {
    let access_token = fresh_access_token(state.inner()).await?;
    let profile = crate::auth::minecraft::fetch_profile(&access_token)
        .await
        .map_err(SkinError::from)?;
    Ok(skin::active_skin_url(&profile.skins))
}

#[tauri::command]
pub async fn set_skin_url(
    state: State<'_, AppState>,
    variant: String,
    url: String,
) -> Result<(), SkinError> {
    let access_token = fresh_access_token(state.inner()).await?;
    skin::set_skin_from_url(&access_token, &variant, &url)
        .await
        .map_err(SkinError::from)
}

#[tauri::command]
pub async fn upload_skin_file(
    state: State<'_, AppState>,
    variant: String,
    file_bytes: Vec<u8>,
    file_name: String,
) -> Result<(), SkinError> {
    let access_token = fresh_access_token(state.inner()).await?;
    skin::upload_skin(&access_token, &variant, file_bytes, &file_name)
        .await
        .map_err(SkinError::from)
}

#[tauri::command]
pub async fn reset_skin(state: State<'_, AppState>) -> Result<(), SkinError> {
    let access_token = fresh_access_token(state.inner()).await?;
    skin::reset_skin(&access_token).await.map_err(SkinError::from)
}
