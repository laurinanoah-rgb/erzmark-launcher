//! Zentrale Konfigurationswerte für Auth-Endpunkte und App-Identität.
//!
//! WICHTIG: `MS_CLIENT_ID` muss durch die echte Client-ID aus der
//! Azure-App-Registrierung ersetzt werden (siehe PLANNING.md, Abschnitt 2).
//! Kein Client Secret nötig/verwendet – der Launcher ist ein "public client"
//! (Authorization Code + PKCE).

pub const MS_CLIENT_ID: &str = "980ac0c7-7165-4a8b-8685-8eb070bacb46";

// Consumers-Tenant ist für XboxLive.signin zwingend (siehe PLANNING.md).
pub const MS_AUTHORIZE_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
pub const MS_TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
pub const MS_SCOPES: &str = "XboxLive.signin offline_access";

pub const XBOX_AUTH_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
pub const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";

pub const MC_LOGIN_URL: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
pub const MC_ENTITLEMENTS_URL: &str = "https://api.minecraftservices.com/entitlements/mcstore";
pub const MC_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";
pub const MC_SKINS_URL: &str = "https://api.minecraftservices.com/minecraft/profile/skins";
pub const MC_SKINS_ACTIVE_URL: &str = "https://api.minecraftservices.com/minecraft/profile/skins/active";

/// Mojangs öffentlicher Session-Server – liefert Skin/Cape-Texturen zu einer
/// beliebigen UUID ohne eigenes Auth (nur für die eigene, per Xbox/MS
/// eingeloggte Session braucht es den Umweg über `MC_PROFILE_URL`). Genutzt
/// für die Freundes-Skins im "Sozialer Modus" des Skin Mirrors (Launcher-
/// Update-TODO, Abschnitt 2) – `{uuid}` wird ohne Bindestriche angehängt.
pub const MOJANG_SESSION_SERVER_PROFILE_URL: &str =
    "https://sessionserver.mojang.com/session/minecraft/profile";

pub const KEYRING_SERVICE: &str = "de.erzmark.launcher";
pub const KEYRING_USER: &str = "ms-refresh-token";

// ---- Manifest-/Update-System für die Spieldateien (nicht zu verwechseln mit
// dem Launcher-Selbst-Update über tauri-plugin-updater) ----

/// Cache-Busting per Query-Parameter (siehe manifest.rs), damit CDN-/Browser-
/// Caching kein veraltetes Manifest ausliefert.
pub const ERZMARK_MANIFEST_URL: &str = "https://erzmark.de/launcher/manifest.json";

/// Ziel-Server für den automatischen Multiplayer-Connect beim Spielstart
/// (siehe PLANNING.md, Abschnitt 3 – `--quickPlayMultiplayer`).
pub const ERZMARK_SERVER_ADDRESS: &str = "erzmark.de:25565";

pub const MOJANG_VERSION_MANIFEST_URL: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

pub const JAVA_RUNTIME_INDEX_URL: &str =
    "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json";

pub const FABRIC_META_LOADER_BASE: &str = "https://meta.fabricmc.net/v2/versions/loader";
pub const FABRIC_MAVEN_BASE: &str = "https://maven.fabricmc.net/";

/// Beliebige, aber stabile Kennung für den `${clientid}`-Platzhalter beim
/// Spielstart (Minecraft nutzt das intern u. a. fürs Analytics/Telemetrie-
/// Handling – kein Bezug zur Azure-Client-ID).
pub const MC_LAUNCHER_CLIENT_ID: &str = "erzmark-launcher";
pub const LAUNCHER_NAME: &str = "Erzmark Launcher";

/// Read-only Freunde-API (kleines eigenes PHP-Skript auf erzmark.de, liest
/// MMOCore-Freundeslisten + Online-Status aus MySQL – der Launcher hat nie
/// direkten Datenbankzugriff, siehe PLANNING.md).
pub const ERZMARK_FRIENDS_API_URL: &str = "https://erzmark.de/launcher/friends.php";

/// Read-only Online-Status-API (alte Datenquelle: `lastloginapi_players`).
/// UNZUVERLÄSSIG – dieses (von MMOCore unabhängige) Plugin vergibt pro
/// Verbindung/Profil-Auswahl offenbar eigene synthetische UUID-Zeilen,
/// wodurch der echte Mojang-Account-Datensatz während des Spielens nicht
/// aktualisiert wird (false-positive "offline" nach kurzer Zeit). MMOCores
/// eigene Tabelle (`mmocore_playerdata`, siehe `profiles.rs`) nutzt dagegen
/// korrekt eine Zeile pro echter Account-UUID – das UUID-Problem liegt also
/// nur bei diesem einen Plugin. Bleibt nur als totes Skript auf dem Server,
/// wird vom Launcher nicht mehr angesprochen – siehe
/// ERZMARK_NETWORK_STATUS_API_URL.
#[allow(dead_code)]
pub const ERZMARK_PLAYER_STATUS_API_URL: &str = "https://erzmark.de/launcher/player-status.php";

/// Read-only Netzwerk-Status-API, backed by CloudNets eigener REST-API
/// (`CloudNet-Rest`-Modul, `GET /player/online/{uuid}/exists`) statt der
/// unzuverlässigen `lastloginapi_players`-Tabelle. Netzwerkweit korrekt und
/// unabhängig von MMOProfiles, da CloudNet die echte Mojang-Account-UUID der
/// Session trackt. Wird nach dem Spielstart periodisch abgefragt, um
/// Minecraft automatisch zu beenden, sobald der Spieler das Erzmark-Netzwerk
/// (CloudNet) komplett verlässt (Quick-Play beendet den Client dafür
/// entgegen ursprünglicher Annahme NICHT automatisch).
pub const ERZMARK_NETWORK_STATUS_API_URL: &str = "https://erzmark.de/launcher/network-status.php";

/// Read-only Spielstände-API (MMOCore-Klassen/-Profile: aktive Klasse +
/// alle weiteren, per `class_info` gespeicherten Klassen desselben Accounts).
/// Nutzt dieselbe `mmocore_playerdata`-Tabelle wie die Freundesliste, aber
/// direkt über die echte Account-UUID als Primärschlüssel – siehe
/// `profiles.rs`.
pub const ERZMARK_PROFILES_API_URL: &str = "https://erzmark.de/launcher/profiles.php";

// ---- app-api (Sanctum-authentifiziert, gleicher Unterbau wie die Mobile
// App, siehe erzmark-app-mobile/src/api/auth.js + AppAuthController.php) ----

/// Tauscht den bereits verifizierten Minecraft-Access-Token gegen einen
/// Sanctum-Bearer-Token, der danach für alle app-api/*-Endpunkte gilt.
pub const ERZMARK_APP_API_AUTH_URL: &str = "https://erzmark.de/api/app-api/auth/minecraft";

/// Offene Freundschaftsanfragen (Launcher-Update-TODO, Abschnitt 4, Teil 3).
pub const ERZMARK_FRIEND_REQUESTS_URL: &str = "https://erzmark.de/api/app-api/friend-requests";

/// Freund entfernen (22.07.2026, Nutzerwunsch).
pub const ERZMARK_FRIENDS_REMOVE_URL: &str = "https://erzmark.de/api/app-api/friends/remove";

/// Eigene MMOProfiles-Charakterprofile inkl. Account-Profilbild/-Titelbild
/// (22.07.2026) - im Gegensatz zu ERZMARK_PROFILES_API_URL (read-only, ohne
/// Auth, ohne Bild) hier über den Sanctum-Token, damit Foto/Cover ausgelesen
/// werden können (haengen am Account, siehe ProfileController::mine()).
pub const ERZMARK_PROFILE_MINE_URL: &str = "https://erzmark.de/api/app-api/profiles/mine";
pub const ERZMARK_PROFILE_PHOTO_URL: &str = "https://erzmark.de/api/app-api/profiles/photo";
pub const ERZMARK_PROFILE_COVER_URL: &str = "https://erzmark.de/api/app-api/profiles/cover";

/// Bio/Banner-Preset/vorgestellte Erfolge (23.07.2026) - dieselbe
/// Account-Zeile wie Profilbild/Titelbild, siehe ProfileController::
/// getCustomization()/updateCustomization() im Backend.
pub const ERZMARK_PROFILE_CUSTOMIZATION_URL: &str = "https://erzmark.de/api/app-api/profile/customization";
