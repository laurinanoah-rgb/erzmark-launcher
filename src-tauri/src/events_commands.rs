//! Tauri-Command für den Boss-Event-Countdown.

#[tauri::command]
pub async fn get_boss_event() -> crate::events::BossEvent {
    let client = reqwest::Client::new();
    crate::events::fetch(&client).await
}
