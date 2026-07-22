import { useEffect, useMemo, useState } from "react";
import DockTabs from "./DockTabs.jsx";
import SkinMirror from "./SkinMirror.jsx";
import { getCurrentSkinUrl } from "../api/skin.js";
import { getProfile, saveProfile, BANNER_PRESETS } from "../api/profileEditor.js";
import { getAchievements } from "../api/achievements.js";
import { getCharacterProfiles } from "../api/profiles.js";
import { getStatsHistory } from "../api/statsHistory.js";
import { getProfileMedia, uploadProfilePhoto, removeProfilePhoto } from "../api/profileMedia.js";

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

  useEffect(() => {
    getCurrentSkinUrl().then(setSkinUrl).catch(() => {});
    getProfile().then(setProfile);
    getAchievements()
      .then((list) => setAchievements(list.filter((a) => a.unlocked)))
      .catch(() => setAchievements([]));
    getProfileMedia()
      .then((media) => setPhotoUrl(media.photoUrl))
      .catch(() => {});
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

  return (
    <div className="erzmark-profile-editor">
      <div className="erzmark-profile-editor-banner" style={{ background: banner.gradient }}>
        {skinUrl && (
          <div className="erzmark-profile-editor-avatar">
            <SkinMirror skinUrl={skinUrl} width={72} height={94} />
          </div>
        )}
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
        <span>Banner</span>
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
