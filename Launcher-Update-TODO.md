# Launcher Update — TODO-Liste

Stand: 2026-07-21. Reine Planungsliste aus `Erzmark_Launcher_Update_Ideensammlung.md` — **noch keine Umsetzung**, dient als Backlog für den nächsten Entwicklungs-Prompt. Reihenfolge der Abschnitte entspricht der Ideensammlung.

---

## 1. Premium-Animationssystem (Kernfeature)

### Performance-Stufensystem (Fundament — sollte vor den Animationen selbst stehen)
- [x] Mini-Vorstufe (2 Stufen: `full`/`reduced`, statisch via `hardwareConcurrency` + `prefers-reduced-motion`) — [src/utils/performanceTier.js](src/utils/performanceTier.js), Basis für die Boot-Animation
- [ ] Volle Geräte-Einschätzung (Rust: `sysinfo`-Crate für CPU-Kerne/RAM/GPU zusätzlich zur Frontend-Erkennung)
- [ ] Live-Frame-Drop-Erkennung per `requestAnimationFrame`-Delta
- [ ] Echtes 3-Stufen-System (voll / reduziert / minimal) inkl. automatischem Downgrade bei Lag und vorsichtigem Upgrade erst nach stabiler Phase
- [ ] Manuelles Override in den Settings
- [ ] Dezenter Hinweis-Toast beim ersten automatischen Downgrade
- [ ] Alle folgenden Animations-Features an dieses Stufensystem anbinden (Boot-Animation hängt bereits an der Mini-Vorstufe, siehe oben)

### Boot-Animation ✅ (21.07.2026, nach User-Feedback überarbeitet)
- [x] Diegetische Start-Sequenz, finale Fassung: Terminal-Boot-Log tippt sich zeilenweise mit Jitter (kein gleichförmiges Tempo, kleine Zeilen-Pausen, blinkender Cursor — bewusst "kinoreif" verlangsamt). Die getippten Buchstaben lösen sich danach aus dem Text und fliegen einzeln (nicht als abstrakte Partikel, sondern als echte Zeichen) zu einer aus dem Logo-Alphakanal abgetasteten Silhouette (`logo3`) — das Bild entsteht sichtbar aus Wörtern. Crossfade zur scharfen Logo-Grafik, danach episches Finale: Schockwellen-Glow vom Logo aus + wachsende Masken-Iris (radialer CSS-Mask-Reveal), die den dahinterliegenden Screen (Login/Start, schon fertig gerendert) freigibt statt einem einfachen Fade. Kurzes reines Fade bei Stufe „reduced" (kein Bewegungseffekt). — [src/components/BootAnimation.jsx](src/components/BootAnimation.jsx), eingebunden in [src/App.jsx](src/App.jsx), Styles in [src/theme.css](src/theme.css)
- [x] Tool-Entscheidung: **GSAP** (User-Entscheidung, siehe Chat) — schlanke Timeline-Library, rein code-getrieben, kein externes Design-Tool nötig für den Partikel-/Text-Morph-Effekt. `npm install gsap` bereits erledigt.
- Bug beim Bauen gefunden & gefixt: leere GSAP-Timeline (Inhalt kommt erst nach async Bild-Load dazu) vervollständigt sich sonst sofort beim ersten Tick, bevor die Tweens angehängt sind → Timeline jetzt `paused: true` erstellt, `tl.play()` erst nach vollständigem Aufbau.

### Transition Boot → Hauptmenü ✅ (21.07.2026)
- [x] Shared-Element-Transition: Erzmark hat keine Server-Liste (Single-Server-Launcher), daher als Äquivalent zum "Server-Icon" das vorhandene kleine Kopf-Siegel gewählt. Beim Eintritt in den Hauptbildschirm schrumpft ein großes, glühendes Logo vom Bildschirmzentrum sichtbar auf Position/Größe des Siegels (FLIP-Technik, per-Frame Distanz-/Skalierungsberechnung), dann Crossfade zum echten Siegel — läuft unabhängig davon, ob man über Login oder wiederhergestellte Session zum Hauptbildschirm kommt.
- [x] Parallax-Tiefe: Header → Boss-Event-Leiste → Sidebars/Hero → Footer/Ecke setzen sich in gestaffelten Wellen zusammen (Fade + leichter Slide/Scale je Layer), ~1.1s bei Stufe „full", einfaches Fade ohne Bewegungseffekt bei Stufe „reduced". — [src/components/MainScreen.jsx](src/components/MainScreen.jsx), Styles in [src/theme.css](src/theme.css)

### Tab-Wechsel ✅ (21.07.2026)
- [x] Physikbasierte Spring-Animation: gleitender Indikator hinter dem aktiven Tab nutzt GSAPs `elastic.out`-Ease statt hartem Klassenwechsel — betrifft beide Dock-Widgets (Freunde/Gilde/Karte links, Neuigkeiten/Spielstände/Galerie rechts), da beide dieselbe Tab-Struktur teilen.
- [x] Content-Shift-Pattern: Panel-Inhalt faded/slided beim Wechsel raus, tauscht dann den Inhalt, faded wieder rein (statt hartem Remount).
- [x] Thematische Farbverschiebung je Tab (Blau/Gold/Grün, je nach Tab-Thema) — Indikator UND der Panel-Hintergrund-Glow verschieben sich synchron mit.
- [x] Gemeinsame Logik in eine wiederverwendbare Komponente ausgelagert statt dupliziert, da SocialDock/SidebarDock strukturell identisch waren. — [src/components/DockTabs.jsx](src/components/DockTabs.jsx), genutzt von [src/components/SocialDock.jsx](src/components/SocialDock.jsx) und [src/components/SidebarDock.jsx](src/components/SidebarDock.jsx), Styles in [src/theme.css](src/theme.css)

### Mikro-Interaktionen
- [ ] Magnetische Hover-States auf Buttons
- [ ] Eigene Klick-/Hover-Sounds
- [ ] Cursor-Glow/Trail bei R.U.D.O.L.F.-Lore-Buttons

---

## 2. Skin Mirror (3D-Skin-Viewer)

- [ ] Technische Basis: React Three Fiber, Architektur-Inspiration skinview3d (nicht kopieren)
- [ ] Idle-Animationen: Atmen, Kopf-Tracking zum Mauszeiger, Tab-Hover-Neugier
- [ ] Idle-Posen abhängig von Reputationsstufe/Power-Score
- [ ] Live-Sync mit Ingame-Zustand (Rüstung/Items, temporäre Schadens-/Dreck-Overlays)
- [ ] Seltener R.U.D.O.L.F.-Glitch (falsche Pose/Textur + Kommentar)
- [ ] Sozialer Modus: Online-Freunde-Skins im selben 3D-Raum
- [ ] Interaktionen: Drag zum Drehen, Doppelklick-Emote, Inaktivitäts-Reaktion (hinsetzen/gähnen)
- [ ] Anbindung an Performance-Stufensystem (Stufe 3 = volles 3D mit Schatten, Stufe 1 = statisches 2D-Bild)

---

## 3. Custom Achievements & Stats

### Grundgerüst
- [ ] Page-Turn-Interaktion am rechten Fensterrand (Pfeil, Hover-Reaktion: Pulsieren/Kante hebt sich)
- [ ] Seite 1: Statistiken, Seite 2: Achievements
- [ ] Echte 3D-Page-Curl-Animation (Stufe 3), einfacher Fade als Fallback (Stufe 1), an Performance-System gekoppelt

### Freischalt-Moment ("Schmiede-Konzept")
- [ ] Frisch-geschmiedet-Effekt bei erster Ansicht (Glühen + Partikel)
- [ ] Danach dauerhaftes, sanft pulsierendes Abkühl-Glühen
- [ ] Dezenter Lichtschein am rechten Fensterrand bei neuem Achievement während laufender Session

### Ergänzende Ideen
- [ ] Tier-System (Bronze/Silber/Gold/Legendär o. ä.) mit eigenen Rahmen/Partikel-Auren, permanente Aura bei Legendär
- [ ] Prozentanzeige „X % der Spieler haben das auch erreicht"
- [ ] Freischaltdatum + Kontext-Satz zum damaligen Weltgeschehen (sofern aus Server-Events ableitbar)
- [ ] Eigener Sound pro Tier

### Stats-Seite
- [ ] Animierte Zähler (z. B. Spielzeit zählt beim Öffnen hoch) mit Sound
- [ ] Fortschritts-Ringe pro Kategorie (Kampf/Erkundung/Handwerk) statt Tabellen

---

## 4. Freundessystem — MMOCore-Integration

### Teil 1: Benachrichtigungs-System + Freunde-Tab-UI ✅ (21.07.2026, Frontend/Mock)
- [x] Glocke im Header: leuchtet + klingelt in Endlosschleife rot bei ungelesenen Benachrichtigungen (Stufe „full"; bei „reduced" nur statisch rot ohne Bewegung), Hover-Wiggle unabhängig vom Klick, Klick öffnet Popup, Schließen markiert alles als gelesen (Badge/Glow reset) — Freundschaftsanfragen bleiben trotzdem bis zur Annahme/Ablehnung aktionierbar (separater Zustand von „gelesen"). — [src/components/NotificationBell.jsx](src/components/NotificationBell.jsx)
- [x] Gemeinsamer State über [src/state/NotificationsContext.jsx](src/state/NotificationsContext.jsx), damit Glocke (Header) und Freunde-Tab (tief in der Sidebar) synchron bleiben.
- [x] Freundschaftsanfrage-Karte im Freunde-Tab ("{Spieler} möchte mit dir befreundet sein. Akzeptieren?") mit Annehmen/Ablehnen direkt im Launcher — [src/components/FriendsList.jsx](src/components/FriendsList.jsx)
- [x] Noch mit Mock-Daten/-API ([src/api/notifications.js](src/api/notifications.js)) im Format der künftigen echten API — **Annehmen/Ablehnen wirkt aktuell nur lokal, noch nicht mit MMOCore verbunden.**

### Teil 2: Echte MMOCore-Anbindung ✅ Backend live (21.07.2026)
- **Recherche:** Freundschaften liegen in MySQL (`mcmmo.mmocore_playerdata.friends`, JSON-Array). Offene Anfragen selbst speichert MMOCore **nicht persistent** (nur `RequestManager` im Arbeitsspeicher, kein Event dafür) — daher Polling statt Event-Hook.
- [x] **Neues Server-Plugin `ErzmarkSocial`** (`C:\Users\noah0\.claude\Erzmark\erzmark-social\`, Java/Maven wie `ErzmarkDungeons`): pollt `MMOCore.plugin.requestManager` alle 3s nach offenen Anfragen für Online-Spieler, meldet neue per HTTP an Laravel. Gebaut, auf `lobby-1` deployed, Server sauber neugestartet (0 Spieler online zu dem Zeitpunkt), Log bestätigt fehlerfreien Start + aktives Polling (`/erzmarksocial status`).
- [x] **Laravel-Backend live** (`/var/www/minetrax`, DB vorher per `mysqldump` gesichert):
  - Migration `friend_requests` (Status: pending/accepted/declined/synced)
  - `POST /api/v1/social/friend-request` — vom Plugin befüllt, eigenes Secret (`ERZMARK_SOCIAL_SECRET` in `.env`), Live-verifiziert (201 bei korrektem Secret, 401 bei falschem)
  - `GET /app-api/friend-requests` + `POST /app-api/friend-requests/{id}/respond` — Sanctum-authentifiziert
  - `friends:sync-accepted` — läuft jede Minute (Scheduler), schreibt akzeptierte Anfragen erst in `mmocore_playerdata.friends`, wenn **beide** Spieler offline sind (kein Autosave-Konflikt), manuell fehlerfrei getestet
- [x] **`/addfriend <Name>`-Befehl** (ErzmarkSocial-Plugin): funktioniert auch bei offline Zielspieler (im Gegensatz zu MMOCores eigenem `/friends add`, das laut `friend-not-online-player`-Meldung zwingend beide online voraussetzt). Ist der Zielspieler online, bekommt er zusätzlich die normale klickbare MMOCore-Chat-Nachricht (`/friends accept|deny <id>`, dieselbe Request-ID) — er kann also weiterhin per Chat-Klick annehmen, unabhängig davon ob er stattdessen Launcher/App nutzt.
- [x] **Live-Test mit echten MMOCore-Objekten bestanden (21.07.2026):** `/erzmarksocial simulate <Spieler>` erzeugt eine echte `FriendRequest` über die reale RequestManager-API — vom Plugin erkannt, an Laravel gemeldet, korrekt in der DB gelandet. Dabei einen echten Bug gefunden+gefixt: `LaravelReporter.java` rief noch die ursprünglich geplante URL (`/api/internal/friend-requests`) statt der tatsächlich gebauten (`/api/v1/social/friend-request`) auf.

### Teil 3: Launcher an echte Endpunkte angebunden ✅ (21.07.2026)
- [x] Launcher holt sich jetzt zusätzlich einen Sanctum-Token (`POST /app-api/auth/minecraft`, gleicher Vertrag wie die Mobile App) — neues Rust-Modul [src-tauri/src/social.rs](src-tauri/src/social.rs) (`ensure_sanctum_token`, lazy + State-gecacht, nicht dauerhaft gespeichert, da jederzeit aus der laufenden Session neu ableitbar) + [src-tauri/src/social_commands.rs](src-tauri/src/social_commands.rs) (`get_friend_requests`, `respond_friend_request`)
- [x] [src/api/notifications.js](src/api/notifications.js) ruft jetzt die echten Tauri-Commands auf statt Mock-Daten — Format blieb 1:1 kompatibel, daher keine Änderungen an NotificationsContext/NotificationBell/FriendsList nötig. "Gelesen"-Zustand (nur ein Launcher-UI-Konzept, der Server kennt nur pending/accepted/declined) wird lokal in `localStorage` gemerkt, gleiches Muster wie `App.jsx`.
- [x] Rust (`cargo check`) + Frontend-Build fehlerfrei, v1.3.8 committed + gepusht.
- [ ] **Noch zu tun:** echter End-to-End-Test im laufenden Tauri-Launcher (bisher nur der Backend-Teil bis Laravel live getestet, noch nicht durch den Launcher selbst durchgeklickt)
- [ ] Gleiches für die Mobile App (App hat Sanctum-Auth schon, nur neue Calls + UI in `FriendsScreen.jsx`)

### Erweiterungen auf derselben Infrastruktur
- [ ] Gilden-/Team-Einladungen über denselben Mechanismus
- [ ] Offline-Trades/Geschenke mit automatischer Übergabe beim nächsten gemeinsamen Login
- [ ] Kurznachrichten-Warteschlange (Launcher/App → Ingame-Popup beim nächsten Join)
- [ ] Sichtbarkeit von Online-Freunden im Skin Mirror (Abhängigkeit zu Abschnitt 2)

---

## 5. ARG- & Hype-Ideen (R.U.D.O.L.F.-zentriert)

### Ladebildschirm
- [ ] Personalisierte Erstansprache beim ersten Boot (Username/Systemzeit)
- [ ] Seltene, absichtliche Lore-Glitches
- [ ] Countdown-Tool vor Serverstart, R.U.D.O.L.F.-kommentiert
- [ ] Live-Kommentare zu Serverereignissen
- [ ] Anonymisierte Crash-Reports als Community-Content

### Native OS-Ebene
- [ ] Native Desktop-Benachrichtigung zu unerwarteter Zeit mit kryptischer Zeile
- [ ] Reversibler, angekündigter Wallpaper-Wechsel bei Events
- [ ] „Korrupte Installation"-Schauspiel (rein visuell, in-App)

### Community-/Infrastruktur-Effekte
- [ ] Verschwommener Blick auf Ladebildschirm eines zufälligen anderen Spielers
- [ ] Community-Countdown, der nur bei genug gleichzeitigen Online-Spielern voranschreitet
- [ ] Einzelne seltene Spieleraktion triggert Einmal-Effekt für alle beim nächsten Start
- [ ] Launcher-zu-Launcher „Flaschenpost"
- [ ] Live-Puls-Anzeige der Server-Stimmung (aus Aktivität/Sentiment abgeleitet)
- [ ] Geo-verteilte, anonymisierte Weltkarte mit Online-Spieler-Dichte

### Persönliche/emotionale Momente
- [ ] Zeitkapsel (Nachricht/Screenshot versiegeln, erscheint nach X Tagen/Event)
- [ ] „Vererbung": digitales Erbe eines endenden Accounts bei neuem Account
- [ ] Reaktion auf Community-weite Inaktivität
- [ ] Tägliches „Orakel": Freitextfrage an R.U.D.O.L.F. mit zweideutiger LLM-Antwort
- [ ] Stiller Pakt zwischen zwei Spielern (gekoppelte kosmetische Effekte, nur bei beiden online sichtbar)
- [ ] Seltener bewusster Zugriffs-Delay mit kryptischer Begründung
- [ ] Fehler-Archäologie: alte gefixte Bugs gelegentlich als Easter Egg reaktiviert
- [ ] Generative Ambient-Sound-Schicht im Ladebildschirm (Tageszeit + Serverzustand)
- [ ] R.U.D.O.L.F.s Sprachstil verändert sich langsam über Versionen (community-abhängig)

---

## 6. Praktische Spieler-Funktionen

### Profil & Identität
- [ ] Profil-Editor (Avatar/Banner, Bio, sichtbare Erfolge/Titel)
- [ ] „Erzmark Pass": zentrale Account-Verwaltung (Java/Bedrock, Discord, App)

### Feedback & Community
- [ ] Bug-Report-Button mit automatischem Log-/Screenshot-/Systeminfo-Anhang
- [ ] Feature-Voting (Daumen hoch/runter)
- [ ] Vorschlagsbox mit Kategorien (Balance, Bugs, Ideen)

### Personalisierung & Komfort
- [ ] Granulare Benachrichtigungs-Einstellungen
- [ ] Session-Statistiken/Power-Score-Verlauf als Dashboard

### Support & Transparenz
- [ ] Server-Status-/Roadmap-Tab mit Changelog
- [ ] Interaktive, klickbare Roadmap statt Text-Liste
- [ ] Ticket-System-Anbindung für Bans/Reports

### Weitere Funktionsideen
- [ ] Companion-Widget/Overlay am Bildschirmrand (Status auch bei minimiertem Launcher)
- [ ] Synthetische R.U.D.O.L.F.-Stimme (z. B. ElevenLabs) für wichtige Momente
- [ ] Automatische Screenshot-/Clip-Erstellung bei besonderen Serverereignissen inkl. Branding-Overlay
- [ ] Persönliche Chronik/Timeline der eigenen Erzmark-Geschichte
- [ ] Export von Charakterbögen/Statistiken als teilbare Grafik/PDF
- [ ] Saisonale Launcher-Reskins zu besonderen Anlässen
- [ ] Mentoring-Matching für neue Spieler

---

## 7. Offene Priorisierungsfragen (aus der Ideensammlung, noch zu klären)

- [ ] Welche ARG-/Hype-Ideen wirken glaubwürdig, ohne die Immersion zu überstrapazieren?
- [ ] Welche Features hängen technisch zusammen und gehören in dieselbe Phase? (z. B. Skin Mirror + Freundes-Präsenz; Performance-System + Animationssystem — Performance-System ist zwingend Voraussetzung für alles unter Abschnitt 1 und 2)
- [ ] MVP-Umfang für das nächste Update — was ist realistisch, was verschiebt sich?

---

**Nächster Schritt:** Priorisierungsfragen aus Abschnitt 7 gemeinsam klären, dann Phasenplan/MVP-Scope festlegen — erst danach Umsetzung beginnen.
