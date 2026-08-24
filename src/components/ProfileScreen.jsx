import { useEffect, useMemo, useState } from "react";
import DockTabs from "./DockTabs.jsx";
import SkinMirror from "./SkinMirror.jsx";
import { getCurrentSkinUrl } from "../api/skin.js";
import { getProfile, saveProfile, BANNER_PRESETS } from "../api/profileEditor.js";
import { getAchievements } from "../api/achievements.js";
import { getCharacterProfiles } from "../api/profiles.js";
import { getStatsHistory } from "../api/statsHistory.js";
import {
  getProfileMedia,
  uploadProfilePhoto,
  removeProfilePhoto,
  uploadProfileCover,
  removeProfileCover,
} from "../api/profileMedia.js";
import { listScreenshots } from "../api/screenshots.js";

function EditorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 20l1-4.5L15.5 5l4 4L9 19.5 4 20Z" />
      <path d="M13 6.5 17.5 11" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 8v4.5l3 2" />
      <circle cx="12" cy="12" r="8.5" />
    </svg>
  );
}

const MAX_FEATURED = 3;

function ProfileEditorTab() {
  const [skinUrl, setSkinUrl] = useState(null);
  const [profile, setProfile] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [saved, setSaved] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [coverBusy, setCoverBusy] = useState(null); // Filename des gerade anzupinnenden Screenshots, sonst null
  const [coverError, setCoverError] = useState(null);
  const [pinnedFilename, setPinnedFilename] = useState(null); // rein lokale UI-Markierung, siehe Kommentar unten
  const [screenshots, setScreenshots] = useState([]);

  useEffect(() => {
    getCurrentSkinUrl().then(setSkinUrl).catch(() => {});
    getProfile().then(setProfile);
    getAchievements()
      .then((list) => setAchievements(list.filter((a) => a.unlocked)))
      .catch(() => setAchievements([]));
    getProfileMedia()
      .then((media) => {
        setPhotoUrl(media.photoUrl);
        setCoverUrl(media.coverUrl);
      })
      .catch(() => {});
    listScreenshots(8)
      .then(setScreenshots)
      .catch(() => setScreenshots([]));
  }, []);

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const result = await uploadProfilePhoto(file);
      setPhotoUrl(result ?? null);
    } catch (err) {
      setPhotoError(err?.message ?? String(err));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handlePhotoRemove() {
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      await removeProfilePhoto();
      setPhotoUrl(null);
    } catch (err) {
      setPhotoError(err?.message ?? String(err));
    } finally {
      setPhotoBusy(false);
    }
  }

  /**
   * Session-Vitrine als Profilbanner: pinnt einen der letzten Screenshots
   * (siehe ScreenshotGallery.jsx/api/screenshots.js) als Titelbild über den
   * schon vorhandenen, bisher ungenutzten Cover-Endpunkt
   * (api/profileMedia.js uploadProfileCover/removeProfileCover, Backend
   * bereits fertig - social.rs/social_commands.rs). Genutzt wird bewusst
   * dasselbe kleine JPEG-Vorschaubild, das list_screenshots ohnehin schon
   * erzeugt (kein neuer Tauri-Command für die Originalauflösung) - für ein
   * Titelbild ausreichend, aber nicht in Druckqualität.
   */
  async function handlePinScreenshot(shot) {
    setCoverError(null);
    setCoverBusy(shot.filename);
    try {
      const res = await fetch(shot.thumbnail_data_url);
      const blob = await res.blob();
      const file = new File([blob], shot.filename.replace(/\.png$/i, ".jpg"), { type: "image/jpeg" });
      const url = await uploadProfileCover(file);
      setCoverUrl(url ?? null);
      setPinnedFilename(shot.filename);
    } catch (err) {
      setCoverError(err?.message ?? String(err));
    } finally {
      setCoverBusy(null);
    }
  }

  async function handleRemoveCover() {
    setCoverError(null);
    setCoverBusy("__remove__");
    try {
      await removeProfileCover();
      setCoverUrl(null);
      setPinnedFilename(null);
    } catch (err) {
      setCoverError(err?.message ?? String(err));
    } finally {
      setCoverBusy(null);
    }
  }

  function toggleFeatured(id) {
    setSaved(false);
    setProfile((prev) => {
      const already = prev.featuredAchievementIds.includes(id);
      if (already) {
        return { ...prev, featuredAchievementIds: prev.featuredAchievementIds.filter((x) => x !== id) };
      }
      if (prev.featuredAchievementIds.length >= MAX_FEATURED) return prev;
      return { ...prev, featuredAchievementIds: [...prev.featuredAchievementIds, id] };
    });
  }

  async function handleSave() {
    await saveProfile(profile);
    setSaved(true);
  }

  if (!profile) return <p className="erzmark-hint">Lädt…</p>;

  const banner = BANNER_PRESETS.find((b) => b.id === profile.bannerId) ?? BANNER_PRESETS[0];
  // Session-Vitrine: gepinnter Screenshot (auf dem Server gespeichert) hat
  // Vorrang, sonst automatisch der neueste lokale Screenshot als Vorschau
  // (rein clientseitig, wird NICHT automatisch hochgeladen - erst "Anpinnen"
  // persistiert etwas). Ganz ohne Screenshots bleibt es beim Farbverlauf.
  const latestScreenshot = screenshots[0] ?? null;
  const autoBannerImage = !coverUrl && latestScreenshot ? latestScreenshot.thumbnail_data_url : null;
  const bannerImage = coverUrl ?? autoBannerImage;
  const bannerStyle = bannerImage
    ? { backgroundImage: `url(${bannerImage})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: banner.gradient };

  return (
    <div className="erzmark-profile-editor" style={{ "--erzmark-profile-accent": banner.accent }}>
      <div className="erzmark-profile-editor-banner" style={bannerStyle}>
        {bannerImage && <div className="erzmark-profile-editor-banner-shade" />}
        {autoBannerImage && <span className="erzmark-profile-editor-banner-tag">Automatisch · neuester Screenshot</span>}
        {skinUrl && (
          <div className="erzmark-profile-editor-avatar">
            <SkinMirror skinUrl={skinUrl} width={72} height={94} />
          </div>
        )}
      </div>

      <div className="erzmark-feedback-field">
        <span>Profilbanner aus Screenshots</span>
        <p className="erzmark-hint">
          Einen deiner letzten Screenshots (F2 im Spiel) als Titelbild anpinnen. Ohne Auswahl wird automatisch
          der neueste Screenshot angezeigt, ohne dass etwas gespeichert wird.
        </p>
        {screenshots.length === 0 && (
          <p className="erzmark-gallery-empty">Noch keine Screenshots – drück F2 im Spiel, um einen zu machen.</p>
        )}
        {screenshots.length > 0 && (
          <div className="erzmark-gallery-grid">
            {screenshots.map((s) => (
              <button
                type="button"
                key={s.filename}
                className={`erzmark-gallery-thumb erzmark-profile-cover-thumb${
                  pinnedFilename === s.filename ? " is-pinned" : ""
                }`}
                onClick={() => handlePinScreenshot(s)}
                disabled={coverBusy != null}
                title={new Date(s.taken_at * 1000).toLocaleString("de-DE")}
              >
                <img src={s.thumbnail_data_url} alt="" />
                {coverBusy === s.filename && <span className="erzmark-profile-cover-thumb-busy">…</span>}
                {pinnedFilename === s.filename && <span className="erzmark-profile-cover-thumb-pin">📌</span>}
              </button>
            ))}
          </div>
        )}
        {coverUrl && (
          <button type="button" className="erzmark-link-btn" onClick={handleRemoveCover} disabled={coverBusy != null}>
            {coverBusy === "__remove__" ? "…" : "Banner entfernen"}
          </button>
        )}
        {coverError && <p className="erzmark-error">{coverError}</p>}
      </div>

      <div className="erzmark-feedback-field">
        <span>Profilbild</span>
        <p className="erzmark-hint">
          Eigenes Bild, das Freunde in ihrer Freundesliste sehen (getrennt vom Minecraft-Skin) – gilt für deinen
          Account, unabhängig davon, welchen Charakter du gerade spielst.
        </p>
        <div className="erzmark-profile-photo-row">
          <img
            className="erzmark-profile-photo-preview"
            src={photoUrl ?? "https://crafatar.com/avatars/steve?size=64&overlay"}
            alt=""
          />
          <label className="erzmark-btn-primary-small erzmark-profile-photo-upload">
            {photoBusy ? "…" : "Bild wählen"}
            <input type="file" accept="image/png,image/jpeg" onChange={handlePhotoChange} disabled={photoBusy} hidden />
          </label>
          {photoUrl && (
            <button type="button" className="erzmark-link-btn" onClick={handlePhotoRemove} disabled={photoBusy}>
              Entfernen
            </button>
          )}
        </div>
        {photoError && <p className="erzmark-error">{photoError}</p>}
      </div>

      <div className="erzmark-feedback-field">
        <span>Akzentfarbe</span>
        <p className="erzmark-hint">
          Färbt den Avatar-Rahmen oben und dient als Fallback-Hintergrund, solange kein Banner-Screenshot gepinnt ist.
        </p>
        <div className="erzmark-profile-banner-row">
          {BANNER_PRESETS.map((b) => (
            <button
              type="button"
              key={b.id}
              className={`erzmark-profile-banner-swatch${profile.bannerId === b.id ? " is-selected" : ""}`}
              style={{ background: b.gradient }}
              title={b.label}
              onClick={() => {
                setSaved(false);
                setProfile({ ...profile, bannerId: b.id });
              }}
            />
          ))}
        </div>
      </div>

      <label className="erzmark-feedback-field">
        <span>Bio</span>
        <textarea
          rows={3}
          maxLength={200}
          value={profile.bio}
          onChange={(e) => {
            setSaved(false);
            setProfile({ ...profile, bio: e.target.value });
          }}
          placeholder="Ein paar Worte über dich…"
        />
      </label>

      <div className="erzmark-feedback-field">
        <span>Sichtbare Erfolge/Titel (max. {MAX_FEATURED})</span>
        {achievements.length === 0 && <p className="erzmark-hint">Noch keine freigeschalteten Erfolge.</p>}
        <div className="erzmark-profile-featured-list">
          {achievements.map((a) => (
            <button
              type="button"
              key={a.id}
              className={`erzmark-profile-featured-chip${profile.featuredAchievementIds.includes(a.id) ? " is-selected" : ""}`}
              onClick={() => toggleFeatured(a.id)}
            >
              {a.icon} {a.title}
            </button>
          ))}
        </div>
      </div>

      <button className="erzmark-btn-primary-small" onClick={handleSave}>
        Speichern
      </button>
      {saved && <p className="erzmark-hint">Gespeichert.</p>}
    </div>
  );
}

function Sparkline({ values }) {
  const width = 320;
  const height = 70;
  const max = Math.max(1, ...values);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - (v / max) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" className="erzmark-history-sparkline">
      <polyline points={points} fill="none" stroke="var(--erzmark-color-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatsHistoryTab() {
  const [history, setHistory] = useState(null);
  const [level, setLevel] = useState(null);
  const [unlockedCount, setUnlockedCount] = useState(0);

  useEffect(() => {
    getStatsHistory().then(setHistory);
    getCharacterProfiles()
      .then((profiles) => setLevel(profiles.find((p) => p.active)?.level ?? null))
      .catch(() => {});
    getAchievements()
      .then((list) => setUnlockedCount(list.filter((a) => a.unlocked).length))
      .catch(() => {});
  }, []);

  const powerScore = useMemo(() => {
    if (!history) return null;
    const totalHours = history[history.length - 1].cumulativePlayTimeSeconds / 3600;
    return Math.round((level ?? 1) * 10 + unlockedCount * 25 + totalHours * 2);
  }, [history, level, unlockedCount]);

  if (!history) return <p className="erzmark-hint">Lädt…</p>;

  return (
    <div className="erzmark-profile-editor">
      <div className="erzmark-history-power">
        <span className="erzmark-ach-playtime-value">{powerScore}</span>
        <span className="erzmark-ach-playtime-label">Power-Score (Proxy-Kennzahl)</span>
      </div>
      <p className="erzmark-hint">
        Kein echtes Power-Score-System im Backend – Näherung aus Level ({level ?? "?"}) × 10, freigeschalteten Erfolgen (
        {unlockedCount}) × 25 und Gesamtspielzeit × 2.
      </p>

      <div className="erzmark-feedback-field">
        <span>Tägliche Spielzeit, letzte 14 Tage (simuliert)</span>
        <Sparkline values={history.map((h) => h.dailyPlayMinutes)} />
      </div>
    </div>
  );
}

/**
 * Profil-Screen (Launcher-Update-TODO, Abschnitt 6): Editor-Tab für Banner/
 * Bio/vorgestellte Erfolge (lokal per localStorage, siehe api/profileEditor.js
 * - kein "Erzmark Pass"-Backend, das ist ein eigenes größeres Vorhaben) und
 * ein Verlauf-Tab mit simuliertem Spielzeit-Trend + Power-Score-Proxy (siehe
 * api/statsHistory.js - es gibt keine echte historische Aufzeichnung im
 * Backend, nur den aktuellen Stand über profiles.js).
 */
export default function ProfileScreen({ onClose }) {
  const tabs = [
    { id: "editor", label: "Profil", Icon: EditorIcon, color: "gold", content: <ProfileEditorTab /> },
    { id: "history", label: "Verlauf", Icon: HistoryIcon, color: "blue", content: <StatsHistoryTab /> },
  ];

  return (
    <div className="erzmark-modal-backdrop" onClick={onClose}>
      <div className="erzmark-modal-panel erzmark-feedback-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="erzmark-modal-header">
          <h2>Profil</h2>
          <button className="erzmark-modal-close" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
        <div className="erzmark-modal-body">
          <DockTabs tabs={tabs} />
        </div>
      </div>
    </div>
  );
}
