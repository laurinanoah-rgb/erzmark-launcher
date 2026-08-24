import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import LauncherPage from "./LauncherPage.jsx";
import { getCurrentSkinUrl } from "../api/skin.js";
import { getCachedProfile, getProfile, saveProfile, BANNER_PRESETS } from "../api/profileEditor.js";
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

const MAX_FEATURED = 3;
const SkinMirror = lazy(() => import("./SkinMirror.jsx"));
const SHOWCASE_CATEGORIES = {
  milestones: { label: "Meilenstein", color: "#ff9a3c" },
  gaming: { label: "Lebensspur", color: "#ffb900" },
  social: { label: "Verbundenheit", color: "#42b7fa" },
  discovery: { label: "Entdeckung", color: "#b96bff" },
};

function getAchievementStory(achievement) {
  if (achievement.contextSentence) return achievement.contextSentence;
  const source = `${achievement.title ?? ""} ${achievement.description ?? ""}`.toLowerCase();
  if (achievement.category === "discovery" || /entdeck|erkund|orte|geheim/.test(source)) {
    return "Ich entdecke Orte, an denen andere vorbeigehen – denn die leisesten Winkel Erzmarks erzählen oft die größten Geschichten.";
  }
  if (achievement.category === "social" || /freund|gemeinsam|bund|sozial/.test(source)) {
    return "Ich gehe meinen Weg nicht allein. Die stärksten Erinnerungen entstehen dort, wo aus Begegnungen echte Verbündete werden.";
  }
  if (achievement.category === "milestones" || /quest|kapitel|sieg|erfolg/.test(source)) {
    return "Ich trage diesen Augenblick wie eine Rune in meiner Chronik – als Beweis dafür, dass kein großer Weg mit einem einzigen Schritt endet.";
  }
  return "Ich habe Erzmark nicht nur gespielt, sondern erlebt. Dieser Erfolg bewahrt einen Moment meiner Reise, der nicht vergessen werden soll.";
}

// Der Profilbereich wird häufig geöffnet und geschlossen. Diese kleine
// Sitzungskopie hält bereits geladene lokale Daten im Speicher, damit beim
// nächsten Öffnen weder Bilder noch Charakterdaten erneut aufblitzen.
const profileViewCache = {
  skinUrl: null,
  profile: getCachedProfile(),
  activeCharacter: null,
  achievements: [],
  media: null,
  mediaLoaded: false,
  screenshots: [],
};

const loadSkin = () => getCurrentSkinUrl().then((value) => (profileViewCache.skinUrl = value));
const loadCustomization = () => getProfile().then((value) => (profileViewCache.profile = value));
const loadCharacters = () => getCharacterProfiles().then((items) => {
  profileViewCache.activeCharacter = items.find((item) => item.active) ?? null;
  return profileViewCache.activeCharacter;
});
const loadUnlockedAchievements = () => getAchievements().then((items) => {
  profileViewCache.achievements = items.filter((item) => item.unlocked);
  return profileViewCache.achievements;
});
const loadMedia = () => getProfileMedia().then((media) => {
  profileViewCache.media = media;
  profileViewCache.mediaLoaded = true;
  return media;
});
const loadScreenshots = () => listScreenshots(8).then((items) => (profileViewCache.screenshots = items));

export function preloadProfileScreenData() {
  return Promise.allSettled([
    loadSkin(),
    loadCustomization(),
    loadCharacters(),
    loadUnlockedAchievements(),
    loadMedia(),
    loadScreenshots(),
  ]);
}

function prettifyClassName(rawClass) {
  if (!rawClass) return "Noch kein aktiver Charakter";
  return rawClass.toLowerCase().split(/[_\s]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function formatPlayTime(totalSeconds) {
  if (!totalSeconds) return "0 Std.";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours} Std. ${minutes} Min.` : `${minutes} Min.`;
}

function ProfileEditor({ session }) {
  const [skinUrl, setSkinUrl] = useState(profileViewCache.skinUrl);
  const [profile, setProfile] = useState(() => profileViewCache.profile);
  const [profileRefreshing, setProfileRefreshing] = useState(true);
  const [activeCharacter, setActiveCharacter] = useState(profileViewCache.activeCharacter);
  const [achievements, setAchievements] = useState(() => profileViewCache.achievements);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(profileViewCache.media?.photoUrl ?? null);
  const [mediaReady, setMediaReady] = useState(profileViewCache.mediaLoaded);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [coverUrl, setCoverUrl] = useState(profileViewCache.media?.coverUrl ?? null);
  const [coverBusy, setCoverBusy] = useState(null);
  const [coverError, setCoverError] = useState(null);
  const [pinnedFilename, setPinnedFilename] = useState(null);
  const [screenshots, setScreenshots] = useState(() => profileViewCache.screenshots);
  const [editingBio, setEditingBio] = useState(false);
  const [editingCover, setEditingCover] = useState(false);
  const [editingShowcase, setEditingShowcase] = useState(false);

  useEffect(() => {
    loadSkin().then(setSkinUrl).catch(() => {});
    loadCustomization().then(setProfile).catch(() => {}).finally(() => setProfileRefreshing(false));
    loadCharacters().then(setActiveCharacter).catch(() => {});
    loadUnlockedAchievements().then(setAchievements).catch(() => setAchievements([]));
    loadMedia().then((media) => {
      setPhotoUrl(media.photoUrl);
      setCoverUrl(media.coverUrl);
    }).catch(() => {}).finally(() => setMediaReady(true));
    loadScreenshots().then(setScreenshots).catch(() => setScreenshots([]));
  }, []);

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const nextPhotoUrl = (await uploadProfilePhoto(file)) ?? null;
      profileViewCache.media = { ...(profileViewCache.media ?? {}), photoUrl: nextPhotoUrl };
      setPhotoUrl(nextPhotoUrl);
    } catch (error) {
      setPhotoError(error?.message ?? String(error));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handlePhotoRemove() {
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      await removeProfilePhoto();
      profileViewCache.media = { ...(profileViewCache.media ?? {}), photoUrl: null };
      setPhotoUrl(null);
    } catch (error) {
      setPhotoError(error?.message ?? String(error));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handlePinScreenshot(shot) {
    setCoverError(null);
    setCoverBusy(shot.filename);
    try {
      const response = await fetch(shot.thumbnail_data_url);
      const blob = await response.blob();
      const file = new File([blob], shot.filename.replace(/\.png$/i, ".jpg"), { type: "image/jpeg" });
      const nextCoverUrl = (await uploadProfileCover(file)) ?? null;
      profileViewCache.media = { ...(profileViewCache.media ?? {}), coverUrl: nextCoverUrl };
      setCoverUrl(nextCoverUrl);
      setPinnedFilename(shot.filename);
    } catch (error) {
      setCoverError(error?.message ?? String(error));
    } finally {
      setCoverBusy(null);
    }
  }

  async function handleRemoveCover() {
    setCoverError(null);
    setCoverBusy("__remove__");
    try {
      await removeProfileCover();
      profileViewCache.media = { ...(profileViewCache.media ?? {}), coverUrl: null };
      setCoverUrl(null);
      setPinnedFilename(null);
    } catch (error) {
      setCoverError(error?.message ?? String(error));
    } finally {
      setCoverBusy(null);
    }
  }

  function toggleFeatured(id) {
    setSaved(false);
    setProfile((previous) => {
      const availableIds = new Set(achievements.map((achievement) => achievement.id));
      const validIds = previous.featuredAchievementIds.filter((item) => availableIds.has(item));
      const selected = validIds.includes(id);
      if (selected) return { ...previous, featuredAchievementIds: validIds.filter((item) => item !== id) };
      if (validIds.length >= MAX_FEATURED) return { ...previous, featuredAchievementIds: validIds };
      return { ...previous, featuredAchievementIds: [...validIds, id] };
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const nextProfile = await saveProfile(profile);
      profileViewCache.profile = nextProfile;
      setProfile(nextProfile);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const banner = BANNER_PRESETS.find((item) => item.id === profile.bannerId) ?? BANNER_PRESETS[0];
  const latestScreenshot = screenshots[0] ?? null;
  // Solange die echten Profilmedien noch nicht geantwortet haben, bleibt der
  // stabile Farbverlauf sichtbar. So blitzt nicht kurz ein Screenshot als
  // vermeintliches Titelbild auf, bevor das gespeicherte Cover eintrifft.
  const autoBannerImage = mediaReady && !coverUrl && latestScreenshot ? latestScreenshot.thumbnail_data_url : null;
  const bannerImage = coverUrl ?? autoBannerImage;
  const bannerStyle = bannerImage ? { backgroundImage: `url(${bannerImage})` } : { background: banner.gradient };
  const featuredAchievements = profile.featuredAchievementIds
    .map((id) => achievements.find((achievement) => achievement.id === id))
    .filter(Boolean);

  return (
    <div className="erzmark-profile-modern" style={{ "--erzmark-profile-accent": banner.accent }}>
      <section className="erzmark-profile-hero erzmark-profile-channel">
        <div className="erzmark-profile-cover erzmark-profile-channel-cover" style={bannerStyle}>
          <div className="erzmark-profile-cover-shade" />
          <div className="erzmark-profile-cover-topline">
            <span className="erzmark-profile-cover-label">{coverUrl ? "Dein Titelbild" : autoBannerImage ? "Neuester Screenshot" : banner.label}</span>
            {(profileRefreshing || !mediaReady) && <span className="erzmark-profile-syncing"><i /> Profil wird synchronisiert</span>}
            {coverBusy && <span className="erzmark-profile-cover-busy">Titelbild wird aktualisiert…</span>}
            <button type="button" className="erzmark-profile-cover-edit" onClick={() => setEditingCover((value) => !value)}>
              {editingCover ? "Auswahl schließen" : "✦ Titelbild ändern"}
            </button>
          </div>
          <div className="erzmark-profile-color-row erzmark-profile-color-overlay">
            <div><strong>Profilfarbe</strong><span>Akzent und Rahmen</span></div>
            <div className="erzmark-profile-color-swatches">
              {BANNER_PRESETS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`erzmark-profile-color-swatch${profile.bannerId === item.id ? " is-selected" : ""}`}
                  style={{ background: item.gradient, "--swatch": item.accent }}
                  title={item.label}
                  aria-label={`Profilfarbe ${item.label}`}
                  onClick={() => {
                    setSaved(false);
                    setProfile({ ...profile, bannerId: item.id });
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="erzmark-profile-identity erzmark-profile-channel-identity">
          <div className="erzmark-profile-avatar-stage">
            <div className="erzmark-profile-avatar-ring" />
            {photoUrl ? (
              <img className="erzmark-profile-avatar-photo" src={photoUrl} alt="Eigenes Profilbild" />
            ) : skinUrl ? (
              <div className="erzmark-profile-avatar-skin">
                <Suspense fallback={<div className="erzmark-profile-avatar-fallback is-loading">◇</div>}>
                  <SkinMirror skinUrl={skinUrl} width={150} height={200} />
                </Suspense>
              </div>
            ) : (
              <div className="erzmark-profile-avatar-fallback is-loading">◇</div>
            )}
            <span className="erzmark-profile-online-dot" title="Online" />
          </div>
          <div className="erzmark-profile-identity-copy">
            <span className="erzmark-profile-overline">Erzmark-Abenteurer</span>
            <h3>{session?.username ?? "Spielerprofil"}</h3>
            <p>{prettifyClassName(activeCharacter?.class)}{activeCharacter ? ` · Level ${activeCharacter.level}` : ""} · Online</p>
            {profile.bio && !editingBio && <blockquote className="erzmark-profile-bio-quote">„{profile.bio}“</blockquote>}
          </div>
          <div className="erzmark-profile-identity-actions">
            <label className="erzmark-profile-image-button">
              {photoBusy ? "Bild wird geladen…" : "Profilbild ändern"}
              <input type="file" accept="image/png,image/jpeg" onChange={handlePhotoChange} disabled={photoBusy} hidden />
            </label>
            <button className="erzmark-profile-text-action" type="button" onClick={() => setEditingBio((value) => !value)}>{editingBio ? "Text schließen" : "Profiltext bearbeiten"}</button>
            {photoUrl && <button className="erzmark-profile-text-action" type="button" onClick={handlePhotoRemove} disabled={photoBusy}>Bild entfernen</button>}
          </div>
        </div>
        {photoError && <p className="erzmark-error erzmark-profile-photo-error">{photoError}</p>}
      </section>

      {(editingBio || editingCover) && <section className={`erzmark-profile-dashboard erzmark-profile-editor-drawer${editingBio && editingCover ? " has-two-panels" : ""}`}>
        {editingBio && <div className="erzmark-profile-card erzmark-profile-bio-card">
          <div className="erzmark-profile-section-title">
            <div><span>Deine Stimme</span><h3>Profiltext bearbeiten</h3></div>
            <span className="erzmark-profile-character-count">{profile.bio.length}/200</span>
          </div>
          <textarea
            rows={4}
            maxLength={200}
            value={profile.bio}
            onChange={(event) => {
              setSaved(false);
              setProfile({ ...profile, bio: event.target.value });
            }}
            placeholder="Ein paar Worte über dich und deine Reise durch Erzmark…"
          />
          <div className="erzmark-profile-save-row">
            <span className={saved ? "is-saved" : ""}>{saved ? "✓ Profil gespeichert" : "Änderungen werden erst beim Speichern übernommen"}</span>
            <button className="erzmark-btn-primary-small" type="button" onClick={handleSave} disabled={saving}>{saving ? "Speichert…" : "Profil speichern"}</button>
          </div>
        </div>}

        {editingCover && <div className="erzmark-profile-card erzmark-profile-screenshot-card">
          <div className="erzmark-profile-section-title">
            <div><span>Cover-Werkstatt</span><h3>Titelbild wählen</h3></div>
            {coverUrl && <button type="button" className="erzmark-profile-text-action" onClick={handleRemoveCover} disabled={coverBusy != null}>Entfernen</button>}
          </div>
          {screenshots.length === 0 ? (
            <div className="erzmark-profile-empty">Mit F2 im Spiel entsteht dein erstes Titelbild.</div>
          ) : (
            <div className="erzmark-profile-screenshot-strip">
              {screenshots.map((shot) => (
                <button type="button" key={shot.filename} className={`erzmark-profile-screenshot${pinnedFilename === shot.filename ? " is-selected" : ""}`} onClick={() => handlePinScreenshot(shot)} disabled={coverBusy != null} title="Als Titelbild verwenden">
                  <img src={shot.thumbnail_data_url} alt="Minecraft-Screenshot" />
                  <span>{coverBusy === shot.filename ? "…" : pinnedFilename === shot.filename ? "✓" : "+"}</span>
                </button>
              ))}
            </div>
          )}
          {coverError && <p className="erzmark-error">{coverError}</p>}
        </div>}
      </section>}

      <section className="erzmark-profile-achievements erzmark-profile-showcase">
        <div className="erzmark-profile-showcase-embers" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--ember": index }} />)}
        </div>
        <div className="erzmark-profile-section-title">
          <div><span>Deine Chronik</span><h3>Geschichten, die mich ausmachen</h3></div>
          <div className="erzmark-profile-showcase-tools">
            <span>{featuredAchievements.length}/{MAX_FEATURED} ausgestellt</span>
            <button type="button" className="erzmark-profile-showcase-edit" onClick={() => setEditingShowcase((value) => !value)}>{editingShowcase ? "Auswahl schließen" : "✦ Vitrine gestalten"}</button>
          </div>
        </div>
        {featuredAchievements.length === 0 ? (
          <div className="erzmark-profile-showcase-empty">
            <span>◇</span><strong>Deine Chronik wartet auf ihre erste Legende.</strong><small>Stelle bis zu drei geschmiedete Erfolge aus.</small>
          </div>
        ) : (
          <div className="erzmark-profile-story-grid">
            {featuredAchievements.map((achievement, index) => {
              const category = SHOWCASE_CATEGORIES[achievement.category] ?? SHOWCASE_CATEGORIES.gaming;
              return (
                <article key={achievement.id} className="erzmark-profile-story-card" style={{ "--story-color": category.color, "--story-delay": `${index * 90}ms` }}>
                  <div className="erzmark-profile-story-sparks" aria-hidden="true">{Array.from({ length: 12 }, (_, spark) => <i key={spark} style={{ "--spark": spark }} />)}</div>
                  <div className="erzmark-profile-story-seal"><span>{achievement.icon}</span></div>
                  <div className="erzmark-profile-story-copy">
                    <span className="erzmark-profile-story-chapter">Kapitel {index + 1} · {category.label}</span>
                    <h4>{achievement.title}</h4>
                    <blockquote>„{getAchievementStory(achievement)}“</blockquote>
                    <small>{achievement.percentUnlocked != null ? `Nur ${achievement.percentUnlocked}% der Reisenden tragen diese Geschichte.` : "Eine unauslöschliche Spur in deiner Chronik."}</small>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {editingShowcase && <div className="erzmark-profile-showcase-editor">
          <div className="erzmark-profile-medal-row">
            {achievements.map((achievement, index) => {
              const selected = profile.featuredAchievementIds.includes(achievement.id);
              return (
                <button type="button" key={achievement.id} className={`erzmark-profile-medal${selected ? " is-selected" : ""}`} onClick={() => toggleFeatured(achievement.id)} style={{ "--medal-delay": `${index * 55}ms` }} title={selected ? "Aus Vitrine entfernen" : "In Vitrine ausstellen"}>
                  <span className="erzmark-profile-medal-halo" /><span className="erzmark-profile-medal-icon">{achievement.icon}</span><strong>{achievement.title}</strong><small>{selected ? "Ausgestellt" : "Auswählen"}</small>
                </button>
              );
            })}
          </div>
          <div className="erzmark-profile-save-row"><span>Wähle bis zu drei Geschichten für deine öffentliche Chronik.</span><button className="erzmark-btn-primary-small" type="button" onClick={handleSave} disabled={saving}>{saving ? "Speichert…" : "Vitrine speichern"}</button></div>
        </div>}
      </section>

      {activeCharacter && (
        <section className="erzmark-profile-stat-strip">
          <div><span>Level</span><strong>{activeCharacter.level}</strong></div>
          <div><span>Klasse</span><strong>{prettifyClassName(activeCharacter.class)}</strong></div>
          <div><span>Spielzeit</span><strong>{formatPlayTime(activeCharacter.playTime)}</strong></div>
          <div><span>Quests</span><strong>{activeCharacter.questsCompleted ?? 0}</strong></div>
          <div><span>Münzen</span><strong>{activeCharacter.coins ?? 0}</strong></div>
        </section>
      )}
    </div>
  );
}

function Sparkline({ values }) {
  const width = 640;
  const height = 150;
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - (value / max) * (height - 18) - 9;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="erzmark-profile-history-chart">
      <defs><linearGradient id="profileChartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffb900" stopOpacity="0.34" /><stop offset="100%" stopColor="#ffb900" stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#profileChartFill)" />
      <polyline points={points} fill="none" stroke="var(--erzmark-color-gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatsHistory() {
  const [history, setHistory] = useState(null);
  const [level, setLevel] = useState(null);
  const [unlockedCount, setUnlockedCount] = useState(0);
  useEffect(() => {
    getStatsHistory().then(setHistory);
    getCharacterProfiles().then((items) => setLevel(items.find((item) => item.active)?.level ?? null)).catch(() => {});
    getAchievements().then((items) => setUnlockedCount(items.filter((item) => item.unlocked).length)).catch(() => {});
  }, []);
  const powerScore = useMemo(() => {
    if (!history?.length) return null;
    const totalHours = history[history.length - 1].cumulativePlayTimeSeconds / 3600;
    return Math.round((level ?? 1) * 10 + unlockedCount * 25 + totalHours * 2);
  }, [history, level, unlockedCount]);
  if (!history) return <div className="erzmark-profile-loading">Verlauf wird vorbereitet…</div>;
  return (
    <div className="erzmark-profile-history">
      <section className="erzmark-profile-history-score"><span>Erzmark Power-Score</span><strong>{powerScore}</strong><p>Näherung aus Level, Erfolgen und Gesamtspielzeit.</p></section>
      <section className="erzmark-profile-history-panel">
        <div className="erzmark-profile-section-title"><div><span>Letzte 14 Tage</span><h3>Tägliche Spielzeit</h3></div></div>
        <Sparkline values={history.map((item) => item.dailyPlayMinutes)} />
        <p className="erzmark-hint">Der Verlauf ist derzeit simuliert, bis eine echte historische Aufzeichnung verfügbar ist.</p>
      </section>
    </div>
  );
}

export default function ProfileScreenModern({ session, onClose }) {
  const [view, setView] = useState("profile");
  return (
    <LauncherPage title="Mein Profil" eyebrow="Deine Identität in Erzmark" onClose={onClose} className="erzmark-profile-page">
      <nav className="erzmark-page-tabs" aria-label="Profilbereiche">
        <button type="button" className={view === "profile" ? "is-active" : ""} onClick={() => setView("profile")}>Profil gestalten</button>
        <button type="button" className={view === "history" ? "is-active" : ""} onClick={() => setView("history")}>Verlauf</button>
      </nav>
      {view === "profile" ? <ProfileEditor session={session} /> : <StatsHistory />}
    </LauncherPage>
  );
}
