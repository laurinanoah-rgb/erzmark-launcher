//! Tauri-Commands: Brücke zwischen React-Frontend und `voice.rs`.

use serde::Serialize;
use tauri::State;

use crate::social;
use crate::state::AppState;
use crate::voice;

#[derive(Debug, Serialize)]
pub struct VoiceError {
    pub message: String,
}

impl From<anyhow::Error> for VoiceError {
    fn from(e: anyhow::Error) -> Self {
        VoiceError {
            message: e.to_string(),
        }
    }
}

/// Liefert die Voice-Presence der Freunde (+ ggf. der eigenen UUID, falls
/// man selbst gerade im Voice ist) des eingeloggten Users.
#[tauri::command]
pub async fn get_voice_presence(
    state: State<'_, AppState>,
) -> Result<Vec<voice::VoicePresenceEntry>, VoiceError> {
    let token = social::ensure_sanctum_token(state.inner()).await?;
    let client = reqwest::Client::new();
    voice::fetch_voice_presence(&client, &token)
        .await
        .map_err(VoiceError::from)
}
