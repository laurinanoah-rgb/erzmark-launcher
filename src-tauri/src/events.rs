//! Boss-Event-Countdown: liest den nächsten Termin aus einer kleinen, vom
//! Erzmark-Team selbst gepflegten JSON-Datei auf erzmark.de. Bewusst separat
//! von `manifest.json` (Minecraft-Update-System) gehalten, da sich der
//! Termin unabhängig und beliebig oft ändern kann/soll.
//!
//! Erwartetes Format unter `https://erzmark.de/launcher/events.json`:
//! ```json
//! { "nextBossEventAt": "2026-08-15T20:00:00Z", "eventName": "Der Ascheking", "description": "..." }
//! ```
//! `nextBossEventAt` ist ISO-8601/UTC. `eventName`/`description` sind optional.
//! Existiert die Datei (noch) nicht oder ist kein Termin gesetzt, wird das
//! Countdown-Widget im Launcher einfach ausgeblendet statt einen Fehler zu zeigen.

use serde::{Deserialize, Serialize};

const EVENTS_URL: &str = "https://erzmark.de/launcher/events.json";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BossEvent {
    #[serde(rename = "nextBossEventAt", default)]
    pub next_boss_event_at: Option<String>,
    #[serde(rename = "eventName", default)]
    pub event_name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

/// Lädt den Event-Termin. Gibt bei jedem Fehler (Datei fehlt, Netzwerk down,
/// kaputtes JSON) einfach "kein Event" zurück – das ist rein dekorativ und
/// soll den Launcher nie mit einer Fehlermeldung stören.
pub async fn fetch(client: &reqwest::Client) -> BossEvent {
    let cache_bust = chrono::Utc::now().timestamp();
    let url = format!("{EVENTS_URL}?_={cache_bust}");

    let Ok(resp) = client.get(&url).send().await else {
        return BossEvent::default();
    };
    if !resp.status().is_success() {
        return BossEvent::default();
    }
    resp.json().await.unwrap_or_default()
}
