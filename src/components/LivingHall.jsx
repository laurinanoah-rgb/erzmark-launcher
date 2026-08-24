import { useEffect, useMemo, useState } from "react";
import { getAchievements } from "../api/achievements.js";

const CATEGORY_TROPHIES = {
  discovery: { rune: "ᛉ", label: "Entdeckung", color: "#45d7d5" },
  social: { rune: "ᚷ", label: "Gemeinschaft", color: "#76d79a" },
  milestones: { rune: "ᛏ", label: "Meilenstein", color: "#f0b83d" },
  gaming: { rune: "ᛟ", label: "Abenteuer", color: "#a889f2" },
};

function getDaypart(hour) {
  if (hour >= 5 && hour < 10) return { id: "dawn", label: "Morgendämmerung", rune: "ᛞ" };
  if (hour >= 10 && hour < 18) return { id: "day", label: "Tagwacht", rune: "ᛋ" };
  if (hour >= 18 && hour < 22) return { id: "dusk", label: "Abendwacht", rune: "ᚹ" };
  return { id: "night", label: "Nachtwacht", rune: "ᛇ" };
}
export default function LivingHall({ enabled = true, tier = "full", gameRunning, launching, returnMoment }) {
  const [daypart, setDaypart] = useState(() => getDaypart(new Date().getHours()));
  const [trophies, setTrophies] = useState([]);

  useEffect(() => {
    const timer = window.setInterval(() => setDaypart(getDaypart(new Date().getHours())), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAchievements()
      .then((items) => {
        if (cancelled) return;
        const unlocked = items
          .filter((item) => item.unlocked)
          .sort((a, b) => new Date(b.unlockedAt ?? 0) - new Date(a.unlockedAt ?? 0));
        const categorySeen = new Set();
        const curated = [];
        for (const achievement of unlocked) {
          if (!categorySeen.has(achievement.category)) {
            curated.push(achievement);
            categorySeen.add(achievement.category);
          }
          if (curated.length === 3) break;
        }
        setTrophies(curated);
      })
      .catch(() => setTrophies([]));
    return () => { cancelled = true; };
  }, []);

  const dust = useMemo(() => Array.from({ length: tier === "full" ? 24 : 8 }, (_, index) => ({
    x: `${(index * 43 + 7) % 100}%`,
    y: `${(index * 29 + 13) % 82}%`,
    delay: `${(index % 11) * -0.7}s`,
    duration: `${7 + (index % 6) * 1.3}s`,
    size: `${1 + (index % 3)}px`,
  })), [tier]);

  const sparks = useMemo(() => Array.from({ length: tier === "full" ? 12 : 4 }, (_, index) => ({
    side: index % 2 === 0 ? "left" : "right",
    offset: `${8 + (index % 5) * 7}px`,
    delay: `${index * -0.43}s`,
  })), [tier]);

  return (
    <div className={`erzmark-living-hall is-${daypart.id}${enabled ? " is-enabled" : " is-still"}`} data-daypart={daypart.id} aria-hidden="true">
      <div className="erzmark-hall-light is-left" />
      <div className="erzmark-hall-light is-right" />
      <div className="erzmark-hall-fog"><i /><i /><i /></div>
      <div className="erzmark-hall-dust">
        {dust.map((particle, index) => <i key={index} style={{ left: particle.x, top: particle.y, width: particle.size, height: particle.size, animationDelay: particle.delay, animationDuration: particle.duration }} />)}
      </div>
      <div className="erzmark-hall-sparks">
        {sparks.map((spark, index) => <i key={index} className={`is-${spark.side}`} style={{ "--spark-offset": spark.offset, animationDelay: spark.delay }} />)}
      </div>

      <div className="erzmark-hall-trophy-wall is-left">
        {trophies.slice(0, 2).map((achievement, index) => {
          const meta = CATEGORY_TROPHIES[achievement.category] ?? CATEGORY_TROPHIES.gaming;
          return <span key={achievement.id} className="erzmark-hall-trophy" style={{ "--trophy-color": meta.color, "--trophy-index": index }} title={achievement.title}><i>{achievement.icon || meta.rune}</i><small>{achievement.title}</small></span>;
        })}
      </div>
      <div className="erzmark-hall-trophy-wall is-right">
        {trophies.slice(2, 3).map((achievement, index) => {
          const meta = CATEGORY_TROPHIES[achievement.category] ?? CATEGORY_TROPHIES.gaming;
          return <span key={achievement.id} className="erzmark-hall-trophy" style={{ "--trophy-color": meta.color, "--trophy-index": index + 2 }} title={achievement.title}><i>{achievement.icon || meta.rune}</i><small>{achievement.title}</small></span>;
        })}
      </div>

      <div className="erzmark-hall-watch"><i>{daypart.rune}</i><span>{daypart.label}</span></div>
      <div className={`erzmark-hall-portal-wash${gameRunning ? " is-open" : launching ? " is-opening" : ""}`} />
      {returnMoment && <div className="erzmark-hall-return"><i>ᚱ</i><span><strong>Willkommen zurück</strong><small>Deine Spuren in Erzmark bleiben bestehen.</small></span></div>}
    </div>
  );
}
