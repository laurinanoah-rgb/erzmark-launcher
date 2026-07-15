//! Charakterprofile (MMOProfiles) im Launcher anzeigen.
//!
//! Liest dieselbe Datenquelle wie ProfileController::mine() im
//! Laravel-Backend (profil.mmoprofiles_playerdata + mcmmo.mmocore_playerdata
//! + coins.Coins + minetrax.player_profiles), aber über ein kleines
//! read-only PHP-Skript (`public/launcher/profiles.php` auf erzmark.de,
//! nutzt denselben `erzmark_readonly`-MySQL-User wie `friends.rs`), da der
//! Launcher keine eigene Login-Session gegen die Laravel-API hat.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CharacterProfile {
    pub uuid: String,
    pub name: String,
    pub active: bool,
    pub class: Option<String>,
    pub level: i32,
    #[serde(rename = "questsCompleted")]
    pub quests_completed: i32,
    #[serde(rename = "playTime")]
    pub play_time: i64,
    pub coins: i64,
    #[serde(rename = "rankName")]
    pub rank_name: Option<String>,
    #[serde(rename = "rankIconUrl")]
    pub rank_icon_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProfilesResponse {
    profiles: Vec<CharacterProfile>,
}

/// Holt alle Charakterprofile für die übergebene Spieler-UUID (mit oder
/// ohne Bindestriche, wird intern normalisiert). Gibt eine leere Liste
/// zurück, falls der Spieler noch nie ein MMOProfiles-Profil angelegt hat.
pub async fn fetch_profiles(client: &reqwest::Client, uuid: &str) -> Result<Vec<CharacterProfile>> {
    let dashed = to_dashed_uuid(uuid);

    let response = client
        .get(crate::config::ERZMARK_PROFILES_API_URL)
        .query(&[("uuid", dashed.as_str())])
        .send()
        .await
        .context("Spielstände-API nicht erreichbar (ist erzmark.de online?)")?;

    if !response.status().is_success() {
        anyhow::bail!("Spielstände-API antwortete mit Fehler ({})", response.status());
    }

    let parsed: ProfilesResponse = response
        .json()
        .await
        .context("Ungültige Antwort der Spielstände-API")?;

    Ok(parsed.profiles)
}

/// Siehe `friends.rs::to_dashed_uuid` – bewusst dupliziert statt geteilt, um
/// dieses kleine, unabhängige Modul nicht an `friends.rs` zu koppeln.
fn to_dashed_uuid(uuid: &str) -> String {
    if uuid.contains('-') || uuid.len() != 32 {
        return uuid.to_string();
    }

    format!(
        "{}-{}-{}-{}-{}",
        &uuid[0..8],
        &uuid[8..12],
        &uuid[12..16],
        &uuid[16..20],
        &uuid[20..32]
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds_dashes_to_plain_uuid() {
        let plain = "0fabf5fb1c9d41aba45c07162870aa19";
        assert_eq!(plain.len(), 32);
        let dashed = to_dashed_uuid(plain);
        assert_eq!(dashed, "0fabf5fb-1c9d-41ab-a45c-07162870aa19");
    }

    #[test]
    fn leaves_dashed_uuid_unchanged() {
        let dashed = "0fabf5fb-1c9d-41ab-a45c-07162870aa19";
        assert_eq!(to_dashed_uuid(dashed), dashed);
    }
}
