# Erzmark App (Mobile Companion)

Handy-App (Android + iOS) als Begleiter zum Erzmark-Minecraft-Server. Fokus:
Informationen unterwegs abrufen und mit anderen Spielern kommunizieren –
kein Minecraft-Client, sondern ein "zweiter Bildschirm" für den Server.

## Kernfunktionen (MVP)

- **Login mit Minecraft-Account** – exakt der gleiche Microsoft-OAuth2-Flow
  wie im Desktop-Launcher (`erzmark-launcher/src-tauri/src/auth/`). Kein
  eigenes Erzmark-Passwort, ein Account für Launcher + Website + App.
- **Gilden-Chat** – Textchat pro Gilde. Ein Spieler kann **mehreren Gilden**
  gleichzeitig beitreten und zwischen den Chats wechseln (Tab-/Liste-UI wie
  Discord-Server-Wechsel).
- **Update-Check beim Start** – wie im Launcher: "Update verfügbar, jetzt
  updaten"-Dialog. Wichtiger Unterschied zum Desktop-Launcher: eine Mobile-
  App kann sich nicht selbst per Datei-Download aktualisieren (App-Stores
  verbieten das). Zwei Ebenen:
  1. **Nativer Versions-Check** (neue Funktionen/native Module): Dialog
     verlinkt auf den Play-Store/App-Store-Eintrag.
  2. **OTA-JS-Update** (reine UI-/Logik-Änderungen ohne native Änderungen):
     über `expo-updates` – der Nutzer bekommt neue JS-Bundles quasi ohne
     Store-Update, sehr ähnlich zum Launcher-Gefühl. Deshalb unten Expo
     empfohlen statt "nacktem" React Native CLI.

## Tech-Stack

React Native, konkret über **Expo** (Managed Workflow):

- Eine Codebasis für Android + iOS.
- `expo-updates` für die OTA-Update-Erfahrung ("Update verfügbar").
- `expo-notifications` für Push (Boss-Event, Gildenchat-Nachricht, Freund
  online, Auktion überboten – siehe PLANNING.md).
- `expo-secure-store` für den sicheren Token-Speicher (Pendant zu Rust
  `keyring` im Launcher).
- `@react-navigation` für die Screen-Navigation.

Kein natives Xcode/Android-Studio-Setup nötig für den täglichen
Entwicklungsstand – Testen direkt per Expo-Go-App auf dem Handy.

> Dieser Ordner ist aktuell ein **Struktur-Grundgerüst** (Planung +
> Screen-/API-Stubs), noch kein fertig installierbares Projekt. Nächster
> Schritt: `npx create-expo-app` (oder `npm install` hier drin, sobald eine
> laufende Node-Umgebung verfügbar ist) und die Stubs mit echter Logik
> füllen.

## Backend

Kein neues Backend nötig für den Start – die App spricht dieselbe
erzmark.de-API wie der Launcher an (`erzmark_readonly`-DB-User, PHP-Endpunkte
unter `erzmark.de/api/` bzw. `erzmark.de/launcher/`). Für Gilden-Chat wird
zusätzlich ein Echtzeit-Kanal gebraucht (siehe PLANNING.md → "Realtime").

## Ordnerstruktur

```
erzmark-app-mobile/
  README.md              – dieses Dokument
  PLANNING.md             – Feature-Roadmap + Hype-Ideen-Brainstorm
  package.json            – geplante Dependencies (Expo/React Native)
  app.json                – Expo-Konfiguration (Name, Icon, Update-URL)
  src/
    screens/               – ein Screen pro Datei
    components/             – wiederverwendbare UI-Bausteine
    api/                    – Anbindung an erzmark.de (Auth, Gilden, Chat, Update-Check)
    navigation/              – React-Navigation-Setup
```
