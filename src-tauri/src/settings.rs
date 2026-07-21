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

    // Granulare Benachrichtigungs-Einstellungen (Launcher-Update-TODO,
    // Abschnitt 6) – bewusst nur für Fälle, die einen echten, abschaltbaren
    // "Benachrichtigungs-Moment" haben (Glocke/Lichtschein/Sound). Boss-Event-
    // Countdown und Update-Banner sind dauerhafte Status-Anzeigen bzw. ein
    // nötiger Handlungsaufruf, kein optionaler Hinweis – die würde man durch
    // Ausblenden eher verwirren als entlasten, deshalb keine Toggles dafür.
    //
    // `#[serde(default)]` ist hier wichtig, da bestehende, bereits auf
    // Nutzer-Rechnern gespeicherte `settings.json`-Dateien diese Felder noch
    // nicht enthalten – ohne Default würde `load()` bei ihnen fehlschlagen
    // und (siehe `load()`) still auf alle Standardwerte zurückfallen,
    // inklusive der bereits gespeicherten Werte oben.
    #[serde(default = "default_true")]
    pub notify_friend_requests: bool,
    #[serde(default = "default_true")]
    pub notify_achievements: bool,
    #[serde(default)]
    pub mute_ui_sounds: bool,
}

fn default_true() -> bool {
    true
}

impl Default for LauncherSettings {
    fn default() -> Self {
        Self {
            memory_min_mb: 1024,
            memory_max_mb: 4096,
            lock_fov: true,
            notify_friend_requests: true,
            notify_achievements: true,
            mute_ui_sounds: false,
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
