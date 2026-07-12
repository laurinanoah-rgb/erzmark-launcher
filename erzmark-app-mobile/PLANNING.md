# Erzmark App – Feature-Roadmap & Hype-Ideen

## MVP (v0.1) – das Nötigste, was funktionieren muss

1. Login mit Minecraft-Account (Microsoft-OAuth2, wie Launcher).
2. Update-Check beim Start ("Update verfügbar, jetzt updaten").
3. Gilden-Anzeige: die eine MMOCore-Gilde des Spielers (Name, Tag,
   Mitglieder) - siehe "Technische Erkenntnis" unten, warum nicht mehrere.
4. Gilden-Chat: Text-Chat für die eigene Gilde.
5. Profil-Screen: eigener Skin (3D wie im Launcher), Charakter-Stats,
   zuletzt gespielte Klasse.
6. Server-Status: Spieleranzahl online, nächstes Boss-Event (Cooldown).

## Technische Erkenntnis: Gildensystem (09.07.)

Live auf dem Server geprüft: MMOCore hat ein eingebautes Gildensystem, aber
es speichert **als YAML-Dateien direkt auf dem Server**
(`plugins/MMOCore/guilds/<tag>.yml` unter dem `lobby-1`-Service), nicht in
MySQL - keine der elf geprüften Datenbanken hatte eine Gilden-/Party-/
Team-Tabelle. Format pro Datei:

```yaml
name: LNC
tag: LNC
owner: 5b0174eb-00eb-4a8d-8d41-35f0fdfef596
members:
- 5b0174eb-00eb-4a8d-8d41-35f0fdfef596
```

**Wichtigste Einschränkung:** Das Datenmodell ist strikt eine Gilde pro
Spieler, und MMOCore ist Closed-Source (Kaufplugin) - wir können das nicht
erweitern. Entscheidung (mit Nutzer abgestimmt): Die App zeigt bewusst nur
die eine MMOCore-Gilde pro Spieler statt eines eigenen Mehrfach-
Mitgliedschafts-Systems. Beitreten/Verlassen bleibt ein In-Game-Befehl -
die App liest nur (Name, Mitglieder, Chat), verwaltet keine Mitgliedschaft.

Da alles auf demselben Server läuft, kann der Laravel-Endpunkt die YAML-
Dateien direkt einlesen (`Symfony\Component\Yaml\Yaml::parseFile`, ist über
Laravel bereits verfügbar). Offener Punkt: prüfen ob `lobby-1` ein
"static service" ist (Pfad/Daten bleiben über Neustarts stabil) oder
CloudNet den Service bei Neustarts frisch aus einem Template erzeugt -
falls letzteres, müsste der Gilden-Ordner separat persistiert werden.

## Phase 2 – Bindung & Alltag

- Freundesliste mit Live-Online-Status (Push, wenn Freund online geht).
- Event-Kalender mit RSVP + Erinnerungs-Push kurz vor Start.
- Server-News-Feed (gleiche Quelle wie Launcher-Neuigkeiten) mit Push bei
  neuen Patchnotes.
- In-App-Support/Tickets statt "schreib im Discord".

## Realtime-Infrastruktur (Voraussetzung für Chat)

Gilden-Chat braucht einen Push-fähigen Kanal, kein reines Request-Response-
PHP. Optionen, grob nach Aufwand sortiert:

- **Pusher/Ably (Managed)** – schnellster Start, kein eigener Server nötig,
  aber laufende Kosten ab gewissem Volumen.
- **Laravel Reverb / Websockets auf dem Hetzner-Server** – da MineTrax
  bereits Laravel ist, würde sich Reverb (offizielles Laravel-Websocket-
  Paket) sauber einfügen und bleibt kostenlos/self-hosted.
- **Firebase Cloud Messaging** – nur für Push-Benachrichtigungen (nicht für
  Live-Chat-Sync), günstig/kostenlos, gut für "Freund online"/"Boss-Event"-
  Pushes.

Empfehlung: Laravel Reverb für den Chat selbst (passt zur bestehenden
Infrastruktur), FCM zusätzlich für Push-Benachrichtigungen auch wenn die App
im Hintergrund/geschlossen ist.

## Ideen, die richtig Hype auslösen könnten

Sortiert danach, wie viel "Wow"/virales Potenzial sie realistisch haben:

**1. Teilbare Charakter-Karte ("Visitenkarte")**
Ein Screen generiert automatisch ein hübsches, RPG-gestyltes Bild mit
Skin-Pose, Klasse, Level, Gilden-Wappen, besonderen Erfolgen – ein Tap auf
"Teilen" postet es direkt auf Discord/Instagram/WhatsApp. Das ist
erfahrungsgemäß der größte organische Wachstumstreiber: Spieler posten es
freiwillig, weil es gut aussieht, und jeder Post ist Werbung für den Server.

**2. AR-Skin-Viewer**
Kamera öffnen, eigener Skin erscheint lebensgroß im eigenen Zimmer (per
ARKit/ARCore, in Expo über `expo-camera` + einfaches 3D-Overlay machbar).
Sehr "Instagram-Story-tauglich", niedrige Einstiegshürde, hoher Zeige-Effekt.

**3. QR-Code-Login-Pairing**
Im Spiel `/app link` eingeben → QR-Code erscheint im Chat/auf einem Schild →
mit der App scannen → Account ist sofort verknüpft, kein Passwort tippen.
Fühlt sich modern an (wie WhatsApp Web) und senkt die Einstiegshürde massiv.

**4. Push "Boss-Event startet in 5 Minuten"**
Genau der Moment, wo eine Push-Benachrichtigung wirklich Mehrwert hat statt
zu nerven – holt Spieler zurück, die gerade nicht online sind. Größter
Hebel für Wiederkehr-Rate (Retention).

**5. Live-Server-Karte in der Tasche**
Falls die im Launcher geplante Live-Terrain-Karte kommt: eine abgespeckte
Version in der App zeigt "wo sind meine Gildenmitglieder gerade" (opt-in)
und die zuletzt markierten Ressourcen-/Quest-Punkte. Bindet App-Nutzung eng
an tatsächliches Spielgeschehen.

**6. Gilden-Wettbewerb/Leaderboard mit Wochen-Reset**
Boss-Kills, gesammelte Ressourcen, PvP-Siege – pro Gilde und individuell,
mit Push am Wochenende ("Deine Gilde ist auf Platz 2, noch 3h!"). Erzeugt
sozialen Druck/Ehrgeiz, der Leute aktiv zurückbringt.

**7. Tägliche Check-in-Belohnung**
App öffnen gibt eine kleine Server-Belohnung (z.B. über eine API, die der
Server abfragt) – klassischer Mobile-Retention-Mechanismus, sehr wirksam,
aber sollte behutsam eingesetzt werden (kein Zwang/Spam-Gefühl).

**8. Sprachnachrichten im Gildenchat**
Kurze Voice-Notes statt Tippen, gerade unterwegs viel niedrigere Hürde als
Text – erhöht die tatsächliche Chat-Aktivität spürbar.

**9. "Wer braucht Hilfe"-Ping**
Ein Spieler im Spiel kann per Command einen Hilferuf an seine Gilde senden,
der als Push in der App aufploppt ("Nutzer X braucht Hilfe bei Boss Y") –
fördert aktives Gilden-Zusammenspiel auch wenn nicht alle gleichzeitig
online sind.

**10. Account-Wallet/Shop-Einblick**
Server-Währung, letzte Shop-Käufe, ggf. Web-Shop-Anbindung direkt in der
App statt nur auf der Website – senkt Kaufhürde, gehört eher in eine
spätere Monetarisierungs-Phase.

## Reihenfolge-Empfehlung

Für maximalen "Hype bei Launch" wären **#1 (teilbare Charakter-Karte)** und
**#3 (QR-Login-Pairing)** die zwei mit dem besten Aufwand/Wirkung-Verhältnis
für einen ersten großen Release-Moment – beide sind ohne Realtime-Backend
umsetzbar und beide erzeugen von selbst Sichtbarkeit außerhalb des Servers.
**#4 (Boss-Event-Push)** direkt danach, weil es die App im Alltag der
Spieler verankert statt einmalig beeindruckt.
