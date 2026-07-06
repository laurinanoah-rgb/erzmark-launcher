//! Erzmark-eigenes Update-Manifest (erzmark.de/launcher/manifest.json).
//! Bestimmt, welche Minecraft-/Fabric-Version aktuell ist und welche
//! zusätzlichen Erzmark-Dateien (Mods/Config/Resourcepack) installiert sein
//! müssen. Siehe PLANNING.md Abschnitt 1 für das Hosting-Layout.

use crate::config;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ErzmarkManifest {
    #[serde(rename = "clientVersion")]
    pub client_version: String,
    #[serde(rename = "minecraftVersion")]
    pub minecraft_version: String,
    #[serde(rename = "fabricLoaderVersion")]
    pub fabric_loader_version: String,
    #[serde(rename = "updateVideoUrl")]
    pub update_video_url: Option<String>,
    #[serde(default)]
    pub files: Vec<ErzmarkFile>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ErzmarkFile {
    pub path: String,
    pub url: String,
    pub sha256: String,
    pub size: u64,
    #[serde(rename = "type")]
    pub kind: String,
}

/// Lädt das aktuelle Manifest von erzmark.de. Cache-Busting per
/// Zeitstempel-Query, damit ein frisch veröffentlichtes Update sofort
/// erkannt wird, auch wenn zwischen Server und Client noch ein CDN/Proxy mit
/// Caching sitzt.
pub async fn fetch_manifest(client: &reqwest::Client) -> Result<ErzmarkManifest> {
    let cache_bust = chrono::Utc::now().timestamp();
    let url = format!("{}?_={cache_bust}", config::ERZMARK_MANIFEST_URL);

    let resp = client
        .get(&url)
        .send()
        .await
        .context("Erzmark-Manifest nicht erreichbar (ist erzmark.de online?)")?;

    if !resp.status().is_success() {
        anyhow::bail!("Erzmark-Manifest antwortete mit HTTP {}", resp.status());
    }

    resp.json()
        .await
        .context("Erzmark-Manifest hat ein ungültiges Format (JSON-Schema prüfen)")
}
