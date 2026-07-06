//! Tauri-Commands: Brücke zwischen React-Frontend und `news.rs`.

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct NewsError {
    pub message: String,
}

impl From<anyhow::Error> for NewsError {
    fn from(e: anyhow::Error) -> Self {
        NewsError {
            message: e.to_string(),
        }
    }
}

/// Liefert die neuesten Neuigkeiten von erzmark.de/news (inkl. kleiner
/// JPEG-Vorschaubilder als Data-URLs).
#[tauri::command]
pub async fn get_news(limit: Option<usize>) -> Result<Vec<crate::news::NewsPost>, NewsError> {
    let client = reqwest::Client::new();
    crate::news::fetch_latest(&client, limit.unwrap_or(6))
        .await
        .map_err(NewsError::from)
}

/// Öffnet einen externen Link (z. B. den vollen Neuigkeiten-Artikel) im
/// System-Standardbrowser statt im Launcher-Fenster selbst.
#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), NewsError> {
    open::that(url).map_err(|e| NewsError {
        message: e.to_string(),
    })
}
