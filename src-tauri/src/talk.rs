//! Echter Talk-Start (23.08.2026) über die neuen Sanctum-authentifizierten
//! app-api/talk/*-Endpunkte (siehe `TalkController.php`, wird parallel von
//! einem anderen Agenten auf dem Server gebaut - die Formate hier folgen dem
//! bereits abgestimmten Plan, nicht bereits verifiziertem Server-Code, siehe
//! `fuzzy-doodling-lighthouse.md`). Stößt über den Discord-Bot R.U.D.O.L.F.
//! das Erstellen eines echten privaten Voice-Channels für den eingeloggten
//! Spieler + einen Freund an. Nutzt denselben Sanctum-Token-Mechanismus wie
//! `social.rs`/`achievements.rs` (`social::ensure_sanctum_token`), daher kein
//! eigenes Token-Handling hier.
//!
//! Ergänzt die bereits vorhandene, rein lesende Voice-Presence-Anzeige
//! (`voice.rs`) um den aktiven Trigger - beide Bausteine zusammen ergeben
//! erst den vollen Talk-Flow (siehe TalkContext.jsx).

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use crate::config;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TalkStartResult {
    #[serde(rename = "requestId")]
    pub request_id: String,
}

/// Statuswerte lt. Plan: "pending" | "created" | "failed".
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TalkStatus {
    pub status: String,
    #[serde(rename = "channelId")]
    pub channel_id: Option<String>,
    #[serde(rename = "inviteUrl")]
    pub invite_url: Option<String>,
    #[serde(rename = "errorReason")]
    pub error_reason: Option<String>,
}

/// Stößt einen neuen Talk-Request mit dem Zielfreund (`friend_uuid`) an -
/// legt serverseitig eine `talk_requests`-Zeile an und dispatcht den Bot über
/// Redis (`PublishTalkStartToDiscord`). Liefert nur die Korrelations-Id
/// zurück, der eigentliche Fortschritt kommt über `fetch_talk_status`.
pub async fn request_talk_start(
    client: &reqwest::Client,
    sanctum_token: &str,
    friend_uuid: &str,
) -> Result<TalkStartResult> {
    let resp = client
        .post(config::ERZMARK_TALK_START_URL)
        .bearer_auth(sanctum_token)
        .json(&serde_json::json!({ "uuid": friend_uuid }))
        .send()
        .await
        .context("Talk-Start nicht erreichbar (Netzwerk?)")?;

    if !resp.status().is_success() {
        anyhow::bail!(
            "Talk-Start fehlgeschlagen ({}): {}",
            resp.status(),
            resp.text().await.unwrap_or_default()
        );
    }

    resp.json::<TalkStartResult>()
        .await
        .context("Ungültige Antwort beim Talk-Start")
}

/// Fragt den aktuellen Status eines zuvor gestarteten Talk-Requests ab
/// (Poll-Fallback, solange es noch keinen Reverb-Echtzeit-Client gibt -
/// siehe Plan-Dokument, Abschnitt "Nicht Teil dieser Session").
pub async fn fetch_talk_status(
    client: &reqwest::Client,
    sanctum_token: &str,
    request_id: &str,
) -> Result<TalkStatus> {
    let url = format!("{}/{}", config::ERZMARK_TALK_STATUS_URL_BASE, request_id);

    let resp = client
        .get(url)
        .bearer_auth(sanctum_token)
        .send()
        .await
        .context("Talk-Status nicht erreichbar (Netzwerk?)")?;

    if !resp.status().is_success() {
        anyhow::bail!("Talk-Status-Abruf fehlgeschlagen ({})", resp.status());
    }

    resp.json::<TalkStatus>()
        .await
        .context("Ungültige Antwort beim Talk-Status-Abruf")
}
