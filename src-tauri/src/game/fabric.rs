//! Fabric-Loader-Metadaten (meta.fabricmc.net) – kommt zusätzlich zum
//! Vanilla-Client oben drauf, kein eigener Login/Auth nötig.

use crate::config;
use anyhow::{Context, Result};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct FabricLoaderEntry {
    pub loader: FabricComponentRef,
    pub intermediary: FabricComponentRef,
    #[serde(rename = "launcherMeta")]
    pub launcher_meta: FabricLauncherMeta,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FabricComponentRef {
    pub version: String,
    pub maven: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FabricLauncherMeta {
    pub libraries: FabricLibraries,
    #[serde(rename = "mainClass")]
    pub main_class: FabricMainClass,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FabricLibraries {
    #[serde(default)]
    pub client: Vec<FabricLibrary>,
    #[serde(default)]
    pub common: Vec<FabricLibrary>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FabricLibrary {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FabricMainClass {
    pub client: String,
}

/// Lädt die Metadaten für einen konkreten Fabric-Loader-Build zu einer
/// bestimmten Minecraft-Version. Endpoint liefert bei exakter Versionsangabe
/// ein einzelnes Objekt (nicht die Liste aller Builds).
pub async fn fetch_loader_entry(
    client: &reqwest::Client,
    mc_version: &str,
    loader_version: &str,
) -> Result<FabricLoaderEntry> {
    let url = format!("{}/{mc_version}/{loader_version}", config::FABRIC_META_LOADER_BASE);
    client
        .get(&url)
        .send()
        .await
        .with_context(|| format!("Fabric-Meta-Abruf fehlgeschlagen: {url}"))?
        .json()
        .await
        .with_context(|| format!("Ungültige Fabric-Meta-Antwort ({url}) – Loader-Version {loader_version} für MC {mc_version} evtl. nicht vorhanden"))
}

/// Wandelt eine Maven-Koordinate ("group:artifact:version") in einen
/// relativen Dateipfad um, z. B.
/// "net.fabricmc:fabric-loader:0.19.3" -> "net/fabricmc/fabric-loader/0.19.3/fabric-loader-0.19.3.jar"
pub fn maven_to_path(coordinate: &str) -> Option<String> {
    let parts: Vec<&str> = coordinate.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let (group, artifact, version) = (parts[0], parts[1], parts[2]);
    let group_path = group.replace('.', "/");
    Some(format!("{group_path}/{artifact}/{version}/{artifact}-{version}.jar"))
}
