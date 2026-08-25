import { useEffect, useMemo, useState } from "react";
import { getAchievements } from "../api/achievements.js";

const PLACES = [
  { id: "gate", x: 49, y: 74, name: "Welttor", rune: "ᛟ", category: null, lore: "Hier beginnt jede Reise nach Erzmark." },
  { id: "citadel", x: 48, y: 35, name: "Zitadelle", rune: "ᛉ", category: "quest", lore: "Die Banner der vollendeten Aufträge wehen über dem Rat." },
  { id: "wilds", x: 22, y: 47, name: "Flüsterhain", rune: "ᚨ", category: "exploration", lore: "Pfade zeigen sich nur jenen, die abseits der Straßen suchen." },
  { id: "forge", x: 77, y: 53, name: "Sternenschmiede", rune: "ᛏ", category: "milestone", lore: "Erinnerungen werden hier zu Zeichen im Metall." },
  { id: "harbor", x: 69, y: 23, name: "Nebelhafen", rune: "ᚱ", category: "social", lore: "Gefährten treffen sich dort, wo die Laternen nie erlöschen." },
];
function matches(category = "", wanted) { const normalized = category.toLowerCase(); return wanted === "quest" ? normalized.includes("quest") : wanted === "exploration" ? /(explor|entdeck|reise)/.test(normalized) : wanted === "social" ? /(social|freund|gemein)/.test(normalized) : /(milestone|fortschritt|spiel)/.test(normalized); }

export default function RealmMap() {
  const [achievements, setAchievements] = useState([]); const [selectedId, setSelectedId] = useState("gate"); const [error, setError] = useState(null);
  useEffect(() => { getAchievements().then(setAchievements).catch((err) => setError(err?.message ?? String(err))); }, []);
  const places = useMemo(() => PLACES.map((place) => ({ ...place, unlocked: !place.category || achievements.some((achievement) => achievement.unlocked && matches(achievement.category, place.category)) })), [achievements]);
  const selected = places.find((place) => place.id === selectedId) ?? places[0]; const unlocked = places.filter((place) => place.unlocked).length;
  return <div className="erzmark-realm-map">
    <header className="erzmark-module-head"><span><small>Lebender Atlas</small><strong>Reichskarte</strong></span><b>{unlocked}/{places.length}</b></header>
    <div className="erzmark-map-canvas"><svg viewBox="0 0 100 100" aria-hidden="true"><defs><filter id="mapGlow"><feGaussianBlur stdDeviation="1.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><path className="land" d="M8 61 17 25 34 14 47 25 60 11 87 24 93 61 78 86 51 91 23 82Z"/><path className="ridge" d="m12 60 18-20 9 14 12-27 12 26 12-18 15 29"/><path className="river" d="M58 15c-9 18-3 29-13 41S28 71 26 84"/>{places.slice(1).map((place) => <line key={place.id} className={place.unlocked ? "route is-open" : "route"} x1="49" y1="74" x2={place.x} y2={place.y} />)}</svg>{places.map((place) => <button key={place.id} className={`erzmark-map-node${place.unlocked ? " is-open" : " is-locked"}${place.id === selected.id ? " is-selected" : ""}`} style={{ left: `${place.x}%`, top: `${place.y}%` }} onClick={() => setSelectedId(place.id)}><i>{place.unlocked ? place.rune : "?"}</i><span>{place.name}</span></button>)}</div>
    <article className="erzmark-map-lore"><span>{selected.unlocked ? selected.rune : "⌁"}</span><div><small>{selected.unlocked ? "Ort erinnert" : "Noch im Nebel"}</small><h3>{selected.name}</h3><p>{selected.unlocked ? selected.lore : "Ein passender Erfolg wird diesen Teil der Karte enthüllen."}</p></div></article>{error && <p className="erzmark-error">Karte derzeit ohne Erfolgsabgleich: {error}</p>}
  </div>;
}
