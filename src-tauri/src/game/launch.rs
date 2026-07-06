//! Baut aus dem beim Installieren gespeicherten Start-Profil den kompletten
//! Java-Startbefehl (JVM-Argumente, Klassenpfad, Game-Argumente inkl.
//! Auto-Connect) und startet Minecraft als eigenständigen Prozess.

use crate::game::{mojang, paths};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchProfile {
    pub profile_id: String,
    pub minecraft_version: String,
    pub asset_index_id: String,
    pub main_class: String,
    pub classpath: Vec<String>,
    pub natives_dir: String,
    pub java_component: String,
    pub jvm_args_raw: Vec<Value>,
    pub game_args_raw: Vec<Value>,
}

pub fn load_profile(profile_id: &str) -> Result<LaunchProfile> {
    let path = paths::profile_file(profile_id)?;
    let data = std::fs::read_to_string(&path)
        .with_context(|| format!("Start-Profil nicht gefunden: {} – bitte zuerst installieren", path.display()))?;
    serde_json::from_str(&data).context("Start-Profil ist beschädigt/ungültig – bitte neu installieren")
}

fn substitute(template: &str, placeholders: &HashMap<&str, String>) -> String {
    let mut result = template.to_string();
    for (key, value) in placeholders {
        result = result.replace(&format!("${{{key}}}"), value);
    }
    result
}

/// Löst Mojangs gemischte Argument-Listen auf (einfache Strings + bedingte
/// Objekte mit `rules`/`value`) – dasselbe Format wie bei Libraries.
fn resolve_arguments(raw: &[Value], placeholders: &HashMap<&str, String>) -> Vec<String> {
    let mut out = Vec::new();
    for item in raw {
        match item {
            Value::String(s) => out.push(substitute(s, placeholders)),
            Value::Object(_) => {
                let rules = item.get("rules").and_then(|r| r.as_array()).cloned();
                if !mojang::rules_allow(&rules) {
                    continue;
                }
                match item.get("value") {
                    Some(Value::String(s)) => out.push(substitute(s, placeholders)),
                    Some(Value::Array(arr)) => {
                        for v in arr {
                            if let Some(s) = v.as_str() {
                                out.push(substitute(s, placeholders));
                            }
                        }
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    }
    out
}

pub struct SessionArgs {
    pub player_name: String,
    pub player_uuid: String,
    pub access_token: String,
}

/// Setzt den FOV-Wert in `options.txt` zwangsweise auf 70 ("Normal") zurück,
/// ohne andere Einstellungen des Spielers zu verändern. `0.0` entspricht in
/// Minecrafts Optionsformat exakt der Vanilla-Voreinstellung 70 (Skala -1.0
/// = 30 bis 1.0 = 110). Ändert der Spieler den Regler während einer
/// laufenden Session, wird es beim nächsten Start über den Launcher wieder
/// zurückgesetzt. Bereits vorhandene andere Optionen bleiben unangetastet.
fn apply_fov_lock(game_dir: &Path) -> Result<()> {
    let options_path = game_dir.join("options.txt");
    let mut lines: Vec<String> = if options_path.exists() {
        std::fs::read_to_string(&options_path)
            .context("Konnte options.txt nicht lesen")?
            .lines()
            .map(|l| l.to_string())
            .collect()
    } else {
        Vec::new()
    };

    let mut found = false;
    for line in lines.iter_mut() {
        if line.starts_with("fov:") {
            *line = "fov:0.0".to_string();
            found = true;
            break;
        }
    }
    if !found {
        lines.push("fov:0.0".to_string());
    }

    std::fs::create_dir_all(game_dir).context("Konnte Spielverzeichnis nicht anlegen")?;
    std::fs::write(&options_path, lines.join("\n") + "\n").context("Konnte options.txt nicht schreiben")?;
    Ok(())
}

/// Startet Minecraft als eigenständigen Prozess (nicht an den Launcher
/// gebunden). stdout/stderr landen in `<launcher_root>/logs/latest.log`,
/// damit sich Abstürze im Nachhinein nachvollziehen lassen, ohne ein
/// sichtbares Konsolenfenster zu öffnen.
pub async fn launch(profile: &LaunchProfile, session: &SessionArgs) -> Result<()> {
    let java_exe = crate::game::java::java_executable_path(&profile.java_component)?;
    if !java_exe.exists() {
        anyhow::bail!("Java-Runtime nicht gefunden – bitte zuerst installieren/aktualisieren");
    }

    let game_dir = paths::game_dir()?;
    let assets_dir = paths::assets_dir()?;
    std::fs::create_dir_all(&game_dir).context("Konnte Spielverzeichnis nicht anlegen")?;

    let settings = crate::settings::load();
    if settings.lock_fov {
        apply_fov_lock(&game_dir).context("FOV-Sperre konnte nicht angewendet werden")?;
    }

    let classpath = profile
        .classpath
        .join(if cfg!(target_os = "windows") { ";" } else { ":" });
    let uuid_no_dashes = session.player_uuid.replace('-', "");

    let mut placeholders: HashMap<&str, String> = HashMap::new();
    placeholders.insert("natives_directory", profile.natives_dir.clone());
    placeholders.insert("launcher_name", crate::config::LAUNCHER_NAME.to_string());
    placeholders.insert("launcher_version", env!("CARGO_PKG_VERSION").to_string());
    placeholders.insert("classpath", classpath);
    placeholders.insert("auth_player_name", session.player_name.clone());
    placeholders.insert("auth_uuid", session.player_uuid.clone());
    placeholders.insert("auth_access_token", session.access_token.clone());
    // Kein separates XUID aktuell erfasst (xbox.rs speichert nur uhs) – UUID
    // ohne Bindestriche als unkritischer Platzhalter; wird für den normalen
    // Multiplayer-Beitritt nicht ausgewertet.
    placeholders.insert("auth_xuid", uuid_no_dashes);
    placeholders.insert("user_type", "msa".to_string());
    placeholders.insert("version_name", profile.minecraft_version.clone());
    placeholders.insert("game_directory", game_dir.to_string_lossy().to_string());
    placeholders.insert("assets_root", assets_dir.to_string_lossy().to_string());
    placeholders.insert("assets_index_name", profile.asset_index_id.clone());
    placeholders.insert("clientid", crate::config::MC_LAUNCHER_CLIENT_ID.to_string());
    placeholders.insert("version_type", "release".to_string());
    placeholders.insert("resolution_width", "925".to_string());
    placeholders.insert("resolution_height", "530".to_string());

    let mut jvm_args = vec![
        format!("-Xms{}M", settings.memory_min_mb),
        format!("-Xmx{}M", settings.memory_max_mb),
    ];
    jvm_args.extend(resolve_arguments(&profile.jvm_args_raw, &placeholders));
    if jvm_args.len() <= 2 {
        // Fallback, falls die Versions-JSON kein "arguments.jvm" enthält (bei
        // MC 1.21.8 nicht zu erwarten, aber sicherheitshalber).
        jvm_args.push(format!("-Djava.library.path={}", profile.natives_dir));
        jvm_args.push("-cp".to_string());
        jvm_args.push(placeholders.get("classpath").cloned().unwrap_or_default());
    }

    let mut game_args = resolve_arguments(&profile.game_args_raw, &placeholders);

    // Auto-Connect: unabhängig vom Regelwerk der Versions-JSON zusätzlich
    // anhängen (siehe PLANNING.md Abschnitt 3 – kein Fabric-Mod nötig).
    game_args.push("--quickPlayMultiplayer".to_string());
    game_args.push(crate::config::ERZMARK_SERVER_ADDRESS.to_string());

    let log_dir = paths::launcher_root()?.join("logs");
    std::fs::create_dir_all(&log_dir).context("Konnte Log-Ordner nicht anlegen")?;
    let log_out = std::fs::File::create(log_dir.join("latest.log"))
        .context("Konnte Log-Datei nicht anlegen")?;
    let log_err = log_out.try_clone().context("Konnte Log-Datei nicht duplizieren")?;

    Command::new(&java_exe)
        .args(&jvm_args)
        .arg(&profile.main_class)
        .args(&game_args)
        .current_dir(&game_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::from(log_out))
        .stderr(Stdio::from(log_err))
        .spawn()
        .context("Minecraft-Prozess konnte nicht gestartet werden")?;

    Ok(())
}
