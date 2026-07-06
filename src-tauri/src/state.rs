use serde::{Deserialize, Serialize};
use std::sync::Mutex;

use crate::auth::minecraft::MinecraftProfile;

/// Vollständiger Login-Zustand: Microsoft-Tokens (für Refresh) + der daraus
/// abgeleitete Minecraft-Access-Token (für Spielstart & API-Calls) + Profil.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub ms_access_token: String,
    pub ms_refresh_token: String,
    pub ms_expires_at: i64,
    pub mc_access_token: String,
    pub mc_expires_at: i64,
    pub profile: MinecraftProfile,
}

#[derive(Default)]
pub struct AppState {
    pub session: Mutex<Option<Session>>,
}
