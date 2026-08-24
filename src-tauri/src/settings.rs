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

    /// Manuelles Override fürs Performance-Stufensystem (Launcher-Update-TODO
    /// Abschnitt 1, "Manuelles Override in den Settings"): `"auto"`, `"full"`
    /// oder `"reduced"`. `"auto"` (Default) lässt `performanceTier.js` weiter
    /// per Geräte-Heuristik entscheiden. Wird zusätzlich clientseitig in
    /// localStorage gespiegelt (siehe `performanceTier.js`), da der Tier
    /// synchron beim ersten Render gebraucht wird.
    #[serde(default = "default_perf_tier_override")]
    pub performance_tier_override: String,

    /// Anzeigeprofil des Launchers: `"auto"`, `"16:9"` oder `"21:9"`.
    /// Im Automatikmodus entscheidet die Web-Oberflaeche anhand von Fenster-
    /// und Monitorformat. Die Defaults halten alte settings.json kompatibel.
    #[serde(default = "default_display_preset")]
    pub display_preset: String,
    #[serde(default = "default_ui_scale")]
    pub ui_scale: String,
    #[serde(default = "default_text_scale")]
    pub text_scale: String,
    #[serde(default)]
    pub high_contrast: bool,
    #[serde(default)]
    pub reduce_motion: bool,

    /// Living-Hall-Atmosphäre. Alle Felder haben Defaults, damit vorhandene
    /// settings.json-Dateien ohne Migration weiter funktionieren.
    #[serde(default = "default_true")]
    pub atmosphere_enabled: bool,
    #[serde(default)]
    pub ambient_sound: bool,
    #[serde(default = "default_ambient_volume")]
    pub ambient_volume: u8,
    #[serde(default = "default_true")]
    pub cursor_runes: bool,
}

fn default_perf_tier_override() -> String {
    "auto".to_string()
}

fn default_true() -> bool {
    true
}

fn default_display_preset() -> String {
    "auto".to_string()
}

fn default_ui_scale() -> String {
    "normal".to_string()
}

fn default_text_scale() -> String {
    "normal".to_string()
}

fn default_ambient_volume() -> u8 {
    32
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
            performance_tier_override: default_perf_tier_override(),
            display_preset: default_display_preset(),
            ui_scale: default_ui_scale(),
            text_scale: default_text_scale(),
            high_contrast: false,
            reduce_motion: false,
            atmosphere_enabled: true,
            ambient_sound: false,
            ambient_volume: default_ambient_volume(),
            cursor_runes: true,
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
