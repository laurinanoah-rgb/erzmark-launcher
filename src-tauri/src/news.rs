//! Erzmark-Neuigkeiten (Blogbeiträge von erzmark.de) im Launcher anzeigen.
//!
//! Die Webseite läuft auf MineTrax (Laravel + Inertia.js/Vue) und stellt
//! keine öffentliche JSON-API für News bereit. Die Neuigkeiten-Seite
//! (erzmark.de/news) rendert serverseitig aber ein
//! `<script data-page="app" type="application/json">{...}</script>` mit der
//! kompletten Inertia-Page-Payload (Standardverhalten für den initialen,
//! nicht-XHR-Seitenaufruf) – daraus extrahieren wir die Neuigkeiten-Liste,
//! ganz ohne Änderungen an der Webseite selbst. Struktur live verifiziert:
//! `props.newses.data[]` mit Feldern wie `title`, `slug`, `published_at`,
//! `body_html_small`, `photo_url`, `creator.name`.

use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use serde_json::Value;

const NEWS_PAGE_URL: &str = "https://erzmark.de/news";
const SCRIPT_MARKER: &str = "data-page=\"app\" type=\"application/json\">";

#[derive(Debug, Clone, Serialize)]
pub struct NewsPost {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub url: String,
    pub published_at: Option<String>,
    pub is_pinned: bool,
    pub excerpt_html: String,
    pub author_name: String,
    pub thumbnail_data_url: Option<String>,
}

/// Lädt die neuesten Neuigkeiten von erzmark.de/news. Läuft rein lesend
/// gegen die öffentliche Seite, kein Login/API-Key nötig.
pub async fn fetch_latest(client: &reqwest::Client, limit: usize) -> Result<Vec<NewsPost>> {
    let html = client
        .get(NEWS_PAGE_URL)
        .send()
        .await
        .context("Erzmark-Neuigkeiten nicht erreichbar (ist erzmark.de online?)")?
        .text()
        .await
        .context("Konnte Neuigkeiten-Seite nicht lesen")?;

    let payload = extract_inertia_payload(&html)
        .context("Konnte eingebettete Seitendaten nicht finden (hat sich die Webseite geändert?)")?;

    let data: Value =
        serde_json::from_str(payload).context("Ungültige eingebettete Seitendaten (kein gültiges JSON)")?;

    let items = data
        .pointer("/props/newses/data")
        .and_then(|v| v.as_array())
        .context("Keine Neuigkeiten-Liste in den Seitendaten gefunden")?;

    let mut result = Vec::new();
    for item in items.iter().take(limit) {
        let (Some(title), Some(slug)) = (
            item.get("title").and_then(|v| v.as_str()),
            item.get("slug").and_then(|v| v.as_str()),
        ) else {
            continue;
        };

        let id = item.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        let published_at = item
            .get("published_at")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let is_pinned = item.get("is_pinned").and_then(|v| v.as_bool()).unwrap_or(false);
        let excerpt_html = item
            .get("body_html_small")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let author_name = item
            .pointer("/creator/name")
            .and_then(|v| v.as_str())
            .unwrap_or("Erzmark-Team")
            .to_string();
        let photo_url = item.get("photo_url").and_then(|v| v.as_str());

        let thumbnail_data_url = match photo_url {
            Some(url) => download_thumbnail(client, url).await.ok(),
            None => None,
        };

        result.push(NewsPost {
            id,
            title: title.to_string(),
            slug: slug.to_string(),
            url: format!("https://erzmark.de/news/{slug}"),
            published_at,
            is_pinned,
            excerpt_html,
            author_name,
            thumbnail_data_url,
        });
    }

    Ok(result)
}

/// Sucht das Inertia-Payload-Script im HTML und liefert dessen Roh-JSON
/// (ohne umschließende Tags) zurück. Die Seite serialisiert Schrägstriche als
/// `\/`, wodurch ein rohes `</script>` innerhalb des JSON-Inhalts nicht
/// vorkommen kann – die einfache Trennzeichen-Suche ist damit sicher.
fn extract_inertia_payload(html: &str) -> Option<&str> {
    let start_idx = html.find(SCRIPT_MARKER).map(|i| i + SCRIPT_MARKER.len())?;
    let rest = &html[start_idx..];
    let end_idx = rest.find("</script>")?;
    Some(&rest[..end_idx])
}

/// Lädt ein Vorschaubild herunter und verkleinert es zu einem kompakten
/// JPEG (als Data-URL), analog zur Screenshot-Galerie – hält die
/// Datenmenge gering und vermeidet Änderungen an der Content-Security-Policy.
async fn download_thumbnail(client: &reqwest::Client, url: &str) -> Result<String> {
    let bytes = client
        .get(url)
        .send()
        .await
        .context("Vorschaubild nicht erreichbar")?
        .bytes()
        .await
        .context("Konnte Vorschaubild nicht laden")?;

    let img = image::load_from_memory(&bytes).context("Konnte Vorschaubild nicht dekodieren")?;
    let thumb = image::DynamicImage::ImageRgb8(img.thumbnail(240, 140).to_rgb8());

    let mut buf = Vec::new();
    thumb
        .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Jpeg)
        .context("Konnte Vorschaubild nicht kodieren")?;

    Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(&buf)))
}
