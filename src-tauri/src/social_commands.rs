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

#[derive(Debug, Serialize)]
pub struct ProfileMedia {
    #[serde(rename = "photoUrl")]
    pub photo_url: Option<String>,
    #[serde(rename = "coverUrl")]
    pub cover_url: Option<String>,
}

#[tauri::command]
pub async fn get_profile_media(state: State<'_, AppState>) -> Result<ProfileMedia, SocialError> {
    let token = social::ensure_sanctum_token(state.inner()).await?;
    let client = reqwest::Client::new();
    let (photo_url, cover_url) = social::fetch_profile_media(&client, &token).await?;
    Ok(ProfileMedia { photo_url, cover_url })
}

#[tauri::command]
pub async fn upload_profile_photo(
    state: State<'_, AppState>,
    file_bytes: Vec<u8>,
    file_name: String,
) -> Result<Option<String>, SocialError> {
    let token = social::ensure_sanctum_token(state.inner()).await?;
    let client = reqwest::Client::new();
    social::upload_profile_photo(&client, &token, file_bytes, &file_name)
        .await
        .map_err(SocialError::from)
}

#[tauri::command]
pub async fn remove_profile_photo(state: State<'_, AppState>) -> Result<(), SocialError> {
    let token = social::ensure_sanctum_token(state.inner()).await?;
    let client = reqwest::Client::new();
    social::remove_profile_photo(&client, &token).await.map_err(SocialError::from)
}

#[tauri::command]
pub async fn upload_profile_cover(
    state: State<'_, AppState>,
    file_bytes: Vec<u8>,
    file_name: String,
) -> Result<Option<String>, SocialError> {
    let token = social::ensure_sanctum_token(state.inner()).await?;
    let client = reqwest::Client::new();
    social::upload_profile_cover(&client, &token, file_bytes, &file_name)
        .await
        .map_err(SocialError::from)
}

#[tauri::command]
pub async fn remove_profile_cover(state: State<'_, AppState>) -> Result<(), SocialError> {
    let token = social::ensure_sanctum_token(state.inner()).await?;
    let client = reqwest::Client::new();
    social::remove_profile_cover(&client, &token).await.map_err(SocialError::from)
}
