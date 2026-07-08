//! Tauri-Commands: Brücke zwischen React-Frontend und `profiles.rs`.

use serde::Serialize;
use tauri::State;

use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct ProfilesError {
    pub message: String,
}

impl From<anyhow::Error> for ProfilesError {
    fn from(e: anyhow::Error) -> Self {
        ProfilesError {
            message: e.to_string(),
        }
    }
}

/// Liefert die MMOCore-Klassen/-Profile des eingeloggten Spielers (aktive
/// Klasse + alle weiteren), gelesen über die read-only Spielstände-API auf
/// erzmark.de. Der Launcher hat dabei nie direkten Datenbankzugriff.
#[tauri::command]
pub async fn get_character_profiles(
    state: State<'_, AppState>,
) -> Result<Vec<crate::profiles::CharacterProfile>, ProfilesError> {
    let own_uuid = {
        let guard = state.session.lock().unwrap();
        guard
            .as_ref()
            .map(|s| s.profile.id.clone())
            .ok_or_else(|| ProfilesError {
                message: "Keine aktive Session – bitte zuerst einloggen".to_string(),
            })?
    };

    let client = reqwest::Client::new();
    crate::profiles::fetch_profiles(&client, &own_uuid)
        .await
        .map_err(ProfilesError::from)
}
