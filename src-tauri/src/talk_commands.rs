//! Tauri-Commands: Brücke zwischen React-Frontend und `talk.rs`.

use serde::Serialize;
use tauri::State;

use crate::social;
use crate::state::AppState;
use crate::talk;

#[derive(Debug, Serialize)]
pub struct TalkError {
    pub message: String,
}

impl From<anyhow::Error> for TalkError {
    fn from(e: anyhow::Error) -> Self {
        TalkError {
            message: e.to_string(),
        }
    }
}

/// Startet einen echten Talk-Request mit dem übergebenen Freund (per UUID) -
/// der Discord-Bot R.U.D.O.L.F. erstellt daraufhin einen privaten
/// Voice-Channel, siehe `talk.rs` für den vollen Ablauf.
#[tauri::command]
pub async fn start_talk(
    state: State<'_, AppState>,
    friend_uuid: String,
) -> Result<talk::TalkStartResult, TalkError> {
    let token = social::ensure_sanctum_token(state.inner()).await?;
    let client = reqwest::Client::new();
    talk::request_talk_start(&client, &token, &friend_uuid)
        .await
        .map_err(TalkError::from)
}

/// Fragt den Status eines zuvor gestarteten Talk-Requests ab (Poll-Fallback).
#[tauri::command]
pub async fn get_talk_status(
    state: State<'_, AppState>,
    request_id: String,
) -> Result<talk::TalkStatus, TalkError> {
    let token = social::ensure_sanctum_token(state.inner()).await?;
    let client = reqwest::Client::new();
    talk::fetch_talk_status(&client, &token, &request_id)
        .await
        .map_err(TalkError::from)
}
