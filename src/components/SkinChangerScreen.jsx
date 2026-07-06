import { useEffect, useState } from "react";
import { getCurrentSkinUrl, resetSkin, setSkinUrl, uploadSkinFile } from "../api/skin.js";
import SkinMirror from "./SkinMirror.jsx";

/**
 * Skin-Wechsler über Mojangs offizielle Skin-API (nicht über die
 * Erzmark-Webseite) – braucht den echten, freigeschalteten Minecraft-Login.
 * Bis die Mojang-API-Freischaltung durch ist, schlagen alle Aktionen hier
 * erwartungsgemäß mit einer Fehlermeldung fehl.
 */
export default function SkinChangerScreen({ onClose }) {
  const [currentUrl, setCurrentUrl] = useState(null);
  const [variant, setVariant] = useState("classic");
  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    try {
      setCurrentUrl(await getCurrentSkinUrl());
    } catch (err) {
      setError(err?.message ?? String(err));
    }
  }

  async function runAction(fn, successMessage) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(successMessage);
      await refresh();
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    await runAction(() => uploadSkinFile(variant, file), "Skin hochgeladen!");
    e.target.value = "";
  }

  return (
    <div className="erzmark-modal-backdrop" onClick={onClose}>
      <div className="erzmark-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="erzmark-modal-header">
          <h2>Skin ändern</h2>
          <button className="erzmark-modal-close" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>

        <div className="erzmark-modal-body">
          <div className="erzmark-skin-preview">
            <SkinMirror skinUrl={currentUrl} />
          </div>

          <section className="erzmark-settings-section">
            <h3>Modell</h3>
            <div className="erzmark-settings-actions">
              <label className="erzmark-settings-toggle">
                <input
                  type="radio"
                  name="variant"
                  checked={variant === "classic"}
                  onChange={() => setVariant("classic")}
                />
                <span>Classic (Steve)</span>
              </label>
              <label className="erzmark-settings-toggle">
                <input
                  type="radio"
                  name="variant"
                  checked={variant === "slim"}
                  onChange={() => setVariant("slim")}
                />
                <span>Slim (Alex)</span>
              </label>
            </div>
          </section>

          <section className="erzmark-settings-section">
            <h3>Datei hochladen</h3>
            <input type="file" accept="image/png" onChange={handleFileChange} disabled={busy} />
          </section>

          <section className="erzmark-settings-section">
            <h3>Von URL setzen</h3>
            <div className="erzmark-settings-actions">
              <input
                className="erzmark-skin-url-input"
                type="text"
                placeholder="https://…"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <button
                className="erzmark-rune-btn-inline"
                onClick={() => runAction(() => setSkinUrl(variant, urlInput.trim()), "Skin aktualisiert!")}
                disabled={busy || !urlInput.trim()}
              >
                Anwenden
              </button>
            </div>
          </section>

          <section className="erzmark-settings-section">
            <button
              className="erzmark-rune-btn-inline erzmark-rune-btn-danger"
              onClick={() => runAction(resetSkin, "Skin zurückgesetzt.")}
              disabled={busy}
            >
              Skin zurücksetzen
            </button>
          </section>

          {message && <p className="erzmark-hint">{message}</p>}
          {error && <p className="erzmark-error">{error}</p>}
        </div>

        <div className="erzmark-modal-footer">
          <span className="erzmark-hint">Wirkt direkt auf deinen Minecraft-Account.</span>
        </div>
      </div>
    </div>
  );
}
