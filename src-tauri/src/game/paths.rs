//! Verzeichnislayout für alles, was der Launcher selbst herunterlädt und
//! verwaltet (getrennt vom offiziellen Mojang-Launcher, damit sich beide
//! nicht in die Quere kommen).
//!
//! ```text
//! <launcher_root>/
//! ├── game/
//! │   ├── versions/<mcVersion>/<mcVersion>.json   (Vanilla-Versions-JSON, roh gespeichert)
//! │   │                        <mcVersion>.jar    (Client-Jar)
//! │   │                        natives/           (entpackte .dll)
//! │   ├── versions/<profileId>/profile.json        (fertig zusammengebautes Start-Profil, s. install.rs)
//! │   ├── libraries/...                            (Vanilla- + Fabric-Libraries, Maven-Layout)
//! │   ├── assets/indexes/<id>.json
//! │   ├── assets/objects/<xx>/<hash>
//! │   ├── mods/, config/, resourcepacks/ ...        (Erzmark-Dateien aus manifest.json)
//! ├── java/<component>/...                          (Java-Runtime, z. B. java-runtime-delta)
//! └── install_state.json                             (lokal gemerkter Installations-Stand)
//! ```

use anyhow::{Context, Result};
use std::path::PathBuf;

pub fn launcher_root() -> Result<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let base = std::env::var_os("APPDATA").context("APPDATA-Umgebungsvariable nicht gesetzt")?;
        return Ok(PathBuf::from(base).join("ErzmarkLauncher"));
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var_os("HOME").context("HOME nicht gesetzt")?;
        return Ok(PathBuf::from(home).join("Library/Application Support/ErzmarkLauncher"));
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Some(xdg) = std::env::var_os("XDG_DATA_HOME") {
            return Ok(PathBuf::from(xdg).join("ErzmarkLauncher"));
        }
        let home = std::env::var_os("HOME").context("HOME nicht gesetzt")?;
        return Ok(PathBuf::from(home).join(".local/share/ErzmarkLauncher"));
    }
}

pub fn game_dir() -> Result<PathBuf> {
    Ok(launcher_root()?.join("game"))
}

pub fn versions_dir() -> Result<PathBuf> {
    Ok(game_dir()?.join("versions"))
}

pub fn version_dir(version_id: &str) -> Result<PathBuf> {
    Ok(versions_dir()?.join(version_id))
}

pub fn natives_dir(version_id: &str) -> Result<PathBuf> {
    Ok(version_dir(version_id)?.join("natives"))
}

pub fn libraries_dir() -> Result<PathBuf> {
    Ok(game_dir()?.join("libraries"))
}

pub fn assets_dir() -> Result<PathBuf> {
    Ok(game_dir()?.join("assets"))
}

pub fn asset_index_file(asset_index_id: &str) -> Result<PathBuf> {
    Ok(assets_dir()?.join("indexes").join(format!("{asset_index_id}.json")))
}

pub fn asset_object_file(hash: &str) -> Result<PathBuf> {
    Ok(assets_dir()?.join("objects").join(&hash[0..2]).join(hash))
}

pub fn java_root() -> Result<PathBuf> {
    Ok(launcher_root()?.join("java"))
}

pub fn java_component_dir(component: &str) -> Result<PathBuf> {
    Ok(java_root()?.join(component))
}

pub fn install_state_file() -> Result<PathBuf> {
    Ok(launcher_root()?.join("install_state.json"))
}

pub fn profile_file(profile_id: &str) -> Result<PathBuf> {
    Ok(version_dir(profile_id)?.join("profile.json"))
}
