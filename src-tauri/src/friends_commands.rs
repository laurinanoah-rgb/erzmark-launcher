//! Tauri-Commands: Brücke zwischen React-Frontend und `friends.rs`.

use serde::Serialize;
use tauri::State;

use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct FriendsError {
    pub message: String,
}

impl From<anyhow::Error> for FriendsError {
    fn from(e: anyhow::Error) -> Self {
        FriendsError {
            message: e.to_string(),
        }
    }
}

/// Liefert die Freundesliste des eingeloggten Spielers (Name + Online-Status),
/// gelesen über die read-only Freunde-API auf erzmark.de. Der Launcher hat
/// dabei nie direkten Datenbankzugriff.
#[tauri::command]
pub async fn get_friends(
    state: State<'_, AppState>,
) -> Result<Vec<crate::friends::FriendEntry>, FriendsError> {
    let own_uuid = {
        let guard = state.session.lock().unwrap();
        guard
            .as_ref()
            .map(|s| s.profile.id.clone())
            .ok_or_else(|| FriendsError {
                message: "Keine aktive Session – bitte zuerst einloggen".to_string(),
            })?
    };

    let client = reqwest::Client::new();
    crate::friends::fetch_friends(&client, &own_uuid)
        .await
        .map_err(FriendsError::from)
}
