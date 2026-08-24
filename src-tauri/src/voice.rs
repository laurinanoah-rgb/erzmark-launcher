//! Echte Voice-Presence der Freunde (23.08.2026) - liefert, wer von den
//! Freunden des eingeloggten Users laut R.U.D.O.L.F. (Discord-Bot) gerade in
//! einem Voice-Channel ist. Genau wie `social.rs` Sanctum-authentifiziert
//! (gleicher `ensure_sanctum_token`-Unterbau), da der Endpoint personalisiert
//! ist (nur Freunde des eingeloggten Users).
//!
//! WICHTIG: Der Launcher nimmt selbst NICHT aktiv an Voice-Chats teil (kein
//! Audio/WebRTC) - dieser Endpoint liefert nur Anzeige-Daten (wer ist wo,
//! Mute-/Deafen-Status), siehe TalkContext.jsx für die Verwendung.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use crate::config;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct VoicePresenceEntry {
    pub uuid: String,
    #[serde(rename = "channelId")]
    pub channel_id: String,
    #[serde(rename = "channelName")]
    pub channel_name: String,
    #[serde(rename = "micMuted")]
    pub mic_muted: bool,
    pub deafened: bool,
    #[serde(rename = "joinedAt")]
    pub joined_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VoicePresenceResponse {
    presences: Vec<VoicePresenceEntry>,
}

/// Holt die Voice-Presence der Freunde des eingeloggten Users (leere Liste,
/// wenn gerade niemand von ihnen im Voice ist).
pub async fn fetch_voice_presence(
    client: &reqwest::Client,
    sanctum_token: &str,
) -> Result<Vec<VoicePresenceEntry>> {
    let resp = client
        .get(config::ERZMARK_VOICE_PRESENCE_URL)
        .bearer_auth(sanctum_token)
        .send()
        .await
        .context("Voice-Presence nicht erreichbar (Netzwerk?)")?;

    if !resp.status().is_success() {
        anyhow::bail!("Voice-Presence-Abruf fehlgeschlagen ({})", resp.status());
    }

    let parsed: VoicePresenceResponse = resp
        .json()
        .await
        .context("Ungültige Antwort beim Abruf der Voice-Presence")?;

    Ok(parsed.presences)
}
