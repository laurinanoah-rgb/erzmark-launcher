import { useEffect, useState } from "react";
import LoginScreen from "./components/LoginScreen.jsx";
import MainScreen from "./components/MainScreen.jsx";
import LoadingSpinner from "./components/LoadingSpinner.jsx";
import UpdateVideoScreen from "./components/UpdateVideoScreen.jsx";
import { tryRestoreSession } from "./api/auth.js";
import { DEV_MANIFEST } from "./api/devManifest.js";
import { checkForLauncherUpdate, installLauncherUpdate } from "./api/appUpdater.js";

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
  // updateCheck | updating | checking | login | updateVideo | loggedIn
  const [status, setStatus] = useState("updateCheck");
  const [updateProgress, setUpdateProgress] = useState(null);
  const [session, setSession] = useState(null);
  const [restoreError, setRestoreError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    function proceedToSessionCheck() {
      if (cancelled) return;
      setStatus("checking");
      tryRestoreSession()
        .then((result) => {
          if (cancelled) return;
          if (result) {
            setSession(result);
            setStatus(shouldShowUpdateVideo() ? "updateVideo" : "loggedIn");
          } else {
            setStatus("login");
          }
        })
        .catch((err) => {
          if (cancelled) return;
          setRestoreError(err?.message ?? String(err));
          setStatus("login");
        });
    }

    // Beim Start zuerst prüfen, ob es ein neues Launcher-Update gibt – und
    // falls ja, es automatisch ohne Rückfrage herunterladen/installieren
    // (wie bei anderen bekannten Launchern). Erst danach geht's normal mit
    // Login/Session weiter. Ist kein Update da oder der Update-Server nicht
    // erreichbar, wird der Start dadurch nicht blockiert.
    checkForLauncherUpdate()
      .then(async (update) => {
        if (cancelled) return;
        if (!update) {
          proceedToSessionCheck();
          return;
        }
        setStatus("updating");
        try {
          await installLauncherUpdate(update, setUpdateProgress);
          // installLauncherUpdate startet die App am Ende neu (relaunch) –
          // ab hier läuft normalerweise schon die neue Version.
        } catch (err) {
          // Update-Installation fehlgeschlagen (z.B. Berechtigungen) – nicht
          // blockieren, normal weitermachen mit der aktuellen Version.
          if (!cancelled) proceedToSessionCheck();
        }
      })
      .catch(() => {
        proceedToSessionCheck();
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
    <div className="erzmark-app">
      {status === "updateCheck" && <LoadingSpinner label="Suche nach Updates…" />}
      {status === "updating" && (
        <LoadingSpinner
          label={`Update wird installiert${
            updateProgress != null ? ` – ${updateProgress}%` : "…"
          }`}
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
    </div>
  );
}
