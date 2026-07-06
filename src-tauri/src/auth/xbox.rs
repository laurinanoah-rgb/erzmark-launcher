//! Xbox Live + XSTS Auth-Chain. Zwischenschritt zwischen Microsoft-OAuth und
//! Minecraft-Login: Minecraft-Accounts hängen technisch an Xbox-Live-Profilen.

use anyhow::{anyhow, Context, Result};
use serde::Deserialize;
use serde_json::json;

use crate::config;

#[derive(Debug, Clone)]
pub struct XstsResult {
    pub token: String,
    pub user_hash: String,
}

#[derive(Debug, Deserialize)]
struct XblResponse {
    #[serde(rename = "Token")]
    token: String,
    #[serde(rename = "DisplayClaims")]
    display_claims: DisplayClaims,
}

#[derive(Debug, Deserialize)]
struct DisplayClaims {
    xui: Vec<XuiEntry>,
}

#[derive(Debug, Deserialize)]
struct XuiEntry {
    uhs: String,
}

/// Schritt 1 (Xbox Live) + Schritt 2 (XSTS) der Auth-Chain.
pub async fn authenticate_xbox_live(ms_access_token: &str) -> Result<XstsResult> {
    let client = reqwest::Client::new();

    let xbl_body = json!({
        "Properties": {
            "AuthMethod": "RPS",
            "SiteName": "user.auth.xboxlive.com",
            "RpsTicket": format!("d={ms_access_token}")
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT"
    });

    let xbl_resp = client
        .post(config::XBOX_AUTH_URL)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&xbl_body)
        .send()
        .await
        .context("Xbox-Live-Authentifizierung fehlgeschlagen (Netzwerk?)")?;

    if !xbl_resp.status().is_success() {
        return Err(anyhow!(
            "Xbox-Live-Authentifizierung fehlgeschlagen: {}",
            xbl_resp.text().await.unwrap_or_default()
        ));
    }

    let xbl: XblResponse = xbl_resp
        .json()
        .await
        .context("Ungültige Xbox-Live-Antwort")?;

    let xsts_body = json!({
        "Properties": {
            "SandboxId": "RETAIL",
            "UserTokens": [xbl.token]
        },
        "RelyingParty": "rp://api.minecraftservices.com/",
        "TokenType": "JWT"
    });

    let xsts_resp = client
        .post(config::XSTS_AUTH_URL)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&xsts_body)
        .send()
        .await
        .context("XSTS-Autorisierung fehlgeschlagen (Netzwerk?)")?;

    if xsts_resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        let text = xsts_resp.text().await.unwrap_or_default();
        // XErr 2148916233 = kein Xbox-Live-Account, 2148916238 = Kinderkonto ohne
        // Zustimmung eines Erziehungsberechtigten, u.a. - hilfreich beim Debuggen.
        return Err(anyhow!(
            "XSTS-Autorisierung abgelehnt (evtl. kein Xbox-Profil angelegt oder Kinderkonto ohne Freigabe): {text}"
        ));
    }
    if !xsts_resp.status().is_success() {
        return Err(anyhow!(
            "XSTS-Autorisierung fehlgeschlagen: {}",
            xsts_resp.text().await.unwrap_or_default()
        ));
    }

    let xsts: XblResponse = xsts_resp
        .json()
        .await
        .context("Ungültige XSTS-Antwort")?;

    let user_hash = xsts
        .display_claims
        .xui
        .first()
        .map(|e| e.uhs.clone())
        .ok_or_else(|| anyhow!("Kein User-Hash (uhs) in der XSTS-Antwort enthalten"))?;

    Ok(XstsResult {
        token: xsts.token,
        user_hash,
    })
}
