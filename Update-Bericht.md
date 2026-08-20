# 🚀 Erzmark – Update-Bericht

*Stand: 12.07.2026*

Dieses Update ist diesmal richtig vollgepackt — Server, App, Website und
Launcher haben alle etwas abbekommen! 🎉

## 🎮 Server & Gameplay

- 🎬 **Neues Scenes-Plugin**: Ermöglicht das Anzeigen und Steuern von
  inszenierten Szenen/Sequenzen auf dem Server (z. B. für Events,
  Zwischensequenzen oder besondere Momente im Spielgeschehen).
- 💃 **Verbesserte Skin-Animation**: Skins bewegen sich jetzt flüssiger und
  wirken insgesamt lebendiger als zuvor.
- 🧢 **Erleichtertes Skin-Setting**: Der Skin lässt sich jetzt einfacher und
  mit weniger Schritten einstellen/wechseln als vorher.
- ⚡ **Optimierte Rechenleistung**: Der Server läuft jetzt effizienter,
  wodurch Serverlast/Rechenaufwand reduziert wurde – spürbar flüssigere
  Performance.

## 📱 Erzmark App (Mobile)

- 🔐 **Kompletter Minecraft-Login**: Anmeldung per Microsoft-Konto läuft
  jetzt Ende-zu-Ende (Microsoft-OAuth2 → Xbox Live → XSTS → Minecraft),
  genau wie im Desktop-Launcher — kein eigenes Erzmark-Passwort nötig.
- 🧑‍🤝‍🧑 **Profil-Auswahl**: Zeigt jetzt echte Charakterprofile an (MMOProfiles),
  inkl. "Abmelden"-Möglichkeit direkt auf dem Auswahl-Bildschirm.
- 🖼️ **Eigenes App-Icon**: Das Erzmark-Logo ist jetzt das offizielle
  App-Icon (Android + iOS).
- 🔄 **Update-Bildschirm fertig**: Die App erkennt jetzt automatisch neue
  Versionen — kleine Änderungen laden sich direkt nach (kein Store nötig),
  größere Updates verweisen sauber auf den Store.
- 🛠️ **Build-Pipeline eingerichtet**: Cloud-Builds über EAS aufgesetzt
  (kein lokales Android-Studio nötig), damit neue Versionen jederzeit
  gebaut und verteilt werden können.

## 🌐 Erzmark-Website / Server-Backend

- 🪪 **Sicherer Account-Austausch**: Der Minecraft-Login der App wird jetzt
  serverseitig noch einmal echt geprüft und automatisch mit einem
  erzmark.de-Konto verknüpft (bzw. beim ersten Mal automatisch angelegt) —
  komplett ohne zusätzliches Passwort.
- 📋 **Neuer Profile-Endpunkt**: Liefert der App die echten Charakterprofile
  samt zuletzt gespielter Klasse.
- 🆕 **Neuer Update-Check-Endpunkt**: Sagt der App, ob eine neue Version
  verfügbar ist und wo sie zu finden ist.
- 🐛 **Sauberere Fehlermeldungen**: API-Fehler kommen jetzt als ordentliches
  JSON statt kryptischer HTML-Seiten zurück.

## 🖥️ Erzmark Launcher (Desktop, Open Source)

Der Launcher ist quelloffen gebaut mit **Tauri (Rust) + React** — hier ein
detaillierterer Einblick, was technisch alles drinsteckt:

- 🔐 **Microsoft/Xbox/Minecraft-Login**: Authorization-Code-Flow + PKCE über
  den System-Browser (kein Client-Secret nötig, da "public client"), danach
  Xbox-Live- und XSTS-Autorisierung und schließlich der eigentliche
  Minecraft-Login. Genau dieser bewährte Code diente jetzt auch als Vorlage
  für den neuen Login in der Mobile App — beide nutzen dieselbe, einmal
  registrierte Microsoft-App.
- 🔑 **Sichere Token-Speicherung**: Der Microsoft-Refresh-Token landet im
  OS-eigenen Schlüsselbund (Windows Credential Manager / macOS Keychain /
  Linux Secret Service), mit einem AES-256-GCM-verschlüsselten Datei-Fallback
  für Systeme ohne verfügbaren Schlüsselbund.
- 📦 **Manifest-basiertes Update-System**: Der Launcher lädt bei jedem Start
  ein `manifest.json` von erzmark.de, vergleicht die Version und prüft jede
  Moddatei/jedes Ressourcenpaket per SHA-256-Hash — nur was sich geändert
  hat, wird neu heruntergeladen.
- ☕ **Automatischer Java- & Loader-Download**: Die passende Java-Runtime
  sowie der Fabric-Loader werden automatisch in der richtigen Version
  heruntergeladen und eingerichtet — kein manuelles Java-Management nötig.
- 🎯 **Ein-Klick-Verbindung zum Server**: Über Minecrafts natives
  Quick-Play-Multiplayer-Feature verbindet sich der Client direkt mit
  `erzmark.de:25565`, ganz ohne eigenen Mod oder Umweg über das Hauptmenü.
- 👥 **Freundesliste**: Zeigt an, welche Freunde gerade online sind.
- 🧑‍🎤 **Profil-/Charakterverwaltung**: Unterstützt die MMOProfiles-
  Mehrfachcharaktere desselben Accounts (Klassenwahl direkt im Launcher).
- 🖌️ **Skin-Verwaltung**: Skins ansehen und verwalten, direkt im Launcher.
- 📰 **News-Feed & Events**: Aktuelle Server-News sowie ein Event-Kalender
  sind direkt im Launcher eingebaut, kein Website-Umweg nötig.
- 📸 **Screenshot-Verwaltung**: Ingame-Screenshots lassen sich direkt aus
  dem Launcher heraus einsehen/verwalten.
- ⚙️ **Einstellungen**: Eigener Settings-Bereich für die Launcher-
  Konfiguration.

Da alles quelloffen ist, kann sich jeder den kompletten Code dazu selbst
ansehen — Transparenz ist uns wichtig! 💛

---

*Hinweis: Falls noch weitere Punkte dazukommen sollen, einfach nachreichen
— die Liste lässt sich jederzeit ergänzen.* ✍️
