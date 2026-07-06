//! Sichere Speicherung des Microsoft-Refresh-Tokens.
//!
//! Primär: OS-Keychain über die `keyring`-Crate (Windows Credential Manager /
//! macOS Keychain / Linux Secret Service). Falls das auf einem System nicht
//! verfügbar ist (z. B. manche Linux-Distros ohne Secret-Service-Daemon),
//! Fallback auf eine lokal AES-256-GCM-verschlüsselte Datei im User-Config-
//! Verzeichnis. Der Fallback ist bewusst als Notlösung markiert – ein echter
//! OS-Keychain ist immer vorzuziehen.

use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::fs;
use std::path::PathBuf;

use crate::config;

fn keyring_entry() -> Result<keyring::Entry> {
    keyring::Entry::new(config::KEYRING_SERVICE, config::KEYRING_USER)
        .context("Konnte Keyring-Eintrag nicht erstellen")
}

fn config_dir() -> Result<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .context("APPDATA-Umgebungsvariable nicht gesetzt")
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var_os("HOME").context("HOME nicht gesetzt")?;
        Ok(PathBuf::from(home).join("Library/Application Support"))
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Some(xdg) = std::env::var_os("XDG_CONFIG_HOME") {
            return Ok(PathBuf::from(xdg));
        }
        let home = std::env::var_os("HOME").context("HOME nicht gesetzt")?;
        Ok(PathBuf::from(home).join(".config"))
    }
}

fn fallback_token_path() -> Result<PathBuf> {
    Ok(config_dir()?.join("erzmark-launcher").join("refresh_token.enc"))
}

fn fallback_key_path() -> Result<PathBuf> {
    Ok(config_dir()?.join("erzmark-launcher").join("keyfile.bin"))
}

fn load_or_create_fallback_key() -> Result<[u8; 32]> {
    let path = fallback_key_path()?;
    if let Ok(bytes) = fs::read(&path) {
        if bytes.len() == 32 {
            let mut key = [0u8; 32];
            key.copy_from_slice(&bytes);
            return Ok(key);
        }
    }

    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).ok();
    }
    fs::write(&path, key).context("Konnte lokalen Fallback-Schlüssel nicht schreiben")?;
    Ok(key)
}

pub fn save_refresh_token(token: &str) -> Result<()> {
    if let Ok(entry) = keyring_entry() {
        if entry.set_password(token).is_ok() {
            return Ok(());
        }
    }
    save_refresh_token_fallback(token)
}

pub fn load_refresh_token() -> Result<Option<String>> {
    if let Ok(entry) = keyring_entry() {
        match entry.get_password() {
            Ok(pw) => return Ok(Some(pw)),
            Err(keyring::Error::NoEntry) => return Ok(None),
            Err(_) => { /* Keychain evtl. nicht verfügbar -> Fallback-Datei prüfen */ }
        }
    }
    load_refresh_token_fallback()
}

pub fn clear_refresh_token() -> Result<()> {
    if let Ok(entry) = keyring_entry() {
        let _ = entry.delete_credential();
    }
    let path = fallback_token_path()?;
    if path.exists() {
        fs::remove_file(path).context("Konnte lokale Token-Datei nicht löschen")?;
    }
    Ok(())
}

fn save_refresh_token_fallback(token: &str) -> Result<()> {
    let key_bytes = load_or_create_fallback_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key_bytes).context("Ungültiger AES-Schlüssel")?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, token.as_bytes())
        .map_err(|e| anyhow::anyhow!("Verschlüsselung des Refresh-Tokens fehlgeschlagen: {e}"))?;

    let mut payload = nonce_bytes.to_vec();
    payload.extend(ciphertext);
    let encoded = STANDARD.encode(payload);

    let path = fallback_token_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).ok();
    }
    fs::write(path, encoded).context("Konnte Refresh-Token nicht lokal speichern")?;
    Ok(())
}

fn load_refresh_token_fallback() -> Result<Option<String>> {
    let path = fallback_token_path()?;
    if !path.exists() {
        return Ok(None);
    }

    let encoded = fs::read_to_string(&path).context("Konnte Token-Datei nicht lesen")?;
    let payload = STANDARD
        .decode(encoded.trim())
        .context("Ungültig kodierte Token-Datei")?;
    if payload.len() < 12 {
        return Ok(None);
    }
    let (nonce_bytes, ciphertext) = payload.split_at(12);

    let key_bytes = load_or_create_fallback_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key_bytes).context("Ungültiger AES-Schlüssel")?;
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| anyhow::anyhow!("Entschlüsselung des Refresh-Tokens fehlgeschlagen: {e}"))?;

    Ok(Some(
        String::from_utf8(plaintext).context("Entschlüsselte Daten sind kein gültiges UTF-8")?,
    ))
}
