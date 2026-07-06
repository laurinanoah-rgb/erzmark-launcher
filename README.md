# Erzmark Launcher

Desktop-Launcher für den Erzmark Minecraft-Server (Tauri + React).

**Aktueller Stand:** Grundgerüst + Microsoft-OAuth2-Login-Flow. Siehe `PLANNING.md`
für Architekturentscheidungen (Manifest-Struktur, Azure-Setup, Auto-Connect).
Manifest/Update-System, Minecraft-Start und Branding-Feinschliff folgen in den
nächsten Schritten.

## Voraussetzungen

- Node.js ≥ 18
- Rust (stable, via [rustup](https://rustup.rs))
- Tauri-Systemabhängigkeiten je Plattform: siehe
  [Tauri-Prerequisites](https://tauri.app/start/prerequisites/) (unter Windows
  wird Microsoft Edge WebView2 benötigt, das i. d. R. schon vorhanden ist)

## Setup

1. `npm install`
2. Azure-App-Registrierung anlegen (siehe `PLANNING.md`, Abschnitt 2) und die
   Client-ID in `src-tauri/src/config.rs` (`MS_CLIENT_ID`) eintragen.
3. `npm run tauri dev` – startet Vite-Dev-Server + Tauri-Fenster.

## Bekannte offene Punkte (dieser Schritt)

- `src-tauri/icons/` enthält noch keine echten Icons – siehe README dort.
- `theme.css` nutzt Platzhalter-Farben/Logo – Branding-Assets austauschen,
  sobald verfügbar.
- Diese Session konnte kein `cargo build`/`npm run tauri dev` ausführen
  (Sandbox ohne Virtualisierungsunterstützung). Der Code wurde sorgfältig auf
  Konsistenz geprüft (Command-Namen, Imports, Struct-Felder), aber noch nicht
  kompiliert – bitte beim ersten lokalen Build auftretende Fehler (z. B.
  abweichende Crate-Feature-Namen) melden, dann beheben wir das gemeinsam.
- Der Azure-Whitelist-Antrag für `api.minecraftservices.com` muss manuell über
  dein Microsoft-Konto gestellt werden (siehe `PLANNING.md`).

## Projektstruktur

```
src/                 React-Frontend
  api/auth.js         Tauri-Command-Wrapper
  components/         LoginScreen, MainScreen (Platzhalter), LoadingSpinner
  theme.css           zentrale Branding-Variablen
src-tauri/            Rust-Backend
  src/auth/            OAuth2 (PKCE), Xbox Live/XSTS, Minecraft-Auth, Token-Storage
  src/commands.rs      Tauri-Commands (login, try_restore_session, ensure_fresh_session, logout)
  src/config.rs        Endpunkte + Client-ID
  src/state.rs         In-Memory-Session-State
PLANNING.md            Architektur-Entscheidungen & Recherche-Ergebnisse
```
