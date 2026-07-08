//! Spielstände (MMOCore-Klassen/-Profile) im Launcher anzeigen.
//!
//! Der Server nutzt MMOCore mit MySQL-Backend (Tabelle `mmocore_playerdata`,
//! `uuid` = echte Mojang-Account-UUID als Primärschlüssel). Die aktive Klasse
//! liegt direkt in den Spalten der Zeile, alle weiteren vom Spieler
//! angelegten Klassen (MMOProfiles) stecken als JSON im Feld `class_info`.
//! Der Launcher hat **keinen** direkten Datenbankzugriff – stattdessen liest
//! ein kleines read-only PHP-Skript (`public/launcher/profiles.php` auf
//! erzmark.de, nutzt denselben `erzmark_readonly`-MySQL-User wie
//! `friends.rs`) die Daten aus und liefert sie als JSON.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CharacterProfile {
    pub class: String,
    pub active: bool,
    pub level: i32,
    pub experience: f64,
    pub health: Option<f64>,
    pub mana: Option<f64>,
    pub stamina: Option<f64>,
    pub stellium: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct ProfilesResponse {
    profiles: Vec<CharacterProfile>,
}

/// Holt alle Klassen/Profile für die übergebene Spieler-UUID (mit oder ohne
/// Bindestriche, wird intern normalisiert). Gibt eine leere Liste zurück,
/// falls der Spieler noch nie mit MMOCore gespielt hat.
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
