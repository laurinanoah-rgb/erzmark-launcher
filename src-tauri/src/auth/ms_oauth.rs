//! Microsoft OAuth2: Authorization Code Flow + PKCE über den System-Browser.
//!
//! Ablauf:
//! 1. Lokalen HTTP-Server auf einem freien Port starten (Loopback-Redirect).
//! 2. System-Browser mit der Microsoft-Login-Seite öffnen.
//! 3. Nach Login leitet Microsoft an `http://127.0.0.1:<port>/callback` um –
//!    der lokale Server fängt das ab und liest den `code`.
//! 4. Code gegen Access-/Refresh-Token tauschen (inkl. PKCE-Verifier).
//!
//! Vorteil gegenüber Device-Code-Flow: keine manuelle Code-Eingabe, der
//! Nutzer meldet sich wie gewohnt im Browser an.

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};

use crate::auth::pkce;
use crate::config;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MsTokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
}

pub async fn login_interactive() -> Result<MsTokenResponse> {
    let pkce_pair = pkce::generate();
    let expected_state = pkce::generate_state();

    let server = tiny_http::Server::http("127.0.0.1:0")
        .map_err(|e| anyhow!("Konnte lokalen Redirect-Server nicht starten: {e}"))?;
    let port = server
        .server_addr()
        .to_ip()
        .ok_or_else(|| anyhow!("Kein lokaler Port verfügbar"))?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}/callback");

    // `prompt=select_account` erzwingt Microsofts Kontoauswahl-Dialog bei
    // JEDEM interaktiven Login. Ohne das haelt der System-Browser die
    // Session vom letzten Login fest und meldet ohne Rueckfrage automatisch
    // mit demselben Konto an - es gibt dann keinen Weg mehr zurueck zur
    // Kontoauswahl, um ein anderes Microsoft-/Xbox-Konto zu verwenden
    // (Bug-Report, betraf Launcher UND Mobile App gleichermassen).
    let authorize_url = format!(
        "{base}?client_id={client_id}&response_type=code&redirect_uri={redirect}&response_mode=query&scope={scope}&code_challenge={challenge}&code_challenge_method=S256&state={state}&prompt=select_account",
        base = config::MS_AUTHORIZE_URL,
        client_id = config::MS_CLIENT_ID,
        redirect = urlencoding::encode(&redirect_uri),
        scope = urlencoding::encode(config::MS_SCOPES),
        challenge = pkce_pair.challenge,
        state = expected_state,
    );

    open::that(&authorize_url).context("Konnte den Standardbrowser nicht öffnen")?;

    let code = wait_for_redirect(server, expected_state).await?;
    exchange_code(&code, &redirect_uri, &pkce_pair.verifier).await
}

/// Blockiert (in einem eigenen Thread) auf den Loopback-Server, bis der
/// Redirect mit `code`/`state` eintrifft oder ein Timeout erreicht ist.
async fn wait_for_redirect(server: tiny_http::Server, expected_state: String) -> Result<String> {
    tokio::task::spawn_blocking(move || -> Result<String> {
        let deadline = Instant::now() + Duration::from_secs(300); // 5 Minuten
        loop {
            if Instant::now() > deadline {
                return Err(anyhow!(
                    "Login-Timeout: Es kam keine Antwort vom Browser (5 Minuten überschritten)"
                ));
            }

            let request = match server.recv_timeout(Duration::from_secs(1)) {
                Ok(Some(r)) => r,
                Ok(None) => continue,
                Err(e) => return Err(anyhow!("Fehler beim Warten auf den Redirect: {e}")),
            };

            let url = request.url().to_string();
            let parsed = url::Url::parse(&format!("http://127.0.0.1{url}"))
                .context("Ungültige Redirect-URL vom Browser erhalten")?;
            let params: HashMap<_, _> = parsed.query_pairs().into_owned().collect();

            let body = "<html><body style=\"font-family:sans-serif;text-align:center;margin-top:15vh\">\
                <h2>Erzmark Launcher</h2><p>Login abgeschlossen. Du kannst dieses Fenster jetzt schließen.</p>\
                </body></html>";
            let header = tiny_http::Header::from_bytes(
                &b"Content-Type"[..],
                &b"text/html; charset=utf-8"[..],
            )
            .expect("statischer Header ist immer gültig");
            let response = tiny_http::Response::from_string(body).with_header(header);
            let _ = request.respond(response);

            if let Some(err) = params.get("error") {
                let desc = params
                    .get("error_description")
                    .cloned()
                    .unwrap_or_default();
                return Err(anyhow!("Microsoft-Login abgelehnt: {err} {desc}"));
            }

            match (params.get("code"), params.get("state")) {
                (Some(code), Some(state)) if state == &expected_state => {
                    return Ok(code.clone());
                }
                (Some(_), Some(_)) => {
                    return Err(anyhow!(
                        "State-Parameter stimmt nicht überein (möglicher CSRF-Versuch, Login abgebrochen)"
                    ));
                }
                _ => continue,
            }
        }
    })
    .await
    .context("Redirect-Server-Task ist abgebrochen")?
}

async fn exchange_code(code: &str, redirect_uri: &str, verifier: &str) -> Result<MsTokenResponse> {
    let client = reqwest::Client::new();
    let params = [
        ("client_id", config::MS_CLIENT_ID),
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", redirect_uri),
        ("code_verifier", verifier),
    ];

    let resp = client
        .post(config::MS_TOKEN_URL)
        .form(&params)
        .send()
        .await
        .context("Token-Austausch-Request fehlgeschlagen (Netzwerk?)")?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(anyhow!("Token-Austausch fehlgeschlagen: {text}"));
    }

    resp.json::<MsTokenResponse>()
        .await
        .context("Ungültige Antwort beim Token-Austausch")
}

/// Erneuert Access-/Refresh-Token über den gespeicherten Refresh-Token
/// (`offline_access`-Scope). Wird beim Start (Auto-Login) sowie periodisch
/// vor Ablauf des Minecraft-Tokens aufgerufen.
pub async fn refresh(refresh_token: &str) -> Result<MsTokenResponse> {
    let client = reqwest::Client::new();
    let params = [
        ("client_id", config::MS_CLIENT_ID),
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
        ("scope", config::MS_SCOPES),
    ];

    let resp = client
        .post(config::MS_TOKEN_URL)
        .form(&params)
        .send()
        .await
        .context("Token-Refresh-Request fehlgeschlagen (Netzwerk?)")?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(anyhow!("Token-Refresh fehlgeschlagen: {text}"));
    }

    resp.json::<MsTokenResponse>()
        .await
        .context("Ungültige Antwort beim Token-Refresh")
}
