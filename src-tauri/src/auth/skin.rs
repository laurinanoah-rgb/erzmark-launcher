//! Skin-Wechsler: nutzt Mojangs offizielle Skin-API direkt (kein Umweg über
//! die Erzmark-Webseite/einen zweiten Login nötig) – braucht nur den
//! Minecraft-Access-Token, den der Launcher durch den normalen
//! Microsoft/Xbox-Login sowieso schon besitzt. Endpunkte live gegen
//! wiki.vg/Mojang_API verifiziert.

use anyhow::{anyhow, Context, Result};
use reqwest::multipart;
use serde_json::json;

use crate::config;

/// Normalisiert auf die von Mojang erwarteten Werte ("classic"/"slim").
fn normalize_variant(variant: &str) -> &'static str {
    if variant.eq_ignore_ascii_case("slim") {
        "slim"
    } else {
        "classic"
    }
}

/// Setzt den Skin über eine öffentlich erreichbare Bild-URL (Mojang lädt das
/// Bild selbst herunter).
pub async fn set_skin_from_url(access_token: &str, variant: &str, url: &str) -> Result<()> {
    let client = reqwest::Client::new();
    let resp = client
        .post(config::MC_SKINS_URL)
        .bearer_auth(access_token)
        .json(&json!({ "variant": normalize_variant(variant), "url": url }))
        .send()
        .await
        .context("Skin-Änderung fehlgeschlagen (Netzwerk?)")?;

    if !resp.status().is_success() {
        return Err(anyhow!(
            "Skin-Änderung fehlgeschlagen: {}",
            resp.text().await.unwrap_or_default()
        ));
    }
    Ok(())
}

/// Lädt eine lokale PNG-Datei direkt zu Mojang hoch und setzt sie als Skin.
pub async fn upload_skin(access_token: &str, variant: &str, file_bytes: Vec<u8>, file_name: &str) -> Result<()> {
    let client = reqwest::Client::new();

    let file_part = multipart::Part::bytes(file_bytes)
        .file_name(file_name.to_string())
        .mime_str("image/png")
        .context("Ungültiger Dateityp (nur PNG erlaubt)")?;

    let form = multipart::Form::new()
        .text("variant", normalize_variant(variant).to_string())
        .part("file", file_part);

    let resp = client
        .post(config::MC_SKINS_URL)
        .bearer_auth(access_token)
        .multipart(form)
        .send()
        .await
        .context("Skin-Upload fehlgeschlagen (Netzwerk?)")?;

    if !resp.status().is_success() {
        return Err(anyhow!(
            "Skin-Upload fehlgeschlagen: {}",
            resp.text().await.unwrap_or_default()
        ));
    }
    Ok(())
}

/// Setzt den Skin auf den Standard (Steve/Alex) zurück.
pub async fn reset_skin(access_token: &str) -> Result<()> {
    let client = reqwest::Client::new();
    let resp = client
        .delete(config::MC_SKINS_ACTIVE_URL)
        .bearer_auth(access_token)
        .send()
        .await
        .context("Skin-Zurücksetzen fehlgeschlagen (Netzwerk?)")?;

    if !resp.status().is_success() {
        return Err(anyhow!(
            "Skin-Zurücksetzen fehlgeschlagen: {}",
            resp.text().await.unwrap_or_default()
        ));
    }
    Ok(())
}

/// Extrahiert die aktuell aktive Skin-URL aus dem rohen `skins`-Feld des
/// Profils (`MinecraftProfile.skins`), falls vorhanden.
pub fn active_skin_url(skins: &[serde_json::Value]) -> Option<String> {
    skins
        .iter()
        .find(|s| s.get("state").and_then(|v| v.as_str()) == Some("ACTIVE"))
        .and_then(|s| s.get("url").and_then(|v| v.as_str()))
        // Mojangs Session-Server liefert die Textur-URL oft als reines
        // `http://textures.minecraft.net/...` zurück. Unsere CSP (img-src)
        // erlaubt aus Sicherheitsgründen nur https – ohne diese Normalisierung
        // wird das Bild von der Webview stillschweigend geblockt (keine
        // Fehlermeldung, der Skin bleibt einfach unsichtbar).
        .map(|s| s.replacen("http://", "https://", 1))
}
