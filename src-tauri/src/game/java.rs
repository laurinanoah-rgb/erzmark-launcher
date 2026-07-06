//! Java-Runtime-Beschaffung über dieselbe offizielle Quelle, die auch der
//! Mojang-Launcher nutzt (launchermeta.mojang.com) – kein Java-Fremddownload
//! nötig, keine Java-Installation durch den Spieler erforderlich.

use crate::config;
use crate::game::{downloader, paths};
use anyhow::{Context, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
struct RuntimeIndex {
    #[serde(flatten)]
    platforms: HashMap<String, HashMap<String, Vec<RuntimeAvailability>>>,
}

#[derive(Debug, Deserialize)]
struct RuntimeAvailability {
    manifest: RuntimeManifestRef,
}

#[derive(Debug, Deserialize)]
struct RuntimeManifestRef {
    url: String,
}

#[derive(Debug, Deserialize)]
struct RuntimeManifest {
    files: HashMap<String, RuntimeFileEntry>,
}

#[derive(Debug, Deserialize)]
struct RuntimeFileEntry {
    #[serde(rename = "type")]
    kind: String,
    downloads: Option<RuntimeFileDownloads>,
    executable: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct RuntimeFileDownloads {
    raw: RuntimeRawDownload,
}

#[derive(Debug, Deserialize)]
struct RuntimeRawDownload {
    sha1: String,
    size: u64,
    url: String,
}

fn current_platform_key() -> &'static str {
    if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        "windows-x64"
    } else if cfg!(all(target_os = "windows", target_arch = "aarch64")) {
        "windows-arm64"
    } else if cfg!(target_os = "windows") {
        "windows-x86"
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        "mac-os-arm64"
    } else if cfg!(target_os = "macos") {
        "mac-os"
    } else {
        "linux"
    }
}

pub fn java_executable_path(component: &str) -> Result<PathBuf> {
    let dir = paths::java_component_dir(component)?;
    #[cfg(target_os = "windows")]
    {
        Ok(dir.join("bin").join("javaw.exe"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(dir.join("bin").join("java"))
    }
}

/// Callback-Signatur für Fortschrittsmeldungen: (fertige Dateien, Dateien gesamt).
pub type ProgressFn<'a> = dyn Fn(u64, u64) + Send + Sync + 'a;

/// Stellt sicher, dass die angeforderte Java-Runtime-Komponente (z. B.
/// "java-runtime-delta", kommt aus der Vanilla-Versions-JSON) lokal vorhanden
/// ist, und gibt den Pfad zur ausführbaren Java-Datei zurück. Lädt bei Bedarf
/// einmalig herunter.
pub async fn ensure_java(
    client: &reqwest::Client,
    component: &str,
    on_progress: &ProgressFn<'_>,
) -> Result<PathBuf> {
    let java_exe = java_executable_path(component)?;
    if java_exe.exists() {
        on_progress(1, 1);
        return Ok(java_exe);
    }

    let index: RuntimeIndex = client
        .get(config::JAVA_RUNTIME_INDEX_URL)
        .send()
        .await
        .context("Abruf des Java-Runtime-Index fehlgeschlagen")?
        .json()
        .await
        .context("Ungültiger Java-Runtime-Index")?;

    let platform = index
        .platforms
        .get(current_platform_key())
        .with_context(|| format!("Keine Java-Runtime für Plattform {} verfügbar", current_platform_key()))?;
    let entries = platform
        .get(component)
        .with_context(|| format!("Java-Runtime-Komponente '{component}' nicht gefunden"))?;
    let entry = entries
        .first()
        .context("Keine verfügbare Java-Runtime-Version für diese Komponente")?;

    let manifest: RuntimeManifest = client
        .get(&entry.manifest.url)
        .send()
        .await
        .context("Abruf des Java-Runtime-Manifests fehlgeschlagen")?
        .json()
        .await
        .context("Ungültiges Java-Runtime-Manifest")?;

    let target_dir = paths::java_component_dir(component)?;
    std::fs::create_dir_all(&target_dir).context("Konnte Java-Runtime-Ordner nicht anlegen")?;

    let total_files = manifest
        .files
        .values()
        .filter(|f| f.kind == "file")
        .count() as u64;
    let mut done: u64 = 0;

    for (rel_path, file) in &manifest.files {
        let dest = target_dir.join(rel_path);
        match file.kind.as_str() {
            "directory" => {
                std::fs::create_dir_all(&dest).ok();
            }
            "file" => {
                if let Some(downloads) = &file.downloads {
                    downloader::download_if_needed(
                        client,
                        &downloads.raw.url,
                        &dest,
                        Some(downloads.raw.size),
                        downloader::Checksum::Sha1(&downloads.raw.sha1),
                    )
                    .await
                    .with_context(|| format!("Java-Runtime-Datei fehlgeschlagen: {rel_path}"))?;

                    #[cfg(unix)]
                    if file.executable.unwrap_or(false) {
                        use std::os::unix::fs::PermissionsExt;
                        if let Ok(meta) = std::fs::metadata(&dest) {
                            let mut perms = meta.permissions();
                            perms.set_mode(0o755);
                            let _ = std::fs::set_permissions(&dest, perms);
                        }
                    }
                }
                done += 1;
                on_progress(done, total_files);
            }
            _ => { /* "link" – auf Windows nicht relevant, überspringen */ }
        }
    }

    if !java_exe.exists() {
        anyhow::bail!(
            "Java-Runtime wurde heruntergeladen, aber {} wurde nicht gefunden – Runtime-Layout hat sich evtl. geändert",
            java_exe.display()
        );
    }

    Ok(java_exe)
}
