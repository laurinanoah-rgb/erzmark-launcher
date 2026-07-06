//! Generischer Datei-Download mit Prüfsummen-Verifikation (SHA-1 für Mojang-/
//! Fabric-Dateien, SHA-256 für Erzmark-eigene Manifest-Dateien). Bereits
//! vorhandene, korrekte Dateien werden nicht erneut heruntergeladen – das
//! macht Updates schnell (nur geänderte Dateien werden übertragen).

use anyhow::{Context, Result};
use sha1::{Digest as _, Sha1};
use sha2::Sha256;
use std::path::Path;

pub enum Checksum<'a> {
    Sha1(&'a str),
    Sha256(&'a str),
    None,
}

fn hex_matches(bytes: &[u8], expected_hex: &str) -> bool {
    let actual: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    actual.eq_ignore_ascii_case(expected_hex.trim())
}

fn hash_matches(bytes: &[u8], checksum: &Checksum) -> bool {
    match checksum {
        Checksum::Sha1(expected) => {
            let mut hasher = Sha1::new();
            hasher.update(bytes);
            hex_matches(&hasher.finalize(), expected)
        }
        Checksum::Sha256(expected) => {
            let mut hasher = Sha256::new();
            hasher.update(bytes);
            hex_matches(&hasher.finalize(), expected)
        }
        Checksum::None => true,
    }
}

/// Prüft, ob eine bereits vorhandene lokale Datei dem erwarteten Hash (und
/// optional der erwarteten Größe als billiger Vorab-Check) entspricht.
pub fn file_matches(path: &Path, expected_size: Option<u64>, checksum: &Checksum) -> bool {
    let Ok(meta) = std::fs::metadata(path) else {
        return false;
    };
    if !meta.is_file() {
        return false;
    }
    if let Some(size) = expected_size {
        if meta.len() != size {
            return false;
        }
    }
    let Ok(bytes) = std::fs::read(path) else {
        return false;
    };
    hash_matches(&bytes, checksum)
}

/// Lädt eine Datei herunter (falls nicht schon korrekt lokal vorhanden) und
/// schreibt sie an den Zielpfad. Gibt `true` zurück, wenn tatsächlich
/// heruntergeladen wurde (für Fortschrittsanzeigen "X von Y Dateien neu").
pub async fn download_if_needed(
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
    expected_size: Option<u64>,
    checksum: Checksum<'_>,
) -> Result<bool> {
    if file_matches(dest, expected_size, &checksum) {
        return Ok(false);
    }

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("Konnte Ordner nicht anlegen: {}", parent.display()))?;
    }

    let resp = client
        .get(url)
        .send()
        .await
        .with_context(|| format!("Download fehlgeschlagen: {url}"))?;
    if !resp.status().is_success() {
        anyhow::bail!("Download von {url} fehlgeschlagen: HTTP {}", resp.status());
    }
    let bytes = resp
        .bytes()
        .await
        .with_context(|| format!("Konnte Antwort nicht lesen: {url}"))?;

    if !hash_matches(&bytes, &checksum) {
        anyhow::bail!("Prüfsumme stimmt nicht überein für {url} – Download beschädigt oder Manifest veraltet");
    }

    std::fs::write(dest, &bytes)
        .with_context(|| format!("Konnte Datei nicht schreiben: {}", dest.display()))?;
    Ok(true)
}
