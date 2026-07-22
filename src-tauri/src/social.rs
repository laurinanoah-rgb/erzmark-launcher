//! Freundschaftsanfragen über die neuen app-api/*-Endpunkte (Launcher-
//! Update-TODO, Abschnitt 4, Teil 3) – im Gegensatz zu `friends.rs` (rein
//! lesend, kein Auth) braucht das hier einen Sanctum-Bearer-Token, siehe
//! `ensure_sanctum_token` weiter unten.

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};

use crate::config;
use crate::state::AppState;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FriendRequestEntry {
    pub id: i64,
    #[serde(rename = "requestId")]
    pub request_id: String,
    #[serde(rename = "requesterUuid")]
    pub requester_uuid: String,
    #[serde(rename = "requesterName")]
    pub requester_name: String,
    pub status: String,
    #[serde(rename = "requestedAt")]
    pub requested_at: Option<String>,
}

/// Tauscht den (frischen) Minecraft-Access-Token gegen einen Sanctum-Token,
/// exakt derselbe Endpunkt/Vertrag wie bei der Mobile App (siehe
/// AppAuthController.php). Wird nur aufgerufen, wenn noch kein Token im
/// State gecached ist – siehe `ensure_sanctum_token`.
async fn exchange_for_sanctum_token(client: &reqwest::Client, mc_access_token: &str) -> Result<String> {
    #[derive(Deserialize)]
    struct Resp {
        access_token: String,
    }

    let resp = client
        .post(config::ERZMARK_APP_API_AUTH_URL)
        .json(&serde_json::json!({ "access_token": mc_access_token }))
        .send()
        .await
        .context("Anmeldung beim Erzmark-Backend fehlgeschlagen (Netzwerk?)")?;

    if !resp.status().is_success() {
        anyhow::bail!(
            "Anmeldung beim Erzmark-Backend fehlgeschlagen ({}): {}",
            resp.status(),
            resp.text().await.unwrap_or_default()
        );
    }

    let parsed: Resp = resp.json().await.context("Ungültige Antwort beim Sanctum-Login")?;
    Ok(parsed.access_token)
}

/// Liefert einen gültigen Sanctum-Token – aus dem State-Cache, oder frisch
/// getauscht, falls noch keiner da ist. Ruft dafür zuerst
/// `ensure_fresh_session_internal` auf, damit der Minecraft-Access-Token
/// beim Tausch garantiert noch gültig ist.
pub async fn ensure_sanctum_token(state: &AppState) -> Result<String> {
    if let Some(token) = state.sanctum_token.lock().unwrap().clone() {
        return Ok(token);
    }

    let info = crate::commands::ensure_fresh_session_internal(state).await?;
    let mc_access_token = {
        let guard = state.session.lock().unwrap();
        guard
            .as_ref()
            .filter(|s| s.profile.id == info.uuid)
            .map(|s| s.mc_access_token.clone())
            .ok_or_else(|| anyhow!("Keine aktive Session – bitte zuerst einloggen"))?
    };

    let client = reqwest::Client::new();
    let token = exchange_for_sanctum_token(&client, &mc_access_token).await?;
    *state.sanctum_token.lock().unwrap() = Some(token.clone());
    Ok(token)
}

pub async fn fetch_friend_requests(client: &reqwest::Client, sanctum_token: &str) -> Result<Vec<FriendRequestEntry>> {
    let resp = client
        .get(config::ERZMARK_FRIEND_REQUESTS_URL)
        .bearer_auth(sanctum_token)
        .send()
        .await
        .context("Freundschaftsanfragen nicht erreichbar (Netzwerk?)")?;

    if !resp.status().is_success() {
        anyhow::bail!("Freundschaftsanfragen-Abruf fehlgeschlagen ({})", resp.status());
    }

    resp.json::<Vec<FriendRequestEntry>>()
        .await
        .context("Ungültige Antwort beim Abruf der Freundschaftsanfragen")
}

pub async fn respond_friend_request(
    client: &reqwest::Client,
    sanctum_token: &str,
    request_id: i64,
    accept: bool,
) -> Result<FriendRequestEntry> {
    let url = format!("{}/{}/respond", config::ERZMARK_FRIEND_REQUESTS_URL, request_id);
    let action = if accept { "accept" } else { "decline" };

    let resp = client
        .post(url)
        .bearer_auth(sanctum_token)
        .json(&serde_json::json!({ "action": action }))
        .send()
        .await
        .context("Antwort auf Freundschaftsanfrage fehlgeschlagen (Netzwerk?)")?;

    if !resp.status().is_success() {
        anyhow::bail!(
            "Antwort auf Freundschaftsanfrage fehlgeschlagen ({}): {}",
            resp.status(),
            resp.text().await.unwrap_or_default()
        );
    }

    resp.json::<FriendRequestEntry>()
        .await
        .context("Ungültige Antwort beim Beantworten der Freundschaftsanfrage")
}

/// Freund entfernen (22.07.2026) – legt serverseitig eine Entfernung an, die
/// asynchron wirksam wird (live über das ErzmarkSocial-Plugin, falls einer
/// von beiden gerade online ist, sonst verzögert über den Laravel-Scheduler
/// sobald offline – siehe FriendRequestController::remove auf dem Server).
pub async fn remove_friend(client: &reqwest::Client, sanctum_token: &str, friend_uuid: &str) -> Result<()> {
    let resp = client
        .post(config::ERZMARK_FRIENDS_REMOVE_URL)
        .bearer_auth(sanctum_token)
        .json(&serde_json::json!({ "uuid": friend_uuid }))
        .send()
        .await
        .context("Freund entfernen fehlgeschlagen (Netzwerk?)")?;

    if !resp.status().is_success() {
        anyhow::bail!(
            "Freund entfernen fehlgeschlagen ({}): {}",
            resp.status(),
            resp.text().await.unwrap_or_default()
        );
    }

    Ok(())
}
