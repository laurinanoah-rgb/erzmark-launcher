//! Tauri-Commands: Brücke zwischen React-Frontend und der Rust-Auth-Logik.

use chrono::Utc;
use serde::Serialize;
use tauri::State;

use crate::auth::{minecraft, ms_oauth, token_store, xbox};
use crate::state::{AppState, Session};

#[derive(Debug, Clone, Serialize)]
pub struct SessionInfo {
    pub username: String,
    pub uuid: String,
}

#[derive(Debug, Serialize)]
pub struct AuthError {
    pub message: String,
}

impl From<anyhow::Error> for AuthError {
    fn from(e: anyhow::Error) -> Self {
        AuthError {
            message: e.to_string(),
        }
    }
}

async fn build_session_from_ms_tokens(ms: ms_oauth::MsTokenResponse) -> anyhow::Result<Session> {
    let xsts = xbox::authenticate_xbox_live(&ms.access_token).await?;
    let mc_auth = minecraft::login_with_xbox(&xsts).await?;

    // Bei einem Fehler im Entitlement-Check wohlwollend weitermachen – der
    // Profil-Abruf direkt danach schlägt ohnehin hart fehl, falls der Account
    // wirklich kein Minecraft besitzt.
    let owns = minecraft::owns_game(&mc_auth.access_token).await.unwrap_or(true);
    if !owns {
        anyhow::bail!(
            "Dieser Microsoft-Account besitzt kein Minecraft. Bitte mit dem Account einloggen, mit dem das Spiel gekauft wurde."
        );
    }

    let profile = minecraft::fetch_profile(&mc_auth.access_token).await?;
    let now = Utc::now().timestamp();

    Ok(Session {
        ms_access_token: ms.access_token,
        ms_refresh_token: ms.refresh_token,
        ms_expires_at: now + ms.expires_in as i64,
        mc_access_token: mc_auth.access_token,
        mc_expires_at: now + mc_auth.expires_in as i64,
        profile,
    })
}

fn session_info(session: &Session) -> SessionInfo {
    SessionInfo {
        username: session.profile.name.clone(),
        uuid: session.profile.id.clone(),
    }
}

/// Startet den interaktiven Login (Browser öffnet sich). Wird vom
/// Login-Bildschirm bei Klick auf "Mit Microsoft anmelden" aufgerufen.
#[tauri::command]
pub async fn login(state: State<'_, AppState>) -> Result<SessionInfo, AuthError> {
    let ms_tokens = ms_oauth::login_interactive().await.map_err(AuthError::from)?;
    token_store::save_refresh_token(&ms_tokens.refresh_token).map_err(AuthError::from)?;

    let session = build_session_from_ms_tokens(ms_tokens)
        .await
        .map_err(AuthError::from)?;
    let info = session_info(&session);

    *state.session.lock().unwrap() = Some(session);
    Ok(info)
}

/// Wird beim App-Start aufgerufen: versucht stillschweigend einzuloggen,
/// wenn ein gespeicherter Refresh-Token existiert. `Ok(None)` bedeutet: kein
/// gespeicherter Token (oder abgelaufen) -> Frontend zeigt den Login-Bildschirm.
#[tauri::command]
pub async fn try_restore_session(
    state: State<'_, AppState>,
) -> Result<Option<SessionInfo>, AuthError> {
    let stored = token_store::load_refresh_token().map_err(AuthError::from)?;
    let Some(refresh_token) = stored else {
        return Ok(None);
    };

    let ms_tokens = match ms_oauth::refresh(&refresh_token).await {
        Ok(t) => t,
        Err(_) => {
            let _ = token_store::clear_refresh_token();
            return Ok(None);
        }
    };
    token_store::save_refresh_token(&ms_tokens.refresh_token).map_err(AuthError::from)?;

    let session = build_session_from_ms_tokens(ms_tokens)
        .await
        .map_err(AuthError::from)?;
    let info = session_info(&session);

    *state.session.lock().unwrap() = Some(session);
    Ok(Some(info))
}

/// Stellt sicher, dass die Tokens noch (mind. 60s) gültig sind, erneuert sie
/// bei Bedarf im Hintergrund. Vor jedem Minecraft-Start aufzurufen.
#[tauri::command]
pub async fn ensure_fresh_session(state: State<'_, AppState>) -> Result<SessionInfo, AuthError> {
    ensure_fresh_session_internal(state.inner())
        .await
        .map_err(AuthError::from)
}

/// Gleiche Logik wie `ensure_fresh_session`, aber als normale Funktion (statt
/// Tauri-Command) nutzbar – z. B. von `game_commands::launch_game` vor dem
/// eigentlichen Minecraft-Start aufgerufen, ohne den State-Wrapper erneut
/// durch Tauris Command-Mechanismus reichen zu müssen.
pub async fn ensure_fresh_session_internal(state: &AppState) -> anyhow::Result<SessionInfo> {
    let (needs_refresh, refresh_token) = {
        let guard = state.session.lock().unwrap();
        match guard.as_ref() {
            Some(s) => (
                Utc::now().timestamp() > s.mc_expires_at - 60,
                s.ms_refresh_token.clone(),
            ),
            None => anyhow::bail!("Keine aktive Session – bitte zuerst einloggen"),
        }
    };

    if !needs_refresh {
        let guard = state.session.lock().unwrap();
        return Ok(session_info(guard.as_ref().unwrap()));
    }

    let ms_tokens = ms_oauth::refresh(&refresh_token).await?;
    token_store::save_refresh_token(&ms_tokens.refresh_token)?;

    let session = build_session_from_ms_tokens(ms_tokens).await?;
    let info = session_info(&session);

    *state.session.lock().unwrap() = Some(session);
    Ok(info)
}

#[tauri::command]
pub fn logout(state: State<'_, AppState>) -> Result<(), AuthError> {
    *state.session.lock().unwrap() = None;
    token_store::clear_refresh_token().map_err(AuthError::from)?;
    Ok(())
}
