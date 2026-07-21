//! Sammelt echte Diagnose-Infos für den Bug-Report-Button (Launcher-Update-
//! TODO, Abschnitt 6) - Log-Auszug, Launcher-/OS-Info. Screenshots werden
//! bewusst nicht hier dupliziert, das Frontend nutzt dafür weiterhin
//! `list_screenshots` (siehe `game_commands.rs`).
//!
//! Das eigentliche Absenden an ein Support-/Ticket-System ist NICHT Teil
//! dieses Moduls - dafür gibt es noch keine Backend-Anbindung (siehe
//! Launcher-Update-TODO, Abschnitt 6 "Support & Transparenz"). Diese Datei
//! liefert nur die Anhänge, die ein künftiger echter Versand-Endpunkt braucht.

use crate::game::paths;
use serde::Serialize;

const LOG_TAIL_LINES: usize = 200;

#[derive(Debug, Serialize)]
pub struct BugReportContext {
    pub launcher_version: String,
    pub os: String,
    pub arch: String,
    /// Letzte Zeilen von `logs/latest.log`, oder `None`, falls noch keine
    /// Log-Datei existiert (z. B. Spiel noch nie gestartet).
    pub log_tail: Option<String>,
}

pub fn collect() -> BugReportContext {
    BugReportContext {
        launcher_version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        log_tail: read_log_tail(),
    }
}

fn read_log_tail() -> Option<String> {
    let path = paths::launcher_root().ok()?.join("logs").join("latest.log");
    let content = std::fs::read_to_string(path).ok()?;
    let lines: Vec<&str> = content.lines().collect();
    let start = lines.len().saturating_sub(LOG_TAIL_LINES);
    Some(lines[start..].join("\n"))
}
