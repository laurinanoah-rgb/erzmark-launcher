//! Echtes Achievement-Backend (23.08.2026) über die Sanctum-authentifizierten
//! app-api/achievements-Endpunkte (siehe AchievementController.php auf dem
//! Server) - ersetzt den bisherigen reinen Client-Mock in `achievements.js`.
//! Nutzt denselben Sanctum-Token-Mechanismus wie `social.rs`
//! (`social::ensure_sanctum_token`), daher kein eigenes Token-Handling hier.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use crate::config;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AchievementEntry {
    pub id: String,
    pub category: String,
    pub step: i32,
    pub title: String,
    pub description: String,
    pub icon: String,
    pub unlocked: bool,
    #[serde(rename = "unlockedAt")]
    pub unlocked_at: Option<String>,
    #[serde(rename = "contextSentence")]
    pub context_sentence: Option<String>,
    #[serde(rename = "percentUnlocked")]
    pub percent_unlocked: i32,
    #[serde(rename = "progressPercent")]
    pub progress_percent: i32,
    #[serde(rename = "justUnlocked")]
    pub just_unlocked: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AchievementStats {
    #[serde(rename = "playTimeSeconds")]
    pub play_time_seconds: i64,
}

/// Liefert den Erfolge-Katalog inkl. Freischalt-/Fortschrittsstatus des
/// eingeloggten Spielers - identisches JSON-Shape wie der bisherige Mock
/// (`getAchievements()` in `achievements.js`).
pub async fn fetch_achievements(client: &reqwest::Client, sanctum_token: &str) -> Result<Vec<AchievementEntry>> {
    let resp = client
        .get(config::ERZMARK_ACHIEVEMENTS_URL)
        .bearer_auth(sanctum_token)
        .send()
        .await
        .context("Erfolge nicht erreichbar (Netzwerk?)")?;

    if !resp.status().is_success() {
        anyhow::bail!("Erfolge-Abruf fehlgeschlagen ({})", resp.status());
    }

    resp.json::<Vec<AchievementEntry>>()
        .await
        .context("Ungültige Antwort beim Abruf der Erfolge")
}

/// Aktuelle Spielzeit des eingeloggten Spielers - identisches JSON-Shape wie
/// der bisherige Mock (`getStats()` in `achievements.js`).
pub async fn fetch_achievement_stats(client: &reqwest::Client, sanctum_token: &str) -> Result<AchievementStats> {
    let resp = client
        .get(config::ERZMARK_ACHIEVEMENTS_STATS_URL)
        .bearer_auth(sanctum_token)
        .send()
        .await
        .context("Erfolge-Statistik nicht erreichbar (Netzwerk?)")?;

    if !resp.status().is_success() {
        anyhow::bail!("Erfolge-Statistik-Abruf fehlgeschlagen ({})", resp.status());
    }

    resp.json::<AchievementStats>()
        .await
        .context("Ungültige Antwort beim Abruf der Erfolge-Statistik")
}

/// Markiert einen frisch freigeschalteten Erfolg als gesehen (setzt
/// `seen_at` serverseitig), damit der Frisch-geschmiedet-Effekt im Frontend
/// nur einmal abläuft - Gegenstück zum bisherigen `acknowledgeJustUnlocked(id)`.
pub async fn acknowledge_achievement(client: &reqwest::Client, sanctum_token: &str, achievement_id: &str) -> Result<()> {
    let url = format!("{}/{}/ack", config::ERZMARK_ACHIEVEMENTS_ACK_URL_BASE, achievement_id);

    let resp = client
        .post(url)
        .bearer_auth(sanctum_token)
        .send()
        .await
        .context("Erfolg bestätigen fehlgeschlagen (Netzwerk?)")?;

    if !resp.status().is_success() {
        anyhow::bail!(
            "Erfolg bestätigen fehlgeschlagen ({}): {}",
            resp.status(),
            resp.text().await.unwrap_or_default()
        );
    }

    Ok(())
}
