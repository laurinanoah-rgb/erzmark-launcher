import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import LoadingSpinner from "./components/LoadingSpinner.jsx";
import BootAnimation from "./components/BootAnimation.jsx";
import { tryRestoreSession } from "./api/auth.js";
import { DEV_MANIFEST } from "./api/devManifest.js";
import { checkForLauncherUpdate } from "./api/appUpdater.js";
import { getPerformanceTier } from "./utils/performanceTier.js";
import { getSettings } from "./api/settings.js";
import { subscribeSettingsChanged } from "./state/settingsBus.js";
import {
  DEFAULT_DISPLAY_PREFERENCES,
  resolveDisplayPreferences,
} from "./utils/displayPreferences.js";

const LoginScreen = lazy(() => import("./components/LoginScreen.jsx"));
const MainScreen = lazy(() => import("./components/MainScreen.jsx"));
const UpdateVideoScreen = lazy(() => import("./components/UpdateVideoScreen.jsx"));
const UpdateAvailableScreen = lazy(() => import("./components/UpdateAvailableScreen.jsx"));

// Merkt sich lokal, welche Client-Version das Update-Video schon gezeigt
// bekommen hat, damit es nur einmal pro neuem Update abgespielt wird (nicht
// bei jedem Start). Sobald das echte Manifest-System angebunden ist, bleibt
// diese Logik unverändert – nur DEV_MANIFEST wird durch den Server-Fetch ersetzt.
const SEEN_VIDEO_KEY = "erzmark_last_seen_video_version";

function shouldShowUpdateVideo() {
  if (!DEV_MANIFEST.updateVideoUrl) return false;
  const lastSeen = window.localStorage.getItem(SEEN_VIDEO_KEY);
  return lastSeen !== DEV_MANIFEST.clientVersion;
}

export default function App() {
  // updateCheck | updateAvailable | checking | login | updateVideo | loggedIn
  const [status, setStatus] = useState("updateCheck");
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [session, setSession] = useState(null);
  const [restoreError, setRestoreError] = useState(null);
  const [bootDone, setBootDone] = useState(false);
  const [perfTier] = useState(getPerformanceTier);
  const [displaySettings, setDisplaySettings] = useState(DEFAULT_DISPLAY_PREFERENCES);
  const [viewportRevision, setViewportRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((settings) => {
        if (!cancelled) setDisplaySettings(settings);
      })
      .catch(() => {});

    const unsubscribe = subscribeSettingsChanged(setDisplaySettings);
    let resizeTimer;
    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => setViewportRevision((value) => value + 1), 120);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      unsubscribe();
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const display = resolveDisplayPreferences(displaySettings, viewportRevision);
  const handleBootComplete = useCallback(() => setBootDone(true), []);

  // Prüft/stellt die gespeicherte Login-Session wieder her und wählt den
  // passenden Folge-Screen. Wird sowohl direkt beim Start aufgerufen (wenn
  // kein Launcher-Update gefunden wurde) als auch nach einem Klick auf
  // "Ohne Update fortfahren" im UpdateAvailableScreen.
  function runSessionCheck() {
    setStatus("checking");
    tryRestoreSession()
      .then((result) => {
        if (result) {
          setSession(result);
          setStatus(shouldShowUpdateVideo() ? "updateVideo" : "loggedIn");
        } else {
          setStatus("login");
        }
      })
      .catch((err) => {
        setRestoreError(err?.message ?? String(err));
        setStatus("login");
      });
  }

  useEffect(() => {
    let cancelled = false;

    // Beim Start zuerst prüfen, ob es ein neues Launcher-Update gibt. Falls
    // ja, wird VOR Login/Startbildschirm ein zentrierter Update-Bildschirm
    // gezeigt (UpdateAvailableScreen) – die Installation läuft erst nach
    // Klick auf "Jetzt aktualisieren", nicht mehr automatisch im
    // Hintergrund. Ist kein Update da oder der Update-Server nicht
    // erreichbar, wird der Start dadurch nicht blockiert.
    checkForLauncherUpdate()
      .then((update) => {
        if (cancelled) return;
        if (!update) {
          runSessionCheck();
          return;
        }
        setPendingUpdate(update);
        setStatus("updateAvailable");
      })
      .catch(() => {
        if (!cancelled) runSessionCheck();
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleContinueWithoutUpdate() {
    setPendingUpdate(null);
    runSessionCheck();
  }

  function handleLoggedIn(info) {
    setSession(info);
    setStatus(shouldShowUpdateVideo() ? "updateVideo" : "loggedIn");
  }

  function handleVideoDone() {
    window.localStorage.setItem(SEEN_VIDEO_KEY, DEV_MANIFEST.clientVersion);
    setStatus("loggedIn");
  }

  function handleLoggedOut() {
    setSession(null);
    setStatus("login");
  }

  return (
    <div
      className="erzmark-app"
      data-performance={perfTier}
      data-display-profile={display.profile}
      data-ui-scale={display.ui_scale}
      data-text-scale={display.text_scale}
      data-high-contrast={display.high_contrast ? "true" : "false"}
      data-reduce-motion={display.reduce_motion ? "true" : "false"}
      style={{
        zoom: display.zoom,
        width: "100%",
        height: "100%",
        WebkitTextSizeAdjust: display.textAdjust,
        textSizeAdjust: display.textAdjust,
      }}
    >
      {!bootDone && (
        <BootAnimation
          tier={perfTier}
          profile={display.profile}
          reduceMotion={display.reduce_motion}
          onComplete={handleBootComplete}
        />
      )}
      {status === "updateCheck" && <LoadingSpinner label="Suche nach Updates…" />}
      <Suspense fallback={<LoadingSpinner label="Oberfläche wird vorbereitet…" />}>
        {status === "updateAvailable" && pendingUpdate && (
          <UpdateAvailableScreen
            update={pendingUpdate}
            onContinueWithoutUpdate={handleContinueWithoutUpdate}
          />
        )}
        {status === "checking" && <LoadingSpinner label="Sitzung wird geprüft…" />}
        {status === "login" && (
          <LoginScreen initialError={restoreError} onLoggedIn={handleLoggedIn} />
        )}
        {status === "updateVideo" && (
          <UpdateVideoScreen videoUrl={DEV_MANIFEST.updateVideoUrl} onDone={handleVideoDone} />
        )}
        {status === "loggedIn" && (
          <MainScreen session={session} onLoggedOut={handleLoggedOut} />
        )}
      </Suspense>
    </div>
  );
}
