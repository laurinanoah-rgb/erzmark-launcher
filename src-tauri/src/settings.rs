//! Persistente Launcher-Einstellungen (RAM-Zuweisung, FOV-Sperre etc.),
//! gespeichert unter `<launcher_root>/settings.json`. Getrennt vom
//! Installations-Status (`game::install_state`), da hier reine
//! Nutzer-Präferenzen liegen statt Angaben über den installierten Client.

use crate::game::paths;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherSettings {
    pub memory_min_mb: u32,
    pub memory_max_mb: u32,
    /// Setzt das FOV vor jedem Spielstart zwangsweise auf 70 zurück (siehe
    /// `game::launch::apply_fov_lock`) – für ein einheitliches Spielerlebnis
    /// auf Erzmark.
    pub lock_fov: bool,
}

impl Default for LauncherSettings {
    fn default() -> Self {
        Self {
            memory_min_mb: 1024,
            memory_max_mb: 4096,
            lock_fov: true,
        }
    }
}

fn settings_file() -> Result<PathBuf> {
    Ok(paths::launcher_root()?.join("settings.json"))
}

/// Lädt die Einstellungen, oder liefert die Standardwerte, falls noch keine
/// gespeichert wurden oder die Datei beschädigt ist (bewusst fehlertolerant –
/// eine kaputte settings.json soll den Launcher nie am Start hindern).
pub fn load() -> LauncherSettings {
    settings_file()
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(settings: &LauncherSettings) -> Result<()> {
    let path = settings_file()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_string_pretty(settings)?)?;
    Ok(())
}
