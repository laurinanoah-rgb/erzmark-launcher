//! Online-Status-Abfrage (read-only), backed von CloudNets eigener REST-API
//! über `public/launcher/network-status.php` – netzwerkweit korrekt und
//! unabhängig von MMOProfiles (im Gegensatz zur alten, verworfenen
//! `lastloginapi_players`-Datenquelle, siehe Git-Historie).
//!
//! Wird nach dem Spielstart periodisch aufgerufen, um Minecraft automatisch
//! zu beenden, sobald der Spieler das Erzmark-CloudNet-Netzwerk komplett
//! verlassen hat – Quick-Play (`--quickPlayMultiplayer`) tut das entgegen
//! ursprünglicher Annahme NICHT von selbst.

use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct StatusResponse {
    online: Option<bool>,
}

/// Liefert `Some(true)`/`Some(false)`, falls der Status bekannt ist, sonst
/// `None` (Spieler unbekannt, Netzwerkfehler, kaputte Antwort o. Ä.) – bei
/// `None` wird bewusst NICHT gekillt, um niemanden versehentlich beim
/// Einloggen oder bei einem kurzen Netz-Hänger rauszuwerfen.
pub async fn is_online(client: &reqwest::Client, uuid: &str) -> Option<bool> {
    let dashed = to_dashed_uuid(uuid);

    let response = match client
        .get(crate::config::ERZMARK_NETWORK_STATUS_API_URL)
        .query(&[("uuid", dashed.as_str())])
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[network-poll] HTTP-Request fehlgeschlagen: {e:?}");
            return None;
        }
    };

    let status = response.status();
    if !status.is_success() {
        eprintln!("[network-poll] API antwortete mit Status {status}");
        return None;
    }

    let body = match response.text().await {
        Ok(b) => b,
        Err(e) => {
            eprintln!("[network-poll] Antwort konnte nicht gelesen werden: {e:?}");
            return None;
        }
    };

    match serde_json::from_str::<StatusResponse>(&body) {
        Ok(parsed) => parsed.online,
        Err(e) => {
            eprintln!("[network-poll] Antwort war kein gültiges JSON ({e:?}): {body}");
            None
        }
    }
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
