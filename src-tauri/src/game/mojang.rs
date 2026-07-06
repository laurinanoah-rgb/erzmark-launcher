//! Öffentliche Mojang-APIs (kein Login nötig): Versions-Manifest, Versions-
//! JSON, Libraries, Asset-Index. Diese Daten beschreiben den kompletten
//! Vanilla-Minecraft-Client – Fabric kommt in fabric.rs oben drauf.

use crate::config;
use anyhow::{Context, Result};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct VersionManifest {
    pub versions: Vec<VersionManifestEntry>,
}

#[derive(Debug, Deserialize)]
pub struct VersionManifestEntry {
    pub id: String,
    pub url: String,
}

pub async fn fetch_version_manifest(client: &reqwest::Client) -> Result<VersionManifest> {
    client
        .get(config::MOJANG_VERSION_MANIFEST_URL)
        .send()
        .await
        .context("Abruf des Mojang-Versions-Manifests fehlgeschlagen")?
        .json()
        .await
        .context("Ungültiges Mojang-Versions-Manifest")
}

pub fn find_version_url(manifest: &VersionManifest, version_id: &str) -> Result<String> {
    manifest
        .versions
        .iter()
        .find(|v| v.id == version_id)
        .map(|v| v.url.clone())
        .ok_or_else(|| anyhow::anyhow!("Minecraft-Version {version_id} nicht im Mojang-Manifest gefunden"))
}

#[derive(Debug, Clone, Deserialize)]
pub struct VersionInfo {
    pub id: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndexRef,
    pub assets: String,
    pub downloads: VersionDownloads,
    pub libraries: Vec<Library>,
    pub arguments: Option<Arguments>,
    #[serde(rename = "javaVersion")]
    pub java_version: Option<JavaVersionRef>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct JavaVersionRef {
    pub component: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssetIndexRef {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct VersionDownloads {
    pub client: DownloadEntry,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DownloadEntry {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Library {
    pub name: String,
    pub downloads: Option<LibraryDownloads>,
    pub rules: Option<Vec<Value>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LibraryDownloads {
    pub artifact: Option<Artifact>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Artifact {
    pub path: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Arguments {
    pub game: Vec<Value>,
    pub jvm: Vec<Value>,
}

pub async fn fetch_version_info(client: &reqwest::Client, url: &str) -> Result<VersionInfo> {
    client
        .get(url)
        .send()
        .await
        .context("Abruf der Versions-JSON fehlgeschlagen")?
        .json()
        .await
        .context("Ungültige Versions-JSON")
}

pub fn current_os_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    }
}

/// Wertet eine Mojang-typische Rules-Liste aus (Libraries UND
/// JVM-/Game-Argumente teilen sich dieses Format:
/// `[{"action":"allow"|"disallow","os":{"name":...},"features":{...}}]`).
/// Fehlt die Liste, gilt der Eintrag als immer erlaubt. "features"-Bedingungen
/// (z. B. `is_demo_user`, `has_custom_resolution`) unterstützen wir nicht und
/// werten solche Einträge daher als nicht zutreffend.
pub fn rules_allow(rules: &Option<Vec<Value>>) -> bool {
    let Some(rules) = rules else { return true };
    let mut allowed = false;
    for rule in rules {
        let action = rule.get("action").and_then(|v| v.as_str()).unwrap_or("allow");
        let os_ok = match rule.get("os") {
            Some(os) => os
                .get("name")
                .and_then(|v| v.as_str())
                .map(|n| n == current_os_name())
                .unwrap_or(true),
            None => true,
        };
        let features_ok = rule.get("features").is_none();
        if os_ok && features_ok {
            allowed = action == "allow";
        }
    }
    allowed
}

#[derive(Debug, Deserialize)]
pub struct AssetIndex {
    pub objects: HashMap<String, AssetObject>,
}

#[derive(Debug, Deserialize)]
pub struct AssetObject {
    pub hash: String,
    pub size: u64,
}

pub async fn fetch_asset_index(client: &reqwest::Client, url: &str) -> Result<AssetIndex> {
    client
        .get(url)
        .send()
        .await
        .context("Abruf des Asset-Index fehlgeschlagen")?
        .json()
        .await
        .context("Ungültiger Asset-Index")
}
