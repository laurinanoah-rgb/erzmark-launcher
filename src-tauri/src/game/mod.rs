//! Manifest-Update-System + Minecraft-Download/Start.
//!
//! Grober Ablauf (siehe install.rs für die Orchestrierung im Detail):
//! 1. Erzmark-Manifest von erzmark.de laden (manifest.rs)
//! 2. Passende Vanilla-Minecraft-Version von Mojang laden (mojang.rs)
//! 3. Passenden Fabric-Loader laden (fabric.rs)
//! 4. Passende Java-Runtime sicherstellen (java.rs)
//! 5. Alles herunterladen + verifizieren (downloader.rs), lokalen Stand
//!    merken (install_state.rs)
//! 6. Spielstart mit Auto-Connect (launch.rs)

pub mod downloader;
pub mod fabric;
pub mod install;
pub mod install_state;
pub mod java;
pub mod launch;
pub mod manifest;
pub mod mojang;
pub mod paths;
pub mod player_status;
pub mod screenshots;
