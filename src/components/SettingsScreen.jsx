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
import LauncherPage from "./LauncherPage.jsx";
import { SkinChangerContent } from "./SkinChangerScreen.jsx";
import { detectDisplayProfile } from "../utils/displayPreferences.js";

const MEMORY_MIN = 512;
const MEMORY_MAX = 16384;
const MEMORY_STEP = 512;

const CATEGORIES = [
  { id: "general", label: "Allgemein", icon: "⚔", room: "Kampfkammer" },
  { id: "minecraft", label: "Minecraft & Skin", icon: "◇", room: "Rüstungskammer" },
  { id: "display", label: "Anzeige & Barrierefreiheit", icon: "◐", room: "Seherkammer" },
  { id: "atmosphere", label: "Hallen-Atmosphäre", icon: "ᛟ", room: "Runenhalle" },
  { id: "performance", label: "Leistung", icon: "⚒", room: "Schmiedewerk" },
  { id: "notifications", label: "Benachrichtigungen", icon: "♬", room: "Heroldturm" },
  { id: "data", label: "Daten & Fehlerbehebung", icon: "⚙", room: "Werkbank" },
];

function HallPreview({ settings }) {
  return (
    <div className={`erzmark-settings-hall-preview${settings.atmosphere_enabled ?? true ? " is-living" : " is-still"}`} aria-hidden="true">
      <span className="is-arch" /><span className="is-banner is-left">ᛖ</span><span className="is-banner is-right">ᛗ</span>
      <span className="is-gate">◇</span><i className="is-fire is-left" /><i className="is-fire is-right" />
      <small>{settings.atmosphere_enabled ?? true ? "Living Hall aktiv" : "Ruhige Halle"}</small>
    </div>
  );
}

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
    <LauncherPage
      title="Einstellungen"
      eyebrow="Launcher anpassen"
      onClose={onClose}
      className="erzmark-settings-page"
      footer={
        <>
          <span className="erzmark-hint">Launcher v{version}</span>
          <button className="erzmark-btn-primary-small" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Speichert…" : "Änderungen speichern"}
          </button>
        </>
      }
    >
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
                  data-category={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <span className="erzmark-settings-nav-icon">{cat.icon}</span>
                  <span><strong>{cat.label}</strong><small>{cat.room}</small></span>
                </button>
              ))}
            </nav>

            <div className="erzmark-modal-body erzmark-settings-content">
              {activeCategory === "general" && (
                <section className="erzmark-settings-section" data-setting-room="combat">
                  <div className="erzmark-settings-section-heading"><i>⚔</i><span><small>Kampfkammer</small><h3>Gameplay</h3></span></div>
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

              {activeCategory === "minecraft" && <SkinChangerContent />}

              {activeCategory === "display" && (
                <>
                  <section className="erzmark-settings-section" data-setting-room="vision">
                    <div className="erzmark-settings-section-heading"><i>◐</i><span><small>Seherkammer</small><h3>Intelligente Anzeige</h3></span></div>
                    <label className="erzmark-settings-row">
                      <span>Anzeige-Voreinstellung</span>
                      <select
                        className="erzmark-settings-select"
                        value={settings.display_preset ?? "auto"}
                        onChange={(e) =>
                          setSettings({ ...settings, display_preset: e.target.value })
                        }
                      >
                        <option value="auto">Automatisch (empfohlen)</option>
                        <option value="16:9">16:9</option>
                        <option value="21:9">21:9 / Ultrawide</option>
                      </select>
                    </label>
                    <div className="erzmark-display-detection">
                      <span>Aktuell erkannt</span>
                      <strong>{detectDisplayProfile()}</strong>
                      <small>
                        Die Erkennung reagiert automatisch auf Monitor, Vollbild und Fenstergröße.
                      </small>
                    </div>
                  </section>

                  <section className="erzmark-settings-section" data-setting-room="accessibility">
                    <div className="erzmark-settings-section-heading"><i>✦</i><span><small>Runenschrift</small><h3>Lesbarkeit &amp; Bedienung</h3></span></div>
                    <label className="erzmark-settings-row">
                      <span>Größe der Oberfläche</span>
                      <select
                        className="erzmark-settings-select"
                        value={settings.ui_scale ?? "normal"}
                        onChange={(e) => setSettings({ ...settings, ui_scale: e.target.value })}
                      >
                        <option value="compact">Kompakt (90 %)</option>
                        <option value="normal">Standard (100 %)</option>
                        <option value="large">Groß (114 %)</option>
                        <option value="extra_large">Sehr groß (128 %)</option>
                      </select>
                    </label>
                    <label className="erzmark-settings-row">
                      <span>Textgröße</span>
                      <select
                        className="erzmark-settings-select"
                        value={settings.text_scale ?? "normal"}
                        onChange={(e) => setSettings({ ...settings, text_scale: e.target.value })}
                      >
                        <option value="normal">Standard</option>
                        <option value="large">Groß</option>
                        <option value="extra_large">Sehr groß</option>
                      </select>
                    </label>
                    <label className="erzmark-settings-toggle">
                      <input
                        type="checkbox"
                        checked={settings.high_contrast ?? false}
                        onChange={(e) =>
                          setSettings({ ...settings, high_contrast: e.target.checked })
                        }
                      />
                      <span>Hoher Kontrast für Texte, Rahmen und Bedienelemente</span>
                    </label>
                    <label className="erzmark-settings-toggle">
                      <input
                        type="checkbox"
                        checked={settings.reduce_motion ?? false}
                        onChange={(e) =>
                          setSettings({ ...settings, reduce_motion: e.target.checked })
                        }
                      />
                      <span>Bewegungen und Animationen reduzieren</span>
                    </label>
                    <p className="erzmark-hint">
                      Die Einstellungen werden nach dem Speichern sofort angewendet. UI- und
                      Textskalierung werden kombiniert; der 21:9-Modus vergrößert die gesamte
                      Oberfläche, nicht nur einzelne Texte.
                    </p>
                  </section>

                  <section className="erzmark-settings-section erzmark-forge-settings-card">
                    <div>
                      <span>ForgeLayout</span>
                      <strong>Dein Launcher, deine Docks</strong>
                      <p>
                        Auf der Hauptseite öffnet „Layout bearbeiten“ den Dock-Editor. Freunde,
                        Gilde, Karte, News, Spielstände, Galerie und Menü lassen sich frei
                        andocken, stapeln, lösen oder ausblenden.
                      </p>
                    </div>
                    <small>Layouts werden für 16:9 und 21:9 getrennt gespeichert.</small>
                  </section>
                </>
              )}

              {activeCategory === "atmosphere" && (
                <div className="erzmark-settings-atmosphere-grid">
                  <section className="erzmark-settings-section" data-setting-room="atmosphere">
                    <div className="erzmark-settings-section-heading"><i>ᛟ</i><span><small>Runenhalle</small><h3>Lebendige Halle</h3></span></div>
                    <label className="erzmark-settings-toggle">
                      <input type="checkbox" checked={settings.atmosphere_enabled ?? true} onChange={(e) => setSettings({ ...settings, atmosphere_enabled: e.target.checked })} />
                      <span>Licht, Nebel, Glut, Banner und persönliche Trophäen beleben</span>
                    </label>
                    <label className="erzmark-settings-toggle">
                      <input type="checkbox" checked={settings.cursor_runes ?? true} onChange={(e) => setSettings({ ...settings, cursor_runes: e.target.checked })} />
                      <span>Arkane Runen reagieren dezent auf den Mauszeiger</span>
                    </label>
                    <p className="erzmark-hint">Erfolge werden ausschließlich aus deinen wirklich freigeschalteten Geschichten ausgewählt. Es werden keine Trophäen simuliert.</p>
                  </section>

                  <section className="erzmark-settings-section" data-setting-room="sound">
                    <div className="erzmark-settings-section-heading"><i>♬</i><span><small>Hallenklang</small><h3>Ambient Soundscape</h3></span></div>
                    <label className="erzmark-settings-toggle">
                      <input type="checkbox" checked={settings.ambient_sound ?? false} disabled={settings.mute_ui_sounds} onChange={(e) => setSettings({ ...settings, ambient_sound: e.target.checked })} />
                      <span>Leises Feuerknistern und arkanes Summen</span>
                    </label>
                    <label className="erzmark-settings-row">
                      <span>Lautstärke</span>
                      <input type="range" min="0" max="100" step="5" disabled={!settings.ambient_sound || settings.mute_ui_sounds} value={settings.ambient_volume ?? 32} onChange={(e) => setSettings({ ...settings, ambient_volume: Number(e.target.value) })} />
                      <span className="erzmark-settings-value">{settings.ambient_volume ?? 32}%</span>
                    </label>
                    {settings.mute_ui_sounds && <p className="erzmark-hint">Aktiviere zuerst die Töne im Heroldturm.</p>}
                  </section>

                  <HallPreview settings={settings} />
                </div>
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
    </LauncherPage>
  );
}
