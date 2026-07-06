import { useEffect, useMemo, useState } from "react";
import { logout } from "../api/auth.js";
import { getPlayStatus, installOrUpdate, launchGame } from "../api/game.js";
import LauncherUpdateBanner from "./LauncherUpdateBanner.jsx";
import ScreenshotGallery from "./ScreenshotGallery.jsx";
import NewsFeed from "./NewsFeed.jsx";
import FriendsList from "./FriendsList.jsx";
import SettingsScreen from "./SettingsScreen.jsx";
import BossEventCountdown from "./BossEventCountdown.jsx";
import SkinChangerScreen from "./SkinChangerScreen.jsx";

// Beschriftung des Hauptbuttons je nach Backend-Status (siehe
// install.rs::PlayStatus – "state" ist einer von diesen drei plus "error").
const STATE_LABELS = {
  not_installed: "Installieren",
  update_available: "Update",
  ready: "Spielen",
};

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

  useEffect(() => {
    refreshStatus();
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
    if (!status || busy) return;
    setActionError(null);

    if (status.state === "ready") {
      setBusy(true);
      try {
        await launchGame();
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

  const buttonLabel = status ? STATE_LABELS[status.state] ?? "Installieren" : "Lädt…";
  const disabled = busy || !status || status.state === "error";
  const percent =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : null;

  return (
    <div className="erzmark-main-screen">
      <Embers />
      <LauncherUpdateBanner />

      <header className="erzmark-header">
        <div className="erzmark-sigil">
          <div className="erzmark-logo erzmark-logo-small" />
        </div>
        <div className="erzmark-account-plaque">
          <span className="erzmark-account-name">{session?.username}</span>
          <button className="erzmark-link-btn" onClick={handleLogout} disabled={loggingOut}>
            Logout
          </button>
        </div>
      </header>

      <div className="erzmark-body">
        <main className="erzmark-main-content">
          <BossEventCountdown />

          <button
            className="erzmark-btn-play"
            onClick={handleMainButton}
            disabled={disabled}
            aria-label={busy && progress ? progress.label : buttonLabel}
          >
            <span className="erzmark-btn-play-inner">
              <GemIcon spinning={busy} />
              <span className="erzmark-btn-play-label">
                {busy && progress ? progress.label : buttonLabel}
              </span>
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

          {!busy && status?.latest_client_version && (
            <span className="erzmark-version-stamp">
              Version {status.latest_client_version} · Minecraft {status.minecraft_version}
            </span>
          )}

          {statusError && <p className="erzmark-error">{statusError}</p>}
          {actionError && <p className="erzmark-error">{actionError}</p>}
        </main>

        <aside className="erzmark-sidebar">
          <NewsFeed />
          <div className="erzmark-sidebar-divider" />
          <FriendsList />
          <div className="erzmark-sidebar-divider" />
          <ScreenshotGallery />
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
