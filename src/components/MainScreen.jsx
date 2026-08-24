import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { getVersion } from "@tauri-apps/api/app";
import { logout } from "../api/auth.js";
import { getPlayStatus, installOrUpdate, launchGame, onGameExited, onGameStarted } from "../api/game.js";
import { getCurrentSkinUrl } from "../api/skin.js";
import { openExternalUrl } from "../api/events.js";
import { getPerformanceTier } from "../utils/performanceTier.js";
import { NotificationsProvider } from "../state/NotificationsContext.jsx";
import { TalkProvider } from "../state/TalkContext.jsx";
import AnchorWidget from "./AnchorWidget.jsx";
import NotificationBell from "./NotificationBell.jsx";
import LauncherUpdateBanner from "./LauncherUpdateBanner.jsx";
import { getWorldDockModules } from "./SidebarDock.jsx";
import { useSocialDockModules } from "./SocialDock.jsx";
import ForgeLayout from "./ForgeLayout.jsx";
import BossEventCountdown from "./BossEventCountdown.jsx";
import ActiveCharacterCard from "./ActiveCharacterCard.jsx";
import WorldGate from "./WorldGate.jsx";
import LauncherCompanion from "./LauncherCompanion.jsx";
import { subscribeNewUnlock } from "../api/achievements.js";
import { getSettings } from "../api/settings.js";
import { subscribeSettingsChanged } from "../state/settingsBus.js";
import { setMuted } from "../utils/achievementSounds.js";
import { detectDisplayProfile } from "../utils/displayPreferences.js";
import { getProfile } from "../api/profileEditor.js";
import ProfileScreenModern, { preloadProfileScreenData } from "./ProfileScreenModern.jsx";
import LivingHall from "./LivingHall.jsx";
import { configureHallAmbience, playGateFailure, playGateIgnition } from "../utils/hallAmbience.js";

const FriendsLounge = lazy(() => import("./FriendsLounge.jsx"));
const SettingsScreen = lazy(() => import("./SettingsScreen.jsx"));
const AchievementsScreen = lazy(() => import("./AchievementsScreen.jsx"));
const FeedbackScreen = lazy(() => import("./FeedbackScreen.jsx"));
const ManagerScreen = lazy(() => import("../manager/ManagerScreen.jsx"));
const SkinMirror = lazy(() => import("./SkinMirror.jsx"));

function PanelLoadingFallback() {
  return <div className="erzmark-panel-loading" role="status"><span /><small>Bereich wird geöffnet…</small></div>;
}

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
function Embers({ tier = "full" }) {
  const emberCount = tier === "full" ? EMBER_COUNT : 4;
  const embers = useMemo(
    () =>
      Array.from({ length: emberCount }, (_, i) => ({
        left: `${(i * 37 + 4) % 100}%`,
        delay: `${(i * 1.3) % 8}s`,
        duration: `${6 + (i % 5)}s`,
        drift: `${(i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 6)}px`,
      })),
    [emberCount]
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

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.4M12 18.6V21M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M3 12h2.4M18.6 12H21M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
    </svg>
  );
}

/**
 * Zeichen fuer den Team-Bereich: ein Zahnrad im Kreis - Werkzeug hinter einer
 * verschlossenen Kammer. Passt zur Formsprache der uebrigen Runen-Knoepfe
 * (duenne Linien, 24er-Raster) und hebt sich trotzdem vom Einstellungs-Zahnrad ab.
 */
function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2.8 4.6 6v6c0 4.2 3 7.6 7.4 9.2 4.4-1.6 7.4-5 7.4-9.2V6L12 2.8Z" />
      <circle cx="12" cy="11.6" r="2.2" />
      <path d="M12 7.6v1.2M12 14.4v1.2M8.5 11.6h1.2M14.3 11.6h1.2" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8.5" r="3.2" />
      <path d="M5.5 20c0-4 3-6 6.5-6s6.5 2 6.5 6" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4v1a4 4 0 0 0 4 4M17 5h3v1a4 4 0 0 1-4 4" />
      <path d="M12 13v4M9 20h6M9.5 17h5l.5 3H9l.5-3Z" />
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

function MenuDockContent({ onProfile, onFeedback, onSettings, onManager }) {
  return (
    <div className="erzmark-forge-menu-content">
      <div className="erzmark-secondary-center">
        <button className="erzmark-rune-btn" onClick={onProfile}><span className="erzmark-rune-btn-icon"><ProfileIcon /></span>Profil</button>
        <button className="erzmark-rune-btn" onClick={onFeedback}><span className="erzmark-rune-btn-icon"><FeedbackIcon /></span>Feedback</button>
        <button className="erzmark-rune-btn" onClick={onSettings}><span className="erzmark-rune-btn-icon"><SettingsIcon /></span>Einstellungen</button>
        <button className="erzmark-rune-btn" onClick={onManager} title="Nur für Teammitglieder"><span className="erzmark-rune-btn-icon"><TeamIcon /></span>Team</button>
      </div>
      <div className="erzmark-social-links">
        <button type="button" className="erzmark-social-btn" onClick={() => openExternalUrl(DISCORD_URL).catch(() => {})} title="Discord" aria-label="Discord"><DiscordIcon /></button>
        <button type="button" className="erzmark-social-btn" onClick={() => openExternalUrl(YOUTUBE_URL).catch(() => {})} title="YouTube" aria-label="YouTube"><YoutubeIcon /></button>
        <button type="button" className="erzmark-social-btn erzmark-social-btn-soon" title="Android-App – bald verfügbar" aria-label="Android-App (bald verfügbar)" disabled><AppDownloadIcon /><span className="erzmark-social-soon-badge">Bald</span></button>
      </div>
    </div>
  );
}

export default function MainScreen({ session, onLoggedOut }) {
  const perfTier = useRef(getPerformanceTier()).current;
  const [loggingOut, setLoggingOut] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [launching, setLaunching] = useState(false);
  const [gateCelebration, setGateCelebration] = useState(false);
  const [returnMoment, setReturnMoment] = useState(false);
  const [hallSettings, setHallSettings] = useState({ atmosphere_enabled: true, ambient_sound: false, ambient_volume: 32, cursor_runes: true });
  const [actionError, setActionError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [gameRunning, setGameRunning] = useState(false);
  const [heroSkinUrl, setHeroSkinUrl] = useState(null);
  const [showFriendsInMirror, setShowFriendsInMirror] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFriendsLounge, setShowFriendsLounge] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  // Team-Bereich (R.U.D.O.L.F.s Kern). Verlangt eine eigene Anmeldung mit den
  // erzmark.de-Zugangsdaten - der Microsoft-Login sagt nichts ueber eine
  // Team-Rolle aus.
  const [showManager, setShowManager] = useState(false);
  const [newAchievementGlow, setNewAchievementGlow] = useState(false);
  const [appVersion, setAppVersion] = useState(null);
  const [layoutProfile, setLayoutProfile] = useState(() =>
    document.querySelector(".erzmark-app")?.dataset.displayProfile ?? detectDisplayProfile()
  );

  const phantomLogoRef = useRef(null);
  const sigilRef = useRef(null);
  const wordmarkRef = useRef(null);
  const accountRef = useRef(null);
  const bossEventRef = useRef(null);
  const sidebarLeftRef = useRef(null);
  const sidebarRightRef = useRef(null);
  const heroMainRef = useRef(null);
  const footerRef = useRef(null);
  const cornerRef = useRef(null);

  const socialModules = useSocialDockModules(() => setShowFriendsLounge(true));
  const worldModules = getWorldDockModules();
  const layoutModules = [
    ...socialModules,
    ...worldModules,
    {
      id: "actions",
      label: "Menü",
      Icon: SettingsIcon,
      color: "gold",
      content: (
        <MenuDockContent
          onProfile={() => setShowProfile(true)}
          onFeedback={() => setShowFeedback(true)}
          onSettings={() => setShowSettings(true)}
          onManager={() => setShowManager(true)}
        />
      ),
    },
  ];

  useEffect(() => {
    const app = document.querySelector(".erzmark-app");
    if (!app) return undefined;
    const syncProfile = () => setLayoutProfile(app.dataset.displayProfile ?? detectDisplayProfile());
    const observer = new MutationObserver(syncProfile);
    observer.observe(app, { attributes: true, attributeFilter: ["data-display-profile"] });
    window.addEventListener("resize", syncProfile);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncProfile);
    };
  }, []);

  useEffect(() => {
    refreshStatus();
  }, []);

  // Das Profil ist ein häufig geöffneter Bereich. Seine leichte UI-Hülle ist
  // bereits im Main-Bundle; nur die Daten werden in einer ruhigen Phase
  // vorgewärmt. Der große 3D-Skin-Viewer bleibt separat lazy geladen.
  useEffect(() => {
    const warmProfile = () => {
      getProfile().catch(() => {});
      preloadProfileScreenData().catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(warmProfile, { timeout: 2200 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = window.setTimeout(warmProfile, 900);
    return () => window.clearTimeout(timer);
  }, []);

  // Eintritts-Sequenz in den Hauptbildschirm (Launcher-Update-TODO, Abschnitt
  // 1, "Transition Boot -> Hauptmenü"): das große Logo schrumpft sichtbar auf
  // Position/Größe des kleinen Kopf-Siegels ("Shared-Element" statt hartem
  // Schnitt — Erzmark hat keine Server-Liste, das Siegel ist hier das
  // Äquivalent zum Server-Icon aus der Ideensammlung). Die restlichen
  // Bereiche setzen sich in leicht gestaffelten Tiefenebenen dahinter
  // zusammen (Header -> Sidebars/Hero -> Footer), für ein dezentes
  // Parallax-Gefühl. Läuft unabhängig davon, ob man über Login oder
  // wiederhergestellte Session hierher kommt (einmalig pro Mount).
  useEffect(() => {
    const tier = getPerformanceTier();
    const groups = [wordmarkRef, accountRef, bossEventRef, sidebarLeftRef, sidebarRightRef, heroMainRef, footerRef, cornerRef]
      .map((r) => r.current)
      .filter(Boolean);

    if (tier !== "full") {
      const tl = gsap.to(groups, { opacity: 1, duration: 0.3, ease: "power1.out" });
      if (sigilRef.current) gsap.set(sigilRef.current, { opacity: 1 });
      return () => tl.kill();
    }

    const sigilRect = sigilRef.current?.getBoundingClientRect();
    const phantom = phantomLogoRef.current;
    if (!sigilRect || !phantom) {
      gsap.set(groups, { opacity: 1 });
      if (sigilRef.current) gsap.set(sigilRef.current, { opacity: 1 });
      return;
    }

    const phantomRect = phantom.getBoundingClientRect();
    const scale = sigilRect.width / phantomRect.width;
    const dx = sigilRect.left + sigilRect.width / 2 - (phantomRect.left + phantomRect.width / 2);
    const dy = sigilRect.top + sigilRect.height / 2 - (phantomRect.top + phantomRect.height / 2);

    const tl = gsap.timeline();
    tl.set(phantom, { opacity: 1, scale: 1, x: 0, y: 0 })
      .to(phantom, { x: dx, y: dy, scale, duration: 0.65, ease: "power3.inOut" }, 0)
      .to(phantom, { opacity: 0, duration: 0.18 }, 0.5)
      .to(sigilRef.current, { opacity: 1, duration: 0.18 }, 0.5)
      .to([wordmarkRef.current, accountRef.current], { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, 0.15)
      .to(bossEventRef.current, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, 0.22)
      .to(sidebarLeftRef.current, { opacity: 1, x: 0, duration: 0.5, ease: "power2.out" }, 0.32)
      .to(sidebarRightRef.current, { opacity: 1, x: 0, duration: 0.5, ease: "power2.out" }, 0.38)
      .to(heroMainRef.current, { opacity: 1, scale: 1, duration: 0.55, ease: "power2.out" }, 0.34)
      .to(footerRef.current, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, 0.55)
      .to(cornerRef.current, { opacity: 1, duration: 0.35, ease: "power1.out" }, 0.62);

    return () => tl.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Dezenter Lichtschein/Badge, sobald während der laufenden Session ein
  // neues Achievement freigeschaltet wird (Launcher-Update-TODO, Abschnitt 3)
  // - verschwindet wieder, sobald die Errungenschaften-Seite geöffnet wird.
  // Respektiert die "Neue Erfolge"-Einstellung (Abschnitt 6) sowie das
  // Stummschalten der UI-Töne - beide werden per Ref gehalten, da die
  // Einstellungen asynchron nachgeladen werden, das Abo aber sofort steht.
  const notifyAchievementsRef = useRef(true);
  const reduceMotionRef = useRef(false);
  const launchTimeoutRef = useRef(null);
  const gateCelebrationTimeoutRef = useRef(null);
  const returnMomentTimeoutRef = useRef(null);
  useEffect(() => {
    function applySettings(s) {
      notifyAchievementsRef.current = s.notify_achievements;
      reduceMotionRef.current = Boolean(s.reduce_motion);
      setHallSettings({
        atmosphere_enabled: s.atmosphere_enabled ?? true,
        ambient_sound: s.ambient_sound ?? false,
        ambient_volume: s.ambient_volume ?? 32,
        cursor_runes: s.cursor_runes ?? true,
      });
      setMuted(s.mute_ui_sounds);
      configureHallAmbience(s);
    }
    getSettings().then(applySettings).catch(() => {
      // Einstellungen sind rein lokal - sollte praktisch nie fehlschlagen,
      // fällt sonst auf die (aktivierten) Defaults zurück.
    });
    const unsubscribeSettings = subscribeSettingsChanged(applySettings);
    const unsubscribeUnlock = subscribeNewUnlock(() => {
      if (notifyAchievementsRef.current) setNewAchievementGlow(true);
    });
    return () => {
      unsubscribeSettings();
      unsubscribeUnlock();
    };
  }, []);

  // Läuft unabhängig vom Play-Button-Klick: der Rust-Backend meldet
  // Start/Ende des Minecraft-Prozesses selbst (z. B. auch wenn das Spiel
  // durch Verlassen des Servers automatisch beendet wird, siehe
  // launch.rs/game_commands.rs – Quick-Play-Feature).
  useEffect(() => {
    let unlistenStarted;
    let unlistenExited;
    onGameStarted(() => {
      window.clearTimeout(launchTimeoutRef.current);
      setLaunching(false);
      setGameRunning(true);
    }).then((fn) => {
      unlistenStarted = fn;
    });
    onGameExited(() => {
      window.clearTimeout(launchTimeoutRef.current);
      setLaunching(false);
      setGameRunning(false);
      setReturnMoment(true);
      window.clearTimeout(returnMomentTimeoutRef.current);
      returnMomentTimeoutRef.current = window.setTimeout(() => setReturnMoment(false), 6200);
      refreshStatus();
    }).then((fn) => {
      unlistenExited = fn;
    });
    return () => {
      window.clearTimeout(launchTimeoutRef.current);
      window.clearTimeout(gateCelebrationTimeoutRef.current);
      window.clearTimeout(returnMomentTimeoutRef.current);
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
      setLaunching(true);
      playGateIgnition();
      try {
        if (!reduceMotionRef.current && perfTier === "full") {
          await new Promise((resolve) => window.setTimeout(resolve, 820));
        }
        await launchGame();
        launchTimeoutRef.current = window.setTimeout(() => setLaunching(false), 15000);
        // gameRunning wird über das "game-started"-Event gesetzt, sobald der
        // Prozess wirklich läuft – busy hier nur für den kurzen Start-Moment.
      } catch (err) {
        setLaunching(false);
        playGateFailure();
        setActionError(err?.message ?? String(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    // "not_installed" oder "update_available" -> installieren/aktualisieren.
    setBusy(true);
    playGateIgnition();
    setProgress({ phase: "start", label: "Wird vorbereitet…", current: 0, total: 1 });
    try {
      await installOrUpdate((p) => setProgress(p));
      await refreshStatus();
      setGateCelebration(true);
      window.clearTimeout(gateCelebrationTimeoutRef.current);
      gateCelebrationTimeoutRef.current = window.setTimeout(() => setGateCelebration(false), 2800);
    } catch (err) {
      playGateFailure();
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
  const disabled = busy || launching || gameRunning || !status || status.state === "error";
  const percent =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : null;
  const statusMeta = gameRunning
    ? { label: "Minecraft läuft", detail: "Erzmark ist geöffnet", tone: "running" }
    : busy
      ? { label: progress?.label ?? "Wird vorbereitet", detail: percent != null ? `${percent}% abgeschlossen` : "Einen Moment…", tone: "busy" }
      : status?.state === "ready"
        ? { label: "Bereit zum Spielen", detail: `Fabric ${status.minecraft_version ?? ""}`.trim(), tone: "ready" }
        : status?.state === "update_available"
          ? { label: "Update verfügbar", detail: "Neue Inhalte warten", tone: "update" }
          : status?.state === "not_installed"
            ? { label: "Installation erforderlich", detail: "Erzmark wird für dich vorbereitet", tone: "install" }
            : status?.state === "error"
              ? { label: "Verbindung gestört", detail: "Details werden unten angezeigt", tone: "error" }
              : { label: "Status wird geprüft", detail: "Verbindung mit Erzmark", tone: "checking" };

  function handleStagePointerMove(event) {
    if (perfTier !== "full") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    event.currentTarget.style.setProperty("--stage-x", `${(x * 7).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--stage-y", `${(y * 4).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--stage-x-soft", `${(x * 4).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--stage-y-soft", `${(y * 3).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--stage-x-reverse", `${(x * -5).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--stage-pointer-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--stage-pointer-y", `${event.clientY - rect.top}px`);
  }

  function resetStagePointer(event) {
    event.currentTarget.style.setProperty("--stage-x", "0px");
    event.currentTarget.style.setProperty("--stage-y", "0px");
    event.currentTarget.style.setProperty("--stage-x-soft", "0px");
    event.currentTarget.style.setProperty("--stage-y-soft", "0px");
    event.currentTarget.style.setProperty("--stage-x-reverse", "0px");
  }

  return (
    <NotificationsProvider>
    <TalkProvider self={{ uuid: session?.uuid, name: session?.username }}>
    <div className="erzmark-main-screen" data-performance={perfTier} data-atmosphere={hallSettings.atmosphere_enabled ? "living" : "still"} data-cursor-runes={hallSettings.cursor_runes ? "true" : "false"}>
      <Embers tier={perfTier} />
      <LauncherUpdateBanner />
      <div ref={phantomLogoRef} className="erzmark-intro-phantom-logo" style={{ opacity: 0 }} aria-hidden="true" />

      <header className="erzmark-header">
        <div className="erzmark-header-brand">
          <div className="erzmark-sigil" ref={sigilRef} style={{ opacity: 0 }}>
            <div className="erzmark-logo erzmark-logo-small" />
          </div>
          <span className="erzmark-wordmark" ref={wordmarkRef} style={{ opacity: 0, transform: "translateY(-8px)" }}>
            Erzmark
          </span>
          <span className="erzmark-header-oath" aria-hidden="true">Die Pforte zum Grenzland</span>
        </div>
        <div className="erzmark-header-actions" ref={accountRef} style={{ opacity: 0, transform: "translateY(-8px)" }}>
          <NotificationBell />
          <div className="erzmark-account-plaque">
            <span className="erzmark-account-avatar">{(session?.username ?? "E").slice(0, 2).toUpperCase()}</span>
            <span className="erzmark-account-copy">
              <span className="erzmark-account-label">Angemeldet als</span>
              <span className="erzmark-account-name">{session?.username}</span>
            </span>
            <button className="erzmark-account-logout" onClick={handleLogout} disabled={loggingOut} title="Abmelden" aria-label="Abmelden">↗</button>
          </div>
        </div>
      </header>

      <div className="erzmark-body">
        <div ref={bossEventRef} style={{ opacity: 0, transform: "translateY(-8px)" }}>
          <BossEventCountdown />
        </div>

        <ForgeLayout
          profile={layoutProfile}
          modules={layoutModules}
          zoneRefs={{ left: sidebarLeftRef, right: sidebarRightRef, bottom: footerRef }}
          stageRef={heroMainRef}
          stage={
            <section className="erzmark-stage-shell" onPointerMove={handleStagePointerMove} onPointerLeave={resetStagePointer}>
              <div className="erzmark-stage-ambient" aria-hidden="true">
                <span className="erzmark-stage-vault" />
                <span className="erzmark-stage-arch" />
                <span className="erzmark-stage-column is-left" />
                <span className="erzmark-stage-column is-right" />
                <span className="erzmark-stage-banner is-left"><i>ᛖ</i></span>
                <span className="erzmark-stage-banner is-right"><i>ᛗ</i></span>
                <span className="erzmark-stage-brazier is-left"><i /></span>
                <span className="erzmark-stage-brazier is-right"><i /></span>
                <span className="erzmark-stage-rune-road" />
                <span className="erzmark-stage-orbit erzmark-stage-orbit-one" />
                <span className="erzmark-stage-orbit erzmark-stage-orbit-two" />
                <span className="erzmark-stage-mountain erzmark-stage-mountain-left" />
                <span className="erzmark-stage-mountain erzmark-stage-mountain-right" />
                <span className="erzmark-stage-floor" />
                <span className="erzmark-stage-cursor-aura"><i>ᚨ</i><i>ᛟ</i><i>ᚱ</i></span>
              </div>

              <LivingHall enabled={hallSettings.atmosphere_enabled} tier={perfTier} gameRunning={gameRunning} launching={launching} returnMoment={returnMoment} />

              <div className="erzmark-stage-topline">
                <div className="erzmark-stage-welcome"><span>Die Pforte erwartet dich</span><strong>{session?.username}</strong></div>
                <div className={`erzmark-stage-status is-${statusMeta.tone}`}><i /><span><strong>{statusMeta.label}</strong><small>{statusMeta.detail}</small></span></div>
              </div>

              <LauncherCompanion
                status={status}
                progress={progress}
                busy={busy}
                launching={launching}
                gameRunning={gameRunning}
                statusError={statusError}
                actionError={actionError}
              />

              <div className="erzmark-hero-stage">
                {heroSkinUrl ? (
                  <div className="erzmark-hero-skin is-mirror-v2">
                    <Suspense fallback={<div className="erzmark-hero-placeholder is-loading" aria-label="Skin wird geladen"><GemIcon spinning /></div>}>
                      <SkinMirror skinUrl={heroSkinUrl} width={260} height={360} emotes showFriends={showFriendsInMirror} />
                    </Suspense>
                    <button type="button" className="erzmark-link-btn erzmark-hero-skin-friends-toggle" onClick={() => setShowFriendsInMirror((v) => !v)} title="Online-Freunde im Skin Mirror anzeigen" aria-pressed={showFriendsInMirror}>👥</button>
                  </div>
                ) : (
                  <div className="erzmark-hero-placeholder" aria-hidden="true"><GemIcon /></div>
                )}
              </div>

              <div className="erzmark-stage-command">
                <WorldGate
                  status={status}
                  statusMeta={statusMeta}
                  progress={progress}
                  percent={percent}
                  busy={busy}
                  launching={launching}
                  gameRunning={gameRunning}
                  justPrepared={gateCelebration}
                  disabled={disabled}
                  buttonLabel={buttonLabel}
                  statusError={statusError}
                  actionError={actionError}
                  onAction={handleMainButton}
                  onRetryStatus={refreshStatus}
                >
                  {!busy && !launching && !gameRunning ? <ActiveCharacterCard /> : null}
                </WorldGate>
              </div>
            </section>
          }
        />
      </div>

      <div className="erzmark-bottom-left-corner" ref={cornerRef} style={{ opacity: 0 }}>
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

      {newAchievementGlow && <div className="erzmark-edge-glow-right" aria-hidden="true" />}

      <button
        type="button"
        className={`erzmark-edge-book-tab${newAchievementGlow ? " erzmark-edge-book-tab-notify" : ""}`}
        onClick={() => {
          setShowAchievements(true);
          setNewAchievementGlow(false);
        }}
        title="Die Schmiede öffnen"
        aria-label="Die Schmiede öffnen"
      >
        <span className="erzmark-edge-book-tab-icon">
          <TrophyIcon />
        </span>
        <span className="erzmark-edge-book-tab-arrow" aria-hidden="true">
          ‹
        </span>
      </button>

      <Suspense fallback={<PanelLoadingFallback />}>
        {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} />}
        {showFriendsLounge && <FriendsLounge onClose={() => setShowFriendsLounge(false)} />}
        {showProfile && <ProfileScreenModern session={session} onClose={() => setShowProfile(false)} />}
        {showFeedback && <FeedbackScreen onClose={() => setShowFeedback(false)} />}
        {showManager && <ManagerScreen onClose={() => setShowManager(false)} />}
        {showAchievements && (
          <AchievementsScreen
            playerName={session?.username}
            onClose={() => {
              setShowAchievements(false);
              setNewAchievementGlow(false);
            }}
          />
        )}
      </Suspense>

      <AnchorWidget />
    </div>
    </TalkProvider>
    </NotificationsProvider>
  );
}
