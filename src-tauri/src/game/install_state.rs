//! Lokal gemerkter Installations-Stand. Ermöglicht einen schnellen
//! "Installieren/Update/Play"-Status ohne bei jedem Programmstart alle
//! Dateien neu zu hashen (das passiert nur beim tatsächlichen Installieren/
//! Aktualisieren in install.rs).

use crate::game::paths;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct InstallState {
    pub client_version: String,
    pub minecraft_version: String,
    pub fabric_loader_version: String,
    /// ID des gespeicherten Start-Profils (siehe install.rs / launch.rs),
    /// z. B. "fabric-loader-0.19.3-1.21.8".
    pub profile_id: String,
}

pub fn load() -> Option<InstallState> {
    let path = paths::install_state_file().ok()?;
    let data = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

pub fn save(state: &InstallState) -> Result<()> {
    let path = paths::install_state_file()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_string_pretty(state)?)?;
    Ok(())
}
