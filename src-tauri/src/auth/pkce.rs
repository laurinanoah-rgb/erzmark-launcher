//! PKCE (Proof Key for Code Exchange) Hilfsfunktionen für den Authorization
//! Code Flow. Notwendig, weil der Launcher ein "public client" ist (kein
//! Client Secret) – PKCE verhindert, dass ein abgefangener Code ohne den
//! passenden Verifier eingelöst werden kann.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use sha2::{Digest, Sha256};

pub struct Pkce {
    pub verifier: String,
    pub challenge: String,
}

pub fn generate() -> Pkce {
    let mut bytes = [0u8; 64];
    rand::thread_rng().fill_bytes(&mut bytes);
    let verifier = URL_SAFE_NO_PAD.encode(bytes);

    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());

    Pkce { verifier, challenge }
}

/// Zufälliger `state`-Parameter gegen CSRF / um Redirects zuzuordnen.
pub fn generate_state() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}
