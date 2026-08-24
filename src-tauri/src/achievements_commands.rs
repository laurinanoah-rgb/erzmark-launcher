//! Tauri-Commands: Brücke zwischen React-Frontend und `achievements.rs`.

use serde::Serialize;
use tauri::State;

use crate::achievements;
use crate::social;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct AchievementsError {
    pub message: String,
}

impl From<anyhow::Error> for AchievementsError {
    fn from(e: anyhow::Error) -> Self {
        AchievementsError {
            message: e.to_string(),
        }
    }
}

#[tauri::command]
pub async fn get_achievements(
    state: State<'_, AppState>,
) -> Result<Vec<achievements::AchievementEntry>, AchievementsError> {
    let token = social::ensure_sanctum_token(state.inner()).await?;
    let client = reqwest::Client::new();
    achievements::fetch_achievements(&client, &token)
        .await
        .map_err(AchievementsError::from)
}

#[tauri::command]
pub async fn get_achievement_stats(
    state: State<'_, AppState>,
) -> Result<achievements::AchievementStats, AchievementsError> {
    let token = social::ensure_sanctum_token(state.inner()).await?;
    let client = reqwest::Client::new();
    achievements::fetch_achievement_stats(&client, &token)
        .await
        .map_err(AchievementsError::from)
}

#[tauri::command]
pub async fn acknowledge_achievement(
    state: State<'_, AppState>,
    achievement_id: String,
) -> Result<(), AchievementsError> {
    let token = social::ensure_sanctum_token(state.inner()).await?;
    let client = reqwest::Client::new();
    achievements::acknowledge_achievement(&client, &token, &achievement_id)
        .await
        .map_err(AchievementsError::from)
}
