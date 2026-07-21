import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { getStats, getAchievements, subscribeNewUnlock, acknowledgeJustUnlocked } from "../api/achievements.js";
import { getPerformanceTier } from "../utils/performanceTier.js";
import { playUnlockSound, playCounterTick, playPageTurn } from "../utils/achievementSounds.js";

const TIER_LABELS = { bronze: "Bronze", silver: "Silber", gold: "Gold", legendary: "Legendär" };
const COOLING_THRESHOLD_DAYS = 3;
const COUNT_UP_DURATION_MS = 1200;

function formatPlayTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatUnlockDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

function daysSince(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

/** Zählt beim Erscheinen von 0 auf `target` hoch, mit gelegentlichem
 * Tick-Callback (für den Sound) statt bei jedem Frame. */
function useCountUp(target, active) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active || target == null) {
      return;
    }
    let raf;
    let lastTick = 0;
    const start = performance.now();
    function step(now) {
      const p = Math.min(1, (now - start) / COUNT_UP_DURATION_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (now - lastTick > 140 && p < 1) {
        lastTick = now;
        playCounterTick();
      }
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, target]);
  return value;
}

function ProgressRing({ value, max, color, icon, label }) {
  const size = 76;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const target = circumference * (1 - value / max);
    const id = requestAnimationFrame(() => setOffset(target));
    return () => cancelAnimationFrame(id);
  }, [value, max, circumference]);

  return (
    <div className="erzmark-ach-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
        <text x="50%" y="46%" textAnchor="middle" className="erzmark-ach-ring-icon">
          {icon}
        </text>
        <text x="50%" y="68%" textAnchor="middle" className="erzmark-ach-ring-value">
          {value}%
        </text>
      </svg>
      <span className="erzmark-ach-ring-label">{label}</span>
    </div>
  );
}

function StatsPage({ stats, active }) {
  const playTime = useCountUp(stats?.playTimeSeconds ?? null, active && stats != null);

  if (!stats) return <p className="erzmark-hint">Lädt…</p>;

  return (
    <div className="erzmark-ach-stats-page">
      <div className="erzmark-ach-playtime">
        <span className="erzmark-ach-playtime-value">{formatPlayTime(playTime)}</span>
        <span className="erzmark-ach-playtime-label">Gesamtspielzeit</span>
      </div>
      <div className="erzmark-ach-rings">
        {stats.categories.map((c) => (
          <ProgressRing key={c.key} value={c.current} max={c.max} color="var(--erzmark-color-gold)" icon={c.icon} label={c.label} />
        ))}
      </div>
    </div>
  );
}

function AchievementCard({ achievement, onView }) {
  const isSecret = !achievement.unlocked && achievement.description.startsWith("???");
  const cooling = achievement.unlocked && daysSince(achievement.unlockedAt) < COOLING_THRESHOLD_DAYS;
  const cardRef = useRef(null);
  const [forging, setForging] = useState(false);

  useEffect(() => {
    if (!achievement.justUnlocked) return;
    setForging(true);
    playUnlockSound(achievement.tier);
    onView(achievement.id);
    const timer = window.setTimeout(() => setForging(false), 1400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievement.justUnlocked]);

  const classes = [
    "erzmark-ach-card",
    `erzmark-ach-tier-${achievement.tier}`,
    achievement.unlocked ? "is-unlocked" : "is-locked",
    cooling ? "is-cooling" : "",
    forging ? "is-forging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} ref={cardRef}>
      {forging && (
        <div className="erzmark-ach-forge-sparks" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} style={{ "--i": i }} />
          ))}
        </div>
      )}
      <span className="erzmark-ach-card-icon">{achievement.unlocked ? achievement.icon : isSecret ? "🔒" : achievement.icon}</span>
      <div className="erzmark-ach-card-body">
        <span className="erzmark-ach-card-title">{isSecret ? "???" : achievement.title}</span>
        {!isSecret && <span className="erzmark-ach-card-desc">{achievement.description}</span>}
        <span className="erzmark-ach-card-tier">{TIER_LABELS[achievement.tier]}</span>
        {achievement.unlocked && (
          <>
            <span className="erzmark-ach-card-date">Freigeschaltet am {formatUnlockDate(achievement.unlockedAt)}</span>
            {achievement.contextSentence && <span className="erzmark-ach-card-context">{achievement.contextSentence}</span>}
          </>
        )}
        <span className="erzmark-ach-card-percent">🌍 {achievement.percentUnlocked}% der Spieler haben das auch erreicht</span>
      </div>
    </div>
  );
}

function AchievementsPage({ achievements, onView }) {
  if (!achievements) return <p className="erzmark-hint">Lädt…</p>;
  return (
    <div className="erzmark-ach-list">
      {achievements.map((a) => (
        <AchievementCard key={a.id} achievement={a} onView={onView} />
      ))}
    </div>
  );
}

/**
 * "Buch" mit zwei Seiten (Statistiken/Achievements) - siehe Launcher-Update-
 * TODO, Abschnitt 3. Datenquelle ist bewusst noch die Mock-API (siehe
 * api/achievements.js) - genau wie beim Freundessystem Teil 1 wurde die
 * UI/Interaktion zuerst fertig gebaut, ein echter Endpunkt kann später 1:1
 * eingesetzt werden.
 *
 * Bei Performance-Stufe "full": 3D-Flip (GSAP `rotateY` + Perspektive + ein
 * über den Umblätter-Fortschritt gesteuertes Schatten-Overlay) als
 * Annäherung an einen echten Page-Curl (eine physisch gebogene Seite bräuchte
 * eine eigene 3D-Geometrie/Shader – das war für eine Buch-Umblätter-Geste
 * nicht verhältnismäßig). Bei "reduced": einfacher Opacity-Crossfade.
 */
export default function AchievementsScreen({ onClose }) {
  const tierRef = useRef(getPerformanceTier());
  const tier = tierRef.current;
  const [stats, setStats] = useState(null);
  const [achievements, setAchievements] = useState(null);
  const [page, setPage] = useState(0);
  const [turning, setTurning] = useState(false);
  const bookRef = useRef(null);
  const shadowRef = useRef(null);

  useEffect(() => {
    Promise.all([getStats(), getAchievements()])
      .then(([s, a]) => {
        setStats(s);
        setAchievements(a);
      })
      .catch(() => {
        // Mock-API, sollte praktisch nie fehlschlagen - Seite bleibt dann leer.
      });

    return subscribeNewUnlock((updated) => {
      setAchievements((prev) => (prev ? prev.map((a) => (a.id === updated.id ? updated : a)) : prev));
    });
  }, []);

  function handleView(id) {
    acknowledgeJustUnlocked(id);
  }

  function turnPage() {
    if (turning) return;
    const nextPage = page === 0 ? 1 : 0;
    playPageTurn();

    if (tier !== "full" || !bookRef.current) {
      setTurning(true);
      setPage(nextPage);
      window.setTimeout(() => setTurning(false), 260);
      return;
    }

    setTurning(true);
    const tl = gsap.timeline({
      onComplete: () => setTurning(false),
    });
    tl.to(bookRef.current, {
      rotateY: -100,
      duration: 0.32,
      ease: "power2.in",
      onUpdate: function () {
        if (shadowRef.current) shadowRef.current.style.opacity = Math.min(1, this.progress() * 1.6);
      },
    })
      .call(() => setPage(nextPage))
      .set(bookRef.current, { rotateY: 80 })
      .to(bookRef.current, {
        rotateY: 0,
        duration: 0.32,
        ease: "power2.out",
        onUpdate: function () {
          if (shadowRef.current) shadowRef.current.style.opacity = Math.max(0, 1 - this.progress() * 1.6);
        },
      });
  }

  return (
    <div className="erzmark-modal-backdrop" onClick={onClose}>
      <div className="erzmark-modal-panel erzmark-book-panel" onClick={(e) => e.stopPropagation()}>
        <div className="erzmark-modal-header">
          <h2>{page === 0 ? "Statistiken" : "Errungenschaften"}</h2>
          <button className="erzmark-modal-close" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>

        <div className="erzmark-book-viewport" style={{ perspective: tier === "full" ? "1400px" : "none" }}>
          <div ref={bookRef} className="erzmark-book-page-content">
            {page === 0 ? (
              <StatsPage stats={stats} active={page === 0} />
            ) : (
              <AchievementsPage achievements={achievements} onView={handleView} />
            )}
          </div>
          <div ref={shadowRef} className="erzmark-book-curl-shadow" aria-hidden="true" />

          <button
            type="button"
            className="erzmark-book-turn-arrow"
            onClick={turnPage}
            title={page === 0 ? "Zu den Errungenschaften blättern" : "Zurück zu den Statistiken blättern"}
            aria-label="Seite umblättern"
          >
            <span className={page === 0 ? "" : "erzmark-book-turn-arrow-flipped"}>›</span>
          </button>
        </div>

        <div className="erzmark-book-page-dots">
          <span className={page === 0 ? "is-active" : ""} />
          <span className={page === 1 ? "is-active" : ""} />
        </div>
      </div>
    </div>
  );
}
