import { useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { logout } from "../api/auth.js";
import { getPlayStatus, installOrUpdate, launchGame, onGameExited, onGameStarted } from "../api/game.js";
import { getCurrentSkinUrl } from "../api/skin.js";
import { openExternalUrl } from "../api/events.js";
import LauncherUpdateBanner from "./LauncherUpdateBanner.jsx";
import SidebarDock from "./SidebarDock.jsx";
import SocialDock from "./SocialDock.jsx";
import SettingsScreen from "./SettingsScreen.jsx";
import BossEventCountdown from "./BossEventCountdown.jsx";
import SkinChangerScreen from "./SkinChangerScreen.jsx";
import SkinMirror from "./SkinMirror.jsx";
import ActiveCharacterCard from "./ActiveCharacterCard.jsx";

// TODO: echte Links eintragen, sobald vorhanden (Discord-Invite, YouTube-Kanal).
const DISCORD_URL = "https://discord.gg/erzmark";
const YOUTUBE_URL = "https://youtube.com/@erzmark";
// Fuehrt direkt zum eingebetteten Feedback-Formular auf der Beta-Detailseite
// (siehe #feedback-Anker in resources/default/js/Pages/Beta/ShowBeta.vue auf
// dem Server) - Beta-Sektion braucht Login + die Rolle "Beta"/Staff, ohne
// das landet man einfach auf einer "keine Berechtigung"-Seite.
const FEEDBACK_URL = "https://erzmark.de/beta/erzmark-launcher#feedback";

// Beschriftung des Hauptbuttons je nach Backend-Status (siehe
// install.rs::PlayStatus – "state" ist einer von diesen drei plus "error").
const STATE_LABELS = {
  not_installed: "Installieren",
  update_available: "Update",
  ready: "Spielen",
};

const GAME_RUNNING_LABEL = "Spiel läuft…";

const EMBER_COUNT = 10;

/** Schwebende Glut-Partikel im Hintergrund – rein dekorativ, wie Funken aus
 * einer Erzschmiede. Werte einmalig berechnet, damit sie beim Re-Render
 * nicht neu "springen". */
function Embers() {
  const embers = useMemo(
    () =>
      Array.from({ length: EMBER_COUNT }, (_, i) => ({
        left: `${(i * 37 + 4) % 100}%`,
        delay: `${(i * 1.3) % 8}s`,
        duration: `${6 + (i % 5)}s`,
        drift: `${(i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 6)}px`,
      })),
    []
  );

  return (
    <div className="erzmark-embers" aria-hidden="true">
      {embers.map((e, i) => (
        <span
          key={i}
          className="erzmark-ember"
          style={{
            left: e.left,
            animationDelay: e.delay,
            animationDuration: e.duration,
            "--erzmark-ember-drift": e.drift,
          }}
        />
      ))}
    </div>
  );
}

function GemIcon({ spinning }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`erzmark-btn-play-icon${spinning ? " is-spinning" : ""}`}
      aria-hidden="true"
    >
      <path d="M12 2 L19 8 L12 22 L5 8 Z" fill="currentColor" opacity="0.92" />
      <path
        d="M5 8 L19 8 M9 8 L12 2 L15 8 M9 8 L12 22 M15 8 L12 22"
        stroke="rgba(15,19,26,0.55)"
        strokeWidth="0.6"
        fill="none"
      />
    </svg>
  );
}

function SkinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-4 3-6 7-6s7 2 7 6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.4M12 18.6V21M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M3 12h2.4M18.6 12H21M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.3 5.4A17.5 17.5 0 0 0 15.9 4c-.2.4-.4.9-.6 1.3a16 16 0 0 0-4.7 0A9 9 0 0 0 10 4a17.6 17.6 0 0 0-4.4 1.4C2.9 9.1 2.2 12.7 2.5 16.3a17.7 17.7 0 0 0 5.4 2.7c.4-.6.8-1.2 1.1-1.9-.6-.2-1.2-.5-1.7-.9l.4-.3c3.3 1.5 6.9 1.5 10.2 0l.4.3c-.5.4-1.1.7-1.7.9.3.7.7 1.3 1.1 1.9a17.6 17.6 0 0 0 5.4-2.7c.4-4.2-.6-7.7-2.8-10.9ZM9.7 14.2c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm4.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.6 7.2s-.2-1.5-.8-2.1c-.8-.8-1.7-.8-2.1-.9C15.9 4 12 4 12 4h0s-3.9 0-6.7.2c-.4 0-1.3.1-2.1.9-.6.6-.8 2.1-.8 2.1S2.2 9 2.2 10.7v1.6c0 1.7.2 3.5.2 3.5s.2 1.5.8 2.1c.8.8 1.8.8 2.3.9 1.7.2 6.5.2 6.5.2s3.9 0 6.7-.2c.4 0 1.3-.1 2.1-.9.6-.6.8-2.1.8-2.1s.2-1.7.2-3.5v-1.6c0-1.7-.2-3.5-.2-3.5ZM9.9 14.6V8.9l5.4 2.9-5.4 2.8Z" />
    </svg>
  );
}

function FeedbackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3.5V16.5H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  );
}

function AppDownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* Handy-Umriss */}
      <rect x="6.2" y="2.5" width="11.6" height="19" rx="2.2" />
      <line x1="10.2" y1="19.1" x2="13.8" y2="19.1" />
      {/* Download-Pfeil im Bildschirmbereich */}
      <path d="M12 6.5v7" />
      <path d="M9 10.7l3 3 3-3" />
    </svg>
  );
}

export default function MainScreen({ session, onLoggedOut }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSkinChanger, setShowSkinChanger] = useState(false);
  const [gameRunning, setGameRunning] = useState(false);
  const [heroSkinUrl, setHeroSkinUrl] = useState(null);
  const [appVersion, setAppVersion] = useState(null);

  useEffect(() => {
    refreshStatus();
  }, []);

  // Versionsnummer unten links – rein informativ, hilft beim Support
  // ("welche Version hast du?") und bestätigt, dass ein Update angekommen ist.
  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch(() => {});
  }, []);

  // Eigener Skin groß im Hintergrund des Hauptbildschirms, wie der
  // Charakter-Hero-Render auf erzmark.de – rein dekorativ, blockiert nichts,
  // falls die Skin-API (noch) nicht erreichbar ist.
  useEffect(() => {
    let cancelled = false;
    getCurrentSkinUrl()
      .then((url) => {
        if (!cancelled) setHeroSkinUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Läuft unabhängig vom Play-Button-Klick: der Rust-Backend meldet
  // Start/Ende des Minecraft-Prozesses selbst (z. B. auch wenn das Spiel
  // durch Verlassen des Servers automatisch beendet wird, siehe
  // launch.rs/game_commands.rs – Quick-Play-Feature).
  useEffect(() => {
    let unlistenStarted;
    let unlistenExited;
    onGameStarted(() => setGameRunning(true)).then((fn) => {
      unlistenStarted = fn;
    });
    onGameExited(() => {
      setGameRunning(false);
      refreshStatus();
    }).then((fn) => {
      unlistenExited = fn;
    });
    return () => {
      unlistenStarted?.();
      unlistenExited?.();
    };
  }, []);

  async function refreshStatus() {
    setStatusError(null);
    try {
      const result = await getPlayStatus();
      setStatus(result);
      if (result.state === "error") {
        setStatusError(result.error ?? "Unbekannter Fehler beim Statusabruf");
      }
    } catch (err) {
      setStatusError(err?.message ?? String(err));
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      onLoggedOut();
    } finally {
      setLoggingOut(false);
    }
  }

  async function handleMainButton() {
    if (!status || busy || gameRunning) return;
    setActionError(null);

    if (status.state === "ready") {
      setBusy(true);
      try {
        await launchGame();
        // gameRunning wird über das "game-started"-Event gesetzt, sobald der
        // Prozess wirklich läuft – busy hier nur für den kurzen Start-Moment.
      } catch (err) {
        setActionError(err?.message ?? String(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    // "not_installed" oder "update_available" -> installieren/aktualisieren.
    setBusy(true);
    setProgress({ phase: "start", label: "Wird vorbereitet…", current: 0, total: 1 });
    try {
      await installOrUpdate((p) => setProgress(p));
      await refreshStatus();
    } catch (err) {
      setActionError(err?.message ?? String(err));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const buttonLabel = gameRunning
    ? GAME_RUNNING_LABEL
    : status
    ? STATE_LABELS[status.state] ?? "Installieren"
    : "Lädt…";
  const disabled = busy || gameRunning || !status || status.state === "error";
  const percent =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : null;

  return (
    <div className="erzmark-main-screen">
      <Embers />
      <LauncherUpdateBanner />

      <header className="erzmark-header">
        <div className="erzmark-header-brand">
          <div className="erzmark-sigil">
            <div className="erzmark-logo erzmark-logo-small" />
          </div>
          <span className="erzmark-wordmark">Erzmark</span>
        </div>
        <div className="erzmark-account-plaque">
          <span className="erzmark-account-name">{session?.username}</span>
          <button className="erzmark-link-btn" onClick={handleLogout} disabled={loggingOut}>
            Logout
          </button>
        </div>
      </header>

      <div className="erzmark-body">
        <BossEventCountdown />

        <div className="erzmark-columns">
          <aside className="erzmark-sidebar erzmark-sidebar-left">
            <SocialDock />
          </aside>

          <main className="erzmark-main-content">
            <div className="erzmark-hero-stage">
              <span className="erzmark-hero-name">{session?.username}</span>

              {heroSkinUrl && (
                <div className="erzmark-hero-skin" aria-hidden="true">
                  <SkinMirror skinUrl={heroSkinUrl} width={320} height={480} emotes />
                </div>
              )}

              <ActiveCharacterCard />
            </div>

            <button
              className="erzmark-btn-launch"
              onClick={handleMainButton}
              disabled={disabled}
              aria-label={busy && progress ? progress.label : buttonLabel}
            >
              <GemIcon spinning={busy || gameRunning} />
              <span className="erzmark-btn-launch-text">
                <span className="erzmark-btn-launch-label">
                  {busy && progress ? progress.label : buttonLabel}
                </span>
                {!busy && status?.latest_client_version && (
                  <span className="erzmark-btn-launch-sub">
                    Erzmark Fabric {status.minecraft_version}
                  </span>
                )}
              </span>
            </button>

            {busy && progress && (
              <div className="erzmark-progress" role="progressbar">
                <div
                  className="erzmark-progress-bar"
                  style={{ width: percent != null ? `${percent}%` : "35%" }}
                />
              </div>
            )}
            {busy && progress && percent != null && <p className="erzmark-hint">{percent}%</p>}

            {statusError && <p className="erzmark-error">{statusError}</p>}
            {actionError && <p className="erzmark-error">{actionError}</p>}
          </main>

          <aside className="erzmark-sidebar">
            <SidebarDock />
          </aside>
        </div>
      </div>

      <footer className="erzmark-secondary-actions">
        <div className="erzmark-secondary-spacer" aria-hidden="true" />

        <div className="erzmark-secondary-center">
          <button className="erzmark-rune-btn" onClick={() => setShowSkinChanger(true)}>
            <span className="erzmark-rune-btn-icon">
              <SkinIcon />
            </span>
            Skin ändern
          </button>
          <button className="erzmark-rune-btn" onClick={() => setShowSettings(true)}>
            <span className="erzmark-rune-btn-icon">
              <SettingsIcon />
            </span>
            Einstellungen
          </button>
        </div>

        <div className="erzmark-social-links">
          <button
            type="button"
            className="erzmark-social-btn"
            onClick={() => openExternalUrl(DISCORD_URL).catch(() => {})}
            title="Discord"
            aria-label="Discord"
          >
            <DiscordIcon />
          </button>
          <button
            type="button"
            className="erzmark-social-btn"
            onClick={() => openExternalUrl(YOUTUBE_URL).catch(() => {})}
            title="YouTube"
            aria-label="YouTube"
          >
            <YoutubeIcon />
          </button>
          <button
            type="button"
            className="erzmark-social-btn erzmark-social-btn-soon"
            title="Android-App – bald verfügbar"
            aria-label="Android-App (bald verfügbar)"
            disabled
          >
            <AppDownloadIcon />
            <span className="erzmark-social-soon-badge">Bald</span>
          </button>
        </div>
      </footer>

      <div className="erzmark-bottom-left-corner">
        {appVersion && <span className="erzmark-version-corner">v{appVersion}</span>}

        <button
          type="button"
          className="erzmark-feedback-corner"
          onClick={() => openExternalUrl(FEEDBACK_URL).catch(() => {})}
          title="Feedback zum Launcher geben (erzmark.de-Login nötig)"
        >
          <FeedbackIcon />
          Feedback
        </button>
      </div>

      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} />}
      {showSkinChanger && <SkinChangerScreen onClose={() => setShowSkinChanger(false)} />}
    </div>
  );
}
