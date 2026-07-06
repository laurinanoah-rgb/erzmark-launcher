//! Screenshot-Galerie: liest die von Minecraft automatisch gespeicherten
//! Screenshots (Standard-Ordner `<Spielordner>/screenshots/*.png`, Taste F2
//! im Spiel) und erzeugt kleine JPEG-Vorschaubilder als Data-URLs, damit das
//! Frontend sie direkt anzeigen kann, ohne Tauris Asset-Protokoll/Scope
//! konfigurieren zu müssen. Rein lokal, kein Server-Backend nötig.

use crate::game::paths;
use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug, Clone, Serialize)]
pub struct ScreenshotEntry {
    pub filename: String,
    /// Unix-Zeitstempel (Sekunden) – fürs Anzeigen/Sortieren im Frontend.
    pub taken_at: i64,
    pub thumbnail_data_url: String,
}

pub fn screenshots_dir() -> Result<PathBuf> {
    Ok(paths::game_dir()?.join("screenshots"))
}

/// Liest die `limit` neuesten Screenshots und erzeugt jeweils ein kleines
/// JPEG-Vorschaubild. Beschädigte/unlesbare Bilder werden übersprungen statt
/// die ganze Liste scheitern zu lassen. Gibt eine leere Liste zurück, wenn
/// der Ordner (noch) nicht existiert (z. B. vor dem ersten Spielstart).
pub fn list_recent(limit: usize) -> Result<Vec<ScreenshotEntry>> {
    let dir = screenshots_dir()?;
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut entries: Vec<(PathBuf, i64)> = std::fs::read_dir(&dir)
        .context("Konnte Screenshot-Ordner nicht lesen")?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("png"))
                .unwrap_or(false)
        })
        .filter_map(|e| {
            let modified = e.metadata().ok()?.modified().ok()?;
            let secs = modified.duration_since(UNIX_EPOCH).ok()?.as_secs() as i64;
            Some((e.path(), secs))
        })
        .collect();

    entries.sort_by(|a, b| b.1.cmp(&a.1));
    entries.truncate(limit);

    let mut result = Vec::with_capacity(entries.len());
    for (path, taken_at) in entries {
        let Some(filename) = path.file_name().map(|f| f.to_string_lossy().to_string()) else {
            continue;
        };
        if let Ok(data_url) = make_thumbnail(&path) {
            result.push(ScreenshotEntry {
                filename,
                taken_at,
                thumbnail_data_url: data_url,
            });
        }
    }

    Ok(result)
}

fn make_thumbnail(path: &Path) -> Result<String> {
    let img = image::open(path).context("Konnte Screenshot nicht öffnen")?;
    // JPEG kennt keinen Alpha-Kanal -> explizit auf RGB konvertieren, sonst
    // schlägt das Kodieren fehl.
    let thumb = image::DynamicImage::ImageRgb8(img.thumbnail(320, 200).to_rgb8());

    let mut buf = Vec::new();
    thumb
        .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Jpeg)
        .context("Konnte Vorschaubild nicht kodieren")?;

    let encoded = STANDARD.encode(&buf);
    Ok(format!("data:image/jpeg;base64,{encoded}"))
}

/// Öffnet den echten Screenshot-Ordner im Datei-Explorer des Betriebssystems.
pub fn open_folder() -> Result<()> {
    let dir = screenshots_dir()?;
    std::fs::create_dir_all(&dir).ok();
    open::that(dir).context("Konnte Screenshot-Ordner nicht öffnen")?;
    Ok(())
}

/// Öffnet einen einzelnen Screenshot in Originalgröße mit dem
/// Standard-Bildbetrachter des Betriebssystems.
pub fn open_file(filename: &str) -> Result<()> {
    let path = screenshots_dir()?.join(filename);
    if !path.exists() {
        anyhow::bail!("Screenshot nicht gefunden: {filename}");
    }
    open::that(path).context("Konnte Screenshot nicht öffnen")?;
    Ok(())
}
