//! Tauri-Commands: Brücke zwischen React-Frontend und `social.rs`.

use serde::Serialize;
use tauri::State;

use crate::social;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct SocialError {
    pub message: String,
}

impl From<anyhow::Error> for SocialError {
    fn from(e: anyhow::Error) -> Self {
        SocialError {
            message: e.to_string(),
        }
    }
}

#[tauri::command]
pub async fn get_friend_requests(
    state: State<'_, AppState>,
) -> Result<Vec<social::FriendRequestEntry>, SocialError> {
    let token = social::ensure_sanctum_token(state.inner()).await?;
    let client = reqwest::Client::new();
    social::fetch_friend_requests(&client, &token)
        .await
        .map_err(SocialError::from)
}

#[tauri::command]
pub async fn respond_friend_request(
    state: State<'_, AppState>,
    id: i64,
    accept: bool,
) -> Result<social::FriendRequestEntry, SocialError> {
    let token = social::ensure_sanctum_token(state.inner()).await?;
    let client = reqwest::Client::new();
    social::respond_friend_request(&client, &token, id, accept)
        .await
        .map_err(SocialError::from)
}

#[tauri::command]
pub async fn remove_friend(state: State<'_, AppState>, uuid: String) -> Result<(), SocialError> {
    let token = social::ensure_sanctum_token(state.inner()).await?;
    let client = reqwest::Client::new();
    social::remove_friend(&client, &token, &uuid)
        .await
        .map_err(SocialError::from)
}
