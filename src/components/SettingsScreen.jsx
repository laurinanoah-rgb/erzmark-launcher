import { useEffect, useState } from "react";
import {
  getLauncherVersion,
  getSettings,
  openGameFolder,
  openLogFile,
  resetInstallation,
  saveSettings,
} from "../api/settings.js";
import { broadcastSettingsChanged } from "../state/settingsBus.js";
import { setPerformanceTierOverride } from "../utils/performanceTier.js";

const MEMORY_MIN = 512;
const MEMORY_MAX = 16384;
const MEMORY_STEP = 512;

const CATEGORIES = [
  { id: "general", label: "Allgemein", icon: "🎮" },
  { id: "performance", label: "Leistung", icon: "⚙️" },
  { id: "notifications", label: "Benachrichtigungen", icon: "🔔" },
  { id: "data", label: "Daten & Fehlerbehebung", icon: "🛠️" },
];

export default function SettingsScreen({ onClose }) {
  const [settings, setSettings] = useState(null);
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [activeCategory, setActiveCategory] = useState("general");

  useEffect(() => {
    Promise.all([getSettings(), getLauncherVersion()])
      .then(([s, v]) => {
        setSettings(s);
        setVersion(v);
      })
      .catch((err) => setError(err?.message ?? String(err)))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveSettings(settings);
      setPerformanceTierOverride(settings.performance_tier_override);
      broadcastSettingsChanged(settings);
      onClose();
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(fn, successMessage) {
    setActionMessage(null);
    setError(null);
    try {
      await fn();
      if (successMessage) setActionMessage(successMessage);
    } catch (err) {
      setError(err?.message ?? String(err));
    }
  }

  async function handleReset() {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    await handleAction(
      resetInstallation,
      "Installation zurückgesetzt – beim nächsten Öffnen wird neu installiert/geprüft."
    );
    setConfirmingReset(false);
  }

  return (
    <div className="erzmark-modal-backdrop" onClick={onClose}>
      <div
        className="erzmark-modal-panel erzmark-modal-panel-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="erzmark-modal-header">
          <h2>Einstellungen</h2>
          <button className="erzmark-modal-close" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>

        {loading && <p className="erzmark-hint">Lädt…</p>}

        {!loading && settings && (
          <div className="erzmark-settings-layout">
            <nav className="erzmark-settings-nav">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className={
                    "erzmark-settings-nav-item" +
                    (activeCategory === cat.id ? " erzmark-settings-nav-item-active" : "")
                  }
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <span className="erzmark-settings-nav-icon">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </nav>

            <div className="erzmark-modal-body erzmark-settings-content">
              {activeCategory === "general" && (
                <section className="erzmark-settings-section">
                  <h3>Gameplay</h3>
                  <label className="erzmark-settings-toggle">
                    <input
                      type="checkbox"
                      checked={settings.lock_fov}
                      onChange={(e) => setSettings({ ...settings, lock_fov: e.target.checked })}
                    />
                    <span>FOV auf 70 sperren (empfohlen für Erzmark)</span>
                  </label>
                  <p className="erzmark-hint">
                    Wird bei jedem Start automatisch zurückgesetzt. Während einer laufenden
                    Session kurz änderbar, ab dem nächsten Start wieder fix bei 70.
                  </p>
                </section>
              )}

              {activeCategory === "performance" && (
                <>
                  <section className="erzmark-settings-section">
                    <h3>Arbeitsspeicher</h3>
                    <label className="erzmark-settings-row">
                      <span>Minimum</span>
                      <input
                        type="range"
                        min={MEMORY_MIN}
                        max={settings.memory_max_mb}
                        step={MEMORY_STEP}
                        value={settings.memory_min_mb}
                        onChange={(e) =>
                          setSettings({ ...settings, memory_min_mb: Number(e.target.value) })
                        }
                      />
                      <span className="erzmark-settings-value">{settings.memory_min_mb} MB</span>
                    </label>
                    <label className="erzmark-settings-row">
                      <span>Maximum</span>
                      <input
                        type="range"
                        min={settings.memory_min_mb}
                        max={MEMORY_MAX}
                        step={MEMORY_STEP}
                        value={settings.memory_max_mb}
                        onChange={(e) =>
                          setSettings({ ...settings, memory_max_mb: Number(e.target.value) })
                        }
                      />
                      <span className="erzmark-settings-value">{settings.memory_max_mb} MB</span>
                    </label>
                  </section>

                  <section className="erzmark-settings-section">
                    <h3>Animations-Stufe</h3>
                    <label className="erzmark-settings-row">
                      <span>Performance-Stufe</span>
                      <select
                        className="erzmark-settings-select"
                        value={settings.performance_tier_override}
                        onChange={(e) =>
                          setSettings({ ...settings, performance_tier_override: e.target.value })
                        }
                      >
                        <option value="auto">Automatisch (empfohlen)</option>
                        <option value="full">Voll (alle Animationen)</option>
                        <option value="reduced">Reduziert (weniger Effekte)</option>
                      </select>
                    </label>
                    <p className="erzmark-hint">
                      Steuert Boot-Animation, Skin Mirror, Erfolge-Buch und Tab-Übergänge.
                      "Automatisch" schätzt anhand von Prozessorkernen/Systemeinstellung. Eine
                      Änderung greift ab dem nächsten Start des Launchers.
                    </p>
                  </section>
                </>
              )}

              {activeCategory === "notifications" && (
                <section className="erzmark-settings-section">
                  <h3>Benachrichtigungen</h3>
                  <label className="erzmark-settings-toggle">
                    <input
                      type="checkbox"
                      checked={settings.notify_friend_requests}
                      onChange={(e) =>
                        setSettings({ ...settings, notify_friend_requests: e.target.checked })
                      }
                    />
                    <span>Freundschaftsanfragen (Glocke im Header)</span>
                  </label>
                  <label className="erzmark-settings-toggle">
                    <input
                      type="checkbox"
                      checked={settings.notify_achievements}
                      onChange={(e) =>
                        setSettings({ ...settings, notify_achievements: e.target.checked })
                      }
                    />
                    <span>Neue Erfolge (Lichtschein + Badge)</span>
                  </label>
                  <label className="erzmark-settings-toggle">
                    <input
                      type="checkbox"
                      checked={!settings.mute_ui_sounds}
                      onChange={(e) =>
                        setSettings({ ...settings, mute_ui_sounds: !e.target.checked })
                      }
                    />
                    <span>Töne (Erfolge, Buch-Seiten umblättern)</span>
                  </label>
                  <p className="erzmark-hint">
                    Boss-Event-Countdown und Update-Hinweise lassen sich bewusst nicht
                    stummschalten – das sind dauerhafte Status-Anzeigen bzw. ein nötiger
                    Handlungsaufruf, kein optionaler Hinweis.
                  </p>
                </section>
              )}

              {activeCategory === "data" && (
                <section className="erzmark-settings-section">
                  <h3>Daten &amp; Fehlerbehebung</h3>
                  <div className="erzmark-settings-actions">
                    <button
                      className="erzmark-rune-btn-inline"
                      onClick={() => handleAction(openGameFolder)}
                    >
                      Spielordner öffnen
                    </button>
                    <button
                      className="erzmark-rune-btn-inline"
                      onClick={() => handleAction(openLogFile)}
                    >
                      Log-Datei öffnen
                    </button>
                    <button
                      className="erzmark-rune-btn-inline erzmark-rune-btn-danger"
                      onClick={handleReset}
                    >
                      {confirmingReset ? "Wirklich zurücksetzen?" : "Installation zurücksetzen"}
                    </button>
                  </div>
                  {actionMessage && <p className="erzmark-hint">{actionMessage}</p>}
                </section>
              )}

              {error && <p className="erzmark-error">{error}</p>}
            </div>
          </div>
        )}

        <div className="erzmark-modal-footer">
          <span className="erzmark-hint">Launcher v{version}</span>
          <button className="erzmark-btn-primary-small" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
