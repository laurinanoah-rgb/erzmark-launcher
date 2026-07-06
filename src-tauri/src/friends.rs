//! Freundesliste (MMOCore) im Launcher anzeigen.
//!
//! Der Server nutzt MMOCore mit MySQL-Backend (Tabelle `mmocore_playerdata`,
//! Spalte `friends` = JSON-Array von Spieler-UUIDs; Namen + Online-Status
//! stammen aus `lastloginapi_players`). Der Launcher hat **keinen** direkten
//! Datenbankzugriff – stattdessen liest ein kleines read-only PHP-Skript
//! (`public/launcher/friends.php` auf erzmark.de, nutzt einen eigenen
//! MySQL-User mit nur SELECT-Rechten) die Daten aus und liefert sie als JSON.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FriendEntry {
    pub uuid: String,
    pub name: String,
    pub online: bool,
    #[serde(rename = "lastSeen")]
    pub last_seen: i64,
}

#[derive(Debug, Deserialize)]
struct FriendsResponse {
    friends: Vec<FriendEntry>,
}

/// Holt die Freundesliste für die übergebene Spieler-UUID. `uuid` kann mit
/// oder ohne Bindestriche übergeben werden – wird intern normalisiert, da
/// Mojangs Profil-API UUIDs ohne Bindestriche liefert, die Datenbank sie aber
/// im Standardformat (mit Bindestrichen) speichert.
pub async fn fetch_friends(client: &reqwest::Client, uuid: &str) -> Result<Vec<FriendEntry>> {
    let dashed = to_dashed_uuid(uuid);

    let response = client
        .get(crate::config::ERZMARK_FRIENDS_API_URL)
        .query(&[("uuid", dashed.as_str())])
        .send()
        .await
        .context("Freunde-API nicht erreichbar (ist erzmark.de online?)")?;

    if !response.status().is_success() {
        anyhow::bail!("Freunde-API antwortete mit Fehler ({})", response.status());
    }

    let parsed: FriendsResponse = response
        .json()
        .await
        .context("Ungültige Antwort der Freunde-API")?;

    Ok(parsed.friends)
}

/// Wandelt eine UUID ohne Bindestriche (`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`) in
/// das Standardformat (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) um. Ist die
/// UUID bereits im Standardformat (oder unerwartet lang/kurz), wird sie
/// unverändert zurückgegeben.
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
