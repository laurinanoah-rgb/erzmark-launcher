import { useEffect, useMemo, useState } from "react";
import { logout } from "../api/auth.js";
import { getPlayStatus, installOrUpdate, launchGame, onGameExited, onGameStarted } from "../api/game.js";
import { getCurrentSkinUrl } from "../api/skin.js";
import LauncherUpdateBanner from "./LauncherUpdateBanner.jsx";
import SidebarDock from "./SidebarDock.jsx";
import SettingsScreen from "./SettingsScreen.jsx";
import BossEventCountdown from "./BossEventCountdown.jsx";
import SkinChangerScreen from "./SkinChangerScreen.jsx";
import SkinMirror from "./SkinMirror.jsx";
import ActiveCharacterCard from "./ActiveCharacterCard.jsx";

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

  useEffect(() => {
    refreshStatus();
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

        <main className="erzmark-main-content">
          <div className="erzmark-hero-stage">
            <span className="erzmark-hero-name">{session?.username}</span>

            {heroSkinUrl && (
              <div className="erzmark-hero-skin" aria-hidden="true">
                <SkinMirror skinUrl={heroSkinUrl} width={280} height={420} />
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

      <footer className="erzmark-secondary-actions">
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
      </footer>

      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} />}
      {showSkinChanger && <SkinChangerScreen onClose={() => setShowSkinChanger(false)} />}
    </div>
  );
}
