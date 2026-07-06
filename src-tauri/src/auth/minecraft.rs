//! Letzter Schritt der Auth-Chain: Xbox-XSTS-Token gegen einen
//! Minecraft-Access-Token tauschen, Besitz prüfen, Profil (Name/UUID) laden.

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::auth::xbox::XstsResult;
use crate::config;

#[derive(Debug, Clone)]
pub struct MinecraftAuth {
    pub access_token: String,
    pub expires_in: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinecraftProfile {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub skins: Vec<serde_json::Value>,
}

pub async fn login_with_xbox(xsts: &XstsResult) -> Result<MinecraftAuth> {
    let client = reqwest::Client::new();
    let identity_token = format!("XBL3.0 x={};{}", xsts.user_hash, xsts.token);

    let resp = client
        .post(config::MC_LOGIN_URL)
        .json(&json!({ "identityToken": identity_token }))
        .send()
        .await
        .context("Minecraft-Login fehlgeschlagen (Netzwerk?)")?;

    if !resp.status().is_success() {
        return Err(anyhow!(
            "Minecraft-Login fehlgeschlagen: {}",
            resp.text().await.unwrap_or_default()
        ));
    }

    #[derive(Deserialize)]
    struct Raw {
        access_token: String,
        expires_in: u64,
    }
    let raw: Raw = resp
        .json()
        .await
        .context("Ungültige Antwort beim Minecraft-Login")?;

    Ok(MinecraftAuth {
        access_token: raw.access_token,
        expires_in: raw.expires_in,
    })
}

/// Prüft, ob der Account Minecraft besitzt (gekauft oder Game Pass). Manche
/// Umgebungen liefern hier gelegentlich Fehler, ohne dass der Account
/// tatsächlich kein Minecraft besitzt – siehe `owns_game`-Aufrufer, der bei
/// einem Request-Fehler wohlwollend `true` annimmt und stattdessen erst beim
/// Profil-Abruf hart scheitert, falls wirklich kein Account existiert.
pub async fn owns_game(mc_access_token: &str) -> Result<bool> {
    let client = reqwest::Client::new();
    let resp = client
        .get(config::MC_ENTITLEMENTS_URL)
        .bearer_auth(mc_access_token)
        .send()
        .await
        .context("Entitlement-Check fehlgeschlagen (Netzwerk?)")?;

    if !resp.status().is_success() {
        return Ok(false);
    }

    let value: serde_json::Value = resp.json().await.unwrap_or_default();
    let items = value.get("items").and_then(|v| v.as_array());
    Ok(items.map(|arr| !arr.is_empty()).unwrap_or(false))
}

pub async fn fetch_profile(mc_access_token: &str) -> Result<MinecraftProfile> {
    let client = reqwest::Client::new();
    let resp = client
        .get(config::MC_PROFILE_URL)
        .bearer_auth(mc_access_token)
        .send()
        .await
        .context("Profil-Abruf fehlgeschlagen (Netzwerk?)")?;

    if !resp.status().is_success() {
        return Err(anyhow!(
            "Profil-Abruf fehlgeschlagen (kein Minecraft-Account auf diesem Microsoft-Konto?): {}",
            resp.text().await.unwrap_or_default()
        ));
    }

    resp.json::<MinecraftProfile>()
        .await
        .context("Ungültige Profil-Antwort")
}
