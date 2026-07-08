//! Orchestriert das komplette Installieren/Aktualisieren: Erzmark-Manifest ->
//! Vanilla-Minecraft (Mojang) -> Fabric-Loader -> Java-Runtime -> Erzmark-
//! eigene Dateien. Baut am Ende ein fertiges Start-Profil (siehe launch.rs),
//! damit der eigentliche Spielstart später ganz ohne erneute Netzwerk-Calls
//! auskommt.

use crate::game::launch::LaunchProfile;
use crate::game::{downloader, fabric, install_state, java, manifest, mojang, paths};
use anyhow::{Context, Result};
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct InstallProgress {
    pub phase: String,
    pub label: String,
    pub current: u64,
    pub total: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlayStatus {
    pub state: String, // "not_installed" | "update_available" | "ready" | "error"
    pub installed_client_version: Option<String>,
    pub latest_client_version: Option<String>,
    pub minecraft_version: Option<String>,
    pub error: Option<String>,
}

/// Schneller Status-Check für die Install/Update/Play-Anzeige im Frontend.
/// Vergleicht nur Versionsnummern (kein Datei-Hashing) – die eigentliche
/// Verifikation jeder einzelnen Datei passiert erst beim echten Installieren.
pub async fn check_status(client: &reqwest::Client) -> PlayStatus {
    let local = install_state::load();

    match manifest::fetch_manifest(client).await {
        Ok(remote) => {
            let profile_exists = local
                .as_ref()
                .and_then(|l| paths::profile_file(&l.profile_id).ok())
                .map(|p| p.exists())
                .unwrap_or(false);

            let state = match &local {
                None => "not_installed",
                Some(l) if l.client_version != remote.client_version => "update_available",
                Some(_) if !profile_exists => "update_available",
                Some(_) => "ready",
            };

            PlayStatus {
                state: state.to_string(),
                installed_client_version: local.map(|l| l.client_version),
                latest_client_version: Some(remote.client_version),
                minecraft_version: Some(remote.minecraft_version),
                error: None,
            }
        }
        Err(e) => match local {
            // Server/Netz nicht erreichbar, aber schon installiert -> offline
            // trotzdem spielbar lassen statt zu blockieren.
            Some(l) => PlayStatus {
                state: "ready".to_string(),
                installed_client_version: Some(l.client_version.clone()),
                latest_client_version: Some(l.client_version),
                minecraft_version: Some(l.minecraft_version),
                error: None,
            },
            None => PlayStatus {
                state: "error".to_string(),
                installed_client_version: None,
                latest_client_version: None,
                minecraft_version: None,
                error: Some(e.to_string()),
            },
        },
    }
}

/// Vanilla- und Fabric-Libraries überschneiden sich manchmal in denselben
/// Maven-Koordinaten (z. B. `org.ow2.asm:asm`), aber mit unterschiedlichen
/// Versionen. Landen beide Jars auf dem Klassenpfad, verweigert Fabrics
/// Knot-Classloader den Start ("duplicate ASM classes found on classpath").
/// Deshalb hier pro Koordinate (Gruppe:Artefakt, ohne Version) nur die jeweils
/// höchste Version behalten – Fabric-Libraries werden dabei zuletzt
/// eingemischt, damit sie bei Gleichstand gewinnen.
fn dedupe_classpath(vanilla: Vec<(String, String)>, fabric: Vec<(String, String)>) -> Vec<String> {
    fn module_key(maven_name: &str) -> String {
        maven_name.rsplitn(2, ':').nth(1).unwrap_or(maven_name).to_string()
    }

    fn version_key(maven_name: &str) -> Vec<u64> {
        let version = maven_name.rsplit(':').next().unwrap_or("");
        version
            .split(|c: char| c == '.' || c == '-' || c == '_' || c == '+')
            .map(|part| part.chars().take_while(|c| c.is_ascii_digit()).collect::<String>())
            .map(|digits| digits.parse::<u64>().unwrap_or(0))
            .collect()
    }

    let mut by_module: std::collections::HashMap<String, (Vec<u64>, String)> = std::collections::HashMap::new();
    let mut order: Vec<String> = Vec::new();

    for (name, path) in vanilla.into_iter().chain(fabric.into_iter()) {
        let key = module_key(&name);
        let candidate_version = version_key(&name);
        let should_replace = match by_module.get(&key) {
            Some((existing_version, _)) => &candidate_version >= existing_version,
            None => true,
        };
        if should_replace {
            if !by_module.contains_key(&key) {
                order.push(key.clone());
            }
            by_module.insert(key, (candidate_version, path));
        }
    }

    order.into_iter().filter_map(|key| by_module.remove(&key).map(|(_, path)| path)).collect()
}

fn extract_natives_if_needed(jar_path: &Path, artifact_path: &str, natives_dir: &Path) -> Result<()> {
    if !artifact_path.contains("natives") {
        return Ok(());
    }

    let file = std::fs::File::open(jar_path)
        .with_context(|| format!("Konnte Library-Jar nicht öffnen: {}", jar_path.display()))?;
    let mut archive = zip::ZipArchive::new(file)
        .with_context(|| format!("Konnte Library-Jar nicht als ZIP lesen: {}", jar_path.display()))?;
    std::fs::create_dir_all(natives_dir)?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_string();
        if name.starts_with("META-INF/") {
            continue;
        }
        let is_native = if cfg!(target_os = "windows") {
            name.ends_with(".dll")
        } else if cfg!(target_os = "macos") {
            name.ends_with(".dylib") || name.ends_with(".jnilib")
        } else {
            name.ends_with(".so")
        };
        if !is_native {
            continue;
        }
        let Some(file_name) = Path::new(&name).file_name() else {
            continue;
        };
        let out_path = natives_dir.join(file_name);
        let mut out_file = std::fs::File::create(&out_path)
            .with_context(|| format!("Konnte native Datei nicht schreiben: {}", out_path.display()))?;
        std::io::copy(&mut entry, &mut out_file)?;
    }
    Ok(())
}

/// Führt die komplette Installation/Aktualisierung durch. `on_progress` wird
/// wiederholt mit Fortschrittsinformationen aufgerufen (fürs UI).
pub async fn install_or_update(
    client: &reqwest::Client,
    on_progress: &(dyn Fn(InstallProgress) + Send + Sync),
) -> Result<install_state::InstallState> {
    let report = |phase: &str, label: &str, current: u64, total: u64| {
        on_progress(InstallProgress {
            phase: phase.to_string(),
            label: label.to_string(),
            current,
            total,
        });
    };

    // 1. Erzmark-Manifest
    report("manifest", "Prüfe auf Updates…", 0, 1);
    let erzmark_manifest = manifest::fetch_manifest(client)
        .await
        .context("Erzmark-Manifest konnte nicht geladen werden")?;
    report("manifest", "Manifest geladen", 1, 1);

    // 2. Vanilla-Minecraft-Versions-Infos
    report("mojang-manifest", "Lade Minecraft-Versionsinfos…", 0, 1);
    let version_manifest = mojang::fetch_version_manifest(client)
        .await
        .context("Mojang-Versions-Manifest konnte nicht geladen werden")?;
    let version_url = mojang::find_version_url(&version_manifest, &erzmark_manifest.minecraft_version)?;
    let version_info = mojang::fetch_version_info(client, &version_url)
        .await
        .context("Minecraft-Versions-JSON konnte nicht geladen werden")?;
    report("mojang-manifest", "Minecraft-Versionsinfos geladen", 1, 1);

    let mc_version = &version_info.id;
    let java_component = version_info
        .java_version
        .as_ref()
        .map(|j| j.component.clone())
        .unwrap_or_else(|| "java-runtime-delta".to_string());

    // 3. Java-Runtime
    report("java", "Java-Runtime wird vorbereitet…", 0, 1);
    let java_progress = |done: u64, total: u64| {
        report("java", "Java-Runtime wird heruntergeladen…", done, total.max(1));
    };
    let java_exe = java::ensure_java(client, &java_component, &java_progress)
        .await
        .context("Java-Runtime konnte nicht bereitgestellt werden")?;

    // 4. Client-Jar
    report("client", "Minecraft-Client wird heruntergeladen…", 0, 1);
    let client_jar_path = paths::version_dir(mc_version)?.join(format!("{mc_version}.jar"));
    downloader::download_if_needed(
        client,
        &version_info.downloads.client.url,
        &client_jar_path,
        Some(version_info.downloads.client.size),
        downloader::Checksum::Sha1(&version_info.downloads.client.sha1),
    )
    .await
    .context("Minecraft-Client-Jar konnte nicht heruntergeladen werden")?;
    report("client", "Minecraft-Client bereit", 1, 1);

    // 5. Vanilla-Libraries (+ Natives extrahieren)
    let libraries_dir = paths::libraries_dir()?;
    let natives_dir = paths::natives_dir(mc_version)?;
    let allowed_libs: Vec<&mojang::Library> = version_info
        .libraries
        .iter()
        .filter(|lib| mojang::rules_allow(&lib.rules) && mojang::library_matches_current_platform(&lib.name))
        .collect();
    let total_libs = allowed_libs.len() as u64;
    let mut vanilla_classpath: Vec<(String, String)> = Vec::new();

    for (i, lib) in allowed_libs.iter().enumerate() {
        report("libraries", &format!("Bibliotheken werden geladen… ({})", lib.name), i as u64, total_libs);
        let Some(downloads) = &lib.downloads else { continue };
        let Some(artifact) = &downloads.artifact else { continue };

        let dest = libraries_dir.join(&artifact.path);
        downloader::download_if_needed(
            client,
            &artifact.url,
            &dest,
            Some(artifact.size),
            downloader::Checksum::Sha1(&artifact.sha1),
        )
        .await
        .with_context(|| format!("Library fehlgeschlagen: {}", lib.name))?;

        extract_natives_if_needed(&dest, &artifact.path, &natives_dir)
            .with_context(|| format!("Natives-Extraktion fehlgeschlagen: {}", lib.name))?;

        vanilla_classpath.push((lib.name.clone(), dest.to_string_lossy().to_string()));
    }
    report("libraries", "Bibliotheken vollständig", total_libs, total_libs);

    // 6. Assets
    report("assets", "Asset-Index wird geladen…", 0, 1);
    let asset_index = mojang::fetch_asset_index(client, &version_info.asset_index.url)
        .await
        .context("Asset-Index konnte nicht geladen werden")?;
    let asset_index_file = paths::asset_index_file(&version_info.asset_index.id)?;
    downloader::download_if_needed(
        client,
        &version_info.asset_index.url,
        &asset_index_file,
        Some(version_info.asset_index.size),
        downloader::Checksum::Sha1(&version_info.asset_index.sha1),
    )
    .await
    .context("Asset-Index-Datei konnte nicht gespeichert werden")?;

    let total_assets = asset_index.objects.len() as u64;
    for (i, (_name, object)) in asset_index.objects.iter().enumerate() {
        if i % 25 == 0 {
            report("assets", "Assets werden heruntergeladen…", i as u64, total_assets);
        }
        let dest = paths::asset_object_file(&object.hash)?;
        let object_url = format!(
            "https://resources.download.minecraft.net/{}/{}",
            &object.hash[0..2],
            object.hash
        );
        downloader::download_if_needed(
            client,
            &object_url,
            &dest,
            Some(object.size),
            downloader::Checksum::Sha1(&object.hash),
        )
        .await
        .with_context(|| format!("Asset fehlgeschlagen: {}", object.hash))?;
    }
    report("assets", "Assets vollständig", total_assets, total_assets);

    // 7. Fabric-Loader
    report("fabric", "Fabric-Loader wird geladen…", 0, 1);
    let fabric_entry = fabric::fetch_loader_entry(client, mc_version, &erzmark_manifest.fabric_loader_version)
        .await
        .context("Fabric-Loader-Metadaten konnten nicht geladen werden")?;

    let mut fabric_classpath: Vec<(String, String)> = Vec::new();
    let fabric_libs_total = (fabric_entry.launcher_meta.libraries.common.len()
        + fabric_entry.launcher_meta.libraries.client.len()
        + 2) as u64; // +2 für Loader- und Intermediary-Jar
    let mut fabric_done: u64 = 0;

    for lib in fabric_entry
        .launcher_meta
        .libraries
        .common
        .iter()
        .chain(fabric_entry.launcher_meta.libraries.client.iter())
    {
        report("fabric", &format!("Fabric-Bibliotheken… ({})", lib.name), fabric_done, fabric_libs_total);
        let Some(rel_path) = fabric::maven_to_path(&lib.name) else {
            continue;
        };
        let dest = libraries_dir.join(&rel_path);
        let url = format!("{}{rel_path}", lib.url);
        // Fabrics Meta-API liefert keine Prüfsummen zu den Libraries mit –
        // Integrität wird hier über HTTPS + Fabrics eigenes Maven sichergestellt.
        downloader::download_if_needed(client, &url, &dest, None, downloader::Checksum::None)
            .await
            .with_context(|| format!("Fabric-Library fehlgeschlagen: {}", lib.name))?;
        fabric_classpath.push((lib.name.clone(), dest.to_string_lossy().to_string()));
        fabric_done += 1;
    }

    // Intermediary- und Loader-Jar (eigene Maven-Koordinate, gleiche Basis-URL).
    for (label, coordinate) in [
        ("Intermediary", &fabric_entry.intermediary.maven),
        ("Loader", &fabric_entry.loader.maven),
    ] {
        report("fabric", &format!("Fabric {label} wird geladen…"), fabric_done, fabric_libs_total);
        let Some(rel_path) = fabric::maven_to_path(coordinate) else {
            anyhow::bail!("Ungültige Fabric-Maven-Koordinate: {coordinate}");
        };
        let dest = libraries_dir.join(&rel_path);
        let url = format!("{}{rel_path}", crate::config::FABRIC_MAVEN_BASE);
        downloader::download_if_needed(client, &url, &dest, None, downloader::Checksum::None)
            .await
            .with_context(|| format!("Fabric-{label} fehlgeschlagen"))?;
        fabric_classpath.push((coordinate.clone(), dest.to_string_lossy().to_string()));
        fabric_done += 1;
    }
    report("fabric", "Fabric-Loader vollständig", fabric_libs_total, fabric_libs_total);

    // 8. Erzmark-eigene Dateien (Mods/Config/Resourcepack laut Manifest)
    let game_dir = paths::game_dir()?;
    let total_files = erzmark_manifest.files.len() as u64;
    for (i, file) in erzmark_manifest.files.iter().enumerate() {
        report("erzmark-files", &format!("Erzmark-Dateien… ({})", file.path), i as u64, total_files);
        let dest = game_dir.join(&file.path);
        downloader::download_if_needed(
            client,
            &file.url,
            &dest,
            Some(file.size),
            downloader::Checksum::Sha256(&file.sha256),
        )
        .await
        .with_context(|| format!("Erzmark-Datei fehlgeschlagen: {}", file.path))?;
    }
    report("erzmark-files", "Erzmark-Dateien vollständig", total_files, total_files);

    // 9. Start-Profil zusammenbauen und persistieren
    let profile_id = format!("fabric-loader-{}-{}", erzmark_manifest.fabric_loader_version, mc_version);
    let mut classpath = dedupe_classpath(vanilla_classpath, fabric_classpath);
    classpath.push(client_jar_path.to_string_lossy().to_string());

    let profile = LaunchProfile {
        profile_id: profile_id.clone(),
        minecraft_version: mc_version.clone(),
        asset_index_id: version_info.asset_index.id.clone(),
        main_class: fabric_entry.launcher_meta.main_class.client.clone(),
        classpath,
        natives_dir: natives_dir.to_string_lossy().to_string(),
        java_component: java_component.clone(),
        jvm_args_raw: version_info
            .arguments
            .as_ref()
            .map(|a| a.jvm.clone())
            .unwrap_or_default(),
        game_args_raw: version_info
            .arguments
            .as_ref()
            .map(|a| a.game.clone())
            .unwrap_or_default(),
    };

    let profile_path = paths::profile_file(&profile_id)?;
    if let Some(parent) = profile_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&profile_path, serde_json::to_string_pretty(&profile)?)
        .context("Start-Profil konnte nicht gespeichert werden")?;

    // Sicherstellen, dass die verwendete Java-Runtime auch tatsächlich existiert
    // (frühzeitiger, klarer Fehler statt kryptischem Absturz beim Start).
    if !java_exe.exists() {
        anyhow::bail!("Java-Runtime nicht gefunden nach Installation: {}", java_exe.display());
    }

    let state = install_state::InstallState {
        client_version: erzmark_manifest.client_version,
        minecraft_version: mc_version.clone(),
        fabric_loader_version: erzmark_manifest.fabric_loader_version,
        profile_id,
    };
    install_state::save(&state)?;

    report("done", "Installation abgeschlossen", 1, 1);
    Ok(state)
}
