//! Tauri-Commands: Brücke zwischen React-Frontend und dem Manifest-/
//! Install-/Start-System in `game/`.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::game::{install, install_state, launch, player_status};
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct GameError {
    pub message: String,
}

impl From<anyhow::Error> for GameError {
    fn from(e: anyhow::Error) -> Self {
        GameError {
            message: e.to_string(),
        }
    }
}

/// Schneller Status für den Install/Update/Play-Button (kein Datei-Hashing,
/// nur Versionsvergleich – siehe install::check_status).
#[tauri::command]
pub async fn get_play_status() -> install::PlayStatus {
    let client = reqwest::Client::new();
    install::check_status(&client).await
}

/// Führt die komplette Installation/Aktualisierung durch. Sendet laufend
/// `install-progress`-Events ans Frontend (Fortschrittsbalken).
#[tauri::command]
pub async fn install_or_update(app: AppHandle) -> Result<(), GameError> {
    let client = reqwest::Client::new();
    let app_for_progress = app.clone();

    install::install_or_update(&client, &move |progress| {
        let _ = app_for_progress.emit("install-progress", &progress);
    })
    .await
    .map_err(GameError::from)?;

    Ok(())
}

/// Startet Minecraft: sorgt zuerst für eine frische Session (Access-Token),
/// lädt das beim Installieren gespeicherte Start-Profil und startet den
/// Java-Prozess mit automatischem Connect zu erzmark.de (via
/// `--quickPlayMultiplayer`).
///
/// Wartet NICHT selbst auf das Prozessende (der Tauri-Command müsste sonst
/// die ganze Spielzeit über blockieren) – stattdessen läuft die Überwachung
/// in einer separaten Hintergrund-Task, die per `game-started`/`game-exited`-
/// Events das Frontend informiert (Play-Button <-> "Spiel läuft…") UND den
/// Java-Prozess selbst beendet, sobald der Spieler den Server verlässt (dazu
/// wird periodisch der serverseitige Online-Status abgefragt – Quick-Play
/// beendet den Client dafür entgegen ursprünglicher Annahme NICHT von selbst).
#[tauri::command]
pub async fn launch_game(app: AppHandle, state: State<'_, AppState>) -> Result<(), GameError> {
    let info = crate::commands::ensure_fresh_session_internal(state.inner())
        .await
        .map_err(GameError::from)?;

    let Some(local_state) = install_state::load() else {
        return Err(GameError {
            message: "Das Spiel ist noch nicht installiert – bitte zuerst installieren.".to_string(),
        });
    };

    let profile = launch::load_profile(&local_state.profile_id).map_err(GameError::from)?;

    let access_token = {
        let guard = state.session.lock().unwrap();
        let session = guard.as_ref().ok_or_else(|| GameError {
            message: "Keine aktive Session".to_string(),
        })?;
        session.mc_access_token.clone()
    };

    let session_args = launch::SessionArgs {
        player_name: info.username,
        player_uuid: info.uuid,
        access_token,
    };

    let mut child = launch::launch(&profile, &session_args)
        .await
        .map_err(GameError::from)?;

    *state.game_process.lock().unwrap() = child.id();
    let _ = app.emit("game-started", ());

    // Auto-Close beim Netzwerk-Verlassen: alle 2s den Online-Status über
    // CloudNets eigene REST-API abfragen (network-status.php, siehe
    // player_status.rs – netzwerkweit korrekt, unabhängig von MMOProfiles).
    // Kurzes Intervall, damit das Schließen nach "Verbindung trennen" sich
    // sofort statt erst nach vielen Sekunden anfühlt.
    //
    // Erst NACHDEM der Spieler mindestens einmal als "online" gemeldet
    // wurde (`seen_online`), wird die Offline-Erkennung scharf geschaltet –
    // sonst würde die Ladephase direkt nach dem Start (Java/World-Load,
    // bevor die Verbindung zum Proxy überhaupt steht) fälschlich als
    // "Server verlassen" gewertet. Zusätzlich müssen zwei aufeinanderfolgende
    // Abfragen "offline" ergeben, bevor tatsächlich gekillt wird (Puffer
    // gegen kurze Netz-Hänger/Transfers zwischen Backend-Servern) – bei 2s
    // Intervall macht das insgesamt ca. 4s Verzögerung nach dem Trennen.
    let app_for_wait = app.clone();
    let uuid_for_poll = session_args.player_uuid.clone();
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(2));
        interval.tick().await; // ersten (sofortigen) Tick überspringen

        let mut seen_online = false;
        let mut consecutive_offline = 0u8;

        loop {
            tokio::select! {
                _ = child.wait() => {
                    break;
                }
                _ = interval.tick() => {
                    match player_status::is_online(&client, &uuid_for_poll).await {
                        Some(true) => {
                            seen_online = true;
                            consecutive_offline = 0;
                        }
                        Some(false) => {
                            if seen_online {
                                consecutive_offline += 1;
                                if consecutive_offline >= 2 {
                                    let _ = child.start_kill();
                                }
                            }
                        }
                        None => {
                            // Status unbekannt (Netzwerkfehler, Token-Problem
                            // o. Ä.) – bewusst NICHT werten, um niemanden
                            // versehentlich rauszuwerfen.
                        }
                    }
                }
            }
        }

        if let Some(app_state) = app_for_wait.try_state::<AppState>() {
            *app_state.game_process.lock().unwrap() = None;
        }
        let _ = app_for_wait.emit("game-exited", ());
    });

    Ok(())
}

/// Liefert die neuesten Screenshots (mit kleinen JPEG-Vorschaubildern als
/// Data-URLs) für die Screenshot-Galerie im Hauptbildschirm.
#[tauri::command]
pub fn list_screenshots(limit: Option<usize>) -> Result<Vec<crate::game::screenshots::ScreenshotEntry>, GameError> {
    crate::game::screenshots::list_recent(limit.unwrap_or(8)).map_err(GameError::from)
}

/// Öffnet den Screenshot-Ordner im Datei-Explorer des Betriebssystems.
#[tauri::command]
pub fn open_screenshots_folder() -> Result<(), GameError> {
    crate::game::screenshots::open_folder().map_err(GameError::from)
}

/// Öffnet einen einzelnen Screenshot in Originalgröße.
#[tauri::command]
pub fn open_screenshot(filename: String) -> Result<(), GameError> {
    crate::game::screenshots::open_file(&filename).map_err(GameError::from)
}
