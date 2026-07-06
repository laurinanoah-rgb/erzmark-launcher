import { useState } from "react";
import { login } from "../api/auth.js";

export default function LoginScreen({ onLoggedIn, initialError }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError ?? null);

  async function handleLogin() {
    setPending(true);
    setError(null);
    try {
      const info = await login();
      onLoggedIn(info);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="erzmark-login-screen">
      <div className="erzmark-logo erzmark-logo-hero" aria-label="Erzmark" />
      <h1 className="erzmark-title">Erzmark</h1>
      <p className="erzmark-subtitle">
        Melde dich mit deinem Microsoft-Account an, um Erzmark zu spielen.
      </p>

      <button
        className="erzmark-btn erzmark-btn-primary"
        onClick={handleLogin}
        disabled={pending}
      >
        {pending ? "Anmeldung läuft im Browser…" : "Mit Microsoft anmelden"}
      </button>

      {pending && (
        <p className="erzmark-hint">
          Ein Browserfenster wurde geöffnet. Nach dem Login kannst du es
          schließen – der Launcher erkennt das automatisch.
        </p>
      )}

      {error && <p className="erzmark-error">{error}</p>}

      {import.meta.env.DEV && (
        <button
          className="erzmark-link-btn"
          onClick={() =>
            onLoggedIn({
              username: "TestSpieler",
              uuid: "00000000-0000-0000-0000-000000000000",
            })
          }
        >
          [Dev] Ohne Login weiter – nur zum Testen von Installieren/Update
          (Spielen-Button braucht weiterhin echten Login)
        </button>
      )}
    </div>
  );
}
