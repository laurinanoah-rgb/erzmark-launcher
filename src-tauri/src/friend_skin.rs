//! Löst die Skin-URL eines beliebigen Spielers (Freund) über Mojangs
//! öffentlichen Session-Server auf – anders als der eigene Skin (siehe
//! `auth/skin.rs`, kommt über die authentifizierte Minecraft-Services-API)
//! braucht das keinen Access-Token, nur die UUID. Genutzt vom "Sozialer
//! Modus" im Skin Mirror (Launcher-Update-TODO, Abschnitt 2).

use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct SessionProfileResponse {
    properties: Vec<SessionProfileProperty>,
}

#[derive(Debug, Deserialize)]
struct SessionProfileProperty {
    name: String,
    value: String,
}

#[derive(Debug, Deserialize)]
struct TexturesPayload {
    textures: TexturesBlock,
}

#[derive(Debug, Deserialize)]
struct TexturesBlock {
    #[serde(rename = "SKIN")]
    skin: Option<TextureEntry>,
}

#[derive(Debug, Deserialize)]
struct TextureEntry {
    url: String,
}

/// Liefert die Skin-Textur-URL für die übergebene Spieler-UUID, oder `None`,
/// falls der Spieler keinen eigenen Skin gesetzt hat (Default-Skin) oder
/// nicht existiert. `uuid` kann mit oder ohne Bindestriche übergeben werden.
pub async fn fetch_skin_url(client: &reqwest::Client, uuid: &str) -> Result<Option<String>> {
    let stripped = uuid.replace('-', "");

    let response = client
        .get(format!(
            "{}/{}",
            crate::config::MOJANG_SESSION_SERVER_PROFILE_URL,
            stripped
        ))
        .send()
        .await
        .context("Session-Server nicht erreichbar")?;

    if !response.status().is_success() {
        return Ok(None);
    }

    let profile: SessionProfileResponse = response
        .json()
        .await
        .context("Ungültige Antwort des Session-Servers")?;

    let Some(textures_prop) = profile.properties.iter().find(|p| p.name == "textures") else {
        return Ok(None);
    };

    let decoded = STANDARD
        .decode(&textures_prop.value)
        .context("Textur-Property konnte nicht dekodiert werden")?;
    let payload: TexturesPayload =
        serde_json::from_slice(&decoded).context("Textur-Property war kein gültiges JSON")?;

    // Gleiche http->https-Normalisierung wie bei der eigenen Skin-URL (siehe
    // `auth/skin.rs::active_skin_url`) – Mojang liefert hier ebenfalls oft
    // reines `http://textures.minecraft.net/...`.
    Ok(payload
        .textures
        .skin
        .map(|s| s.url.replacen("http://", "https://", 1)))
}
