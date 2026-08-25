import { useEffect, useMemo, useRef, useState } from "react";
import { getCharacterProfiles } from "../api/profiles.js";

const AUTO_REFRESH_MS = 30_000;
function pretty(raw) { if (!raw) return "Abenteurer"; return raw.toLowerCase().split(/[_\s]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" "); }
function duration(seconds = 0) { const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); return hours ? `${hours} Std. ${minutes} Min.` : `${minutes} Min.`; }
function chronicleLine(profile) {
  const quests = profile.questsCompleted ?? 0;
  if (quests >= 50) return "Eine Chronik, deren Tinte von zahllosen vollendeten Aufträgen erzählt.";
  if (quests >= 15) return "Viele Siegel wurden gebrochen; im Grenzland kennt man diesen Namen.";
  if ((profile.playTime ?? 0) >= 36_000) return "Lange Wege und stille Wachen haben diese Geschichte geprägt.";
  if ((profile.level ?? 1) >= 10) return "Aus den ersten Spuren ist ein deutliches Vermächtnis geworden.";
  return "Die ersten Seiten sind beschrieben. Der wichtigste Abschnitt liegt noch vor dir.";
}

export default function CharacterProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  async function refresh() {
    setError(null);
    try { const result = await getCharacterProfiles(); setProfiles(result); setSelectedId((current) => current ?? result.find((p) => p.active)?.uuid ?? result[0]?.uuid ?? null); }
    catch (err) { setError(err?.message ?? String(err)); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); timerRef.current = window.setInterval(refresh, AUTO_REFRESH_MS); return () => window.clearInterval(timerRef.current); }, []);
  const selected = useMemo(() => profiles.find((p) => p.uuid === selectedId) ?? profiles[0], [profiles, selectedId]);
  const journeyScore = selected ? Math.min(100, Math.round(((selected.level ?? 1) * 3) + ((selected.questsCompleted ?? 0) * 1.5) + Math.min(25, (selected.playTime ?? 0) / 3600))) : 0;
  return <div className="erzmark-chronicles">
    <header className="erzmark-module-head"><span><small>Archiv der Wege</small><strong>Chroniken</strong></span><button className="erzmark-link-btn" onClick={refresh} disabled={loading} title="Chroniken aktualisieren">↻</button></header>
    {loading && <div className="erzmark-module-skeleton"><i /><i /><i /></div>}{error && <p className="erzmark-error">{error}</p>}
    {!loading && !error && !selected && <div className="erzmark-empty-state"><b>Dein Buch ist noch unbeschrieben</b><span>Betritt Erzmark, damit deine erste Chronik entsteht.</span></div>}
    {selected && <><article className="erzmark-chronicle-hero"><div className="erzmark-chronicle-seal" style={{ "--journey": `${journeyScore * 3.6}deg` }}><span>{selected.level ?? 1}</span><small>Stufe</small></div><div className="erzmark-chronicle-copy"><small>{selected.active ? "Aktive Chronik" : "Archivierte Chronik"}</small><h3>{selected.name ?? pretty(selected.class)}</h3><p>{chronicleLine(selected)}</p><span>{pretty(selected.class)}{selected.rankName ? ` · ${selected.rankName}` : ""}</span></div></article>
      <div className="erzmark-chronicle-metrics"><span><b>{selected.questsCompleted ?? 0}</b><small>Aufträge</small></span><span><b>{duration(selected.playTime)}</b><small>Reisezeit</small></span><span><b>{selected.coins ?? 0}</b><small>Münzen</small></span></div>
      <div className="erzmark-chronicle-progress"><span><b>Vermächtnis</b><small>{journeyScore}%</small></span><i><em style={{ width: `${journeyScore}%` }} /></i></div>
      {profiles.length > 1 && <div className="erzmark-chronicle-tabs">{profiles.map((profile) => <button key={profile.uuid} className={profile.uuid === selected.uuid ? "is-active" : ""} onClick={() => setSelectedId(profile.uuid)}><span>{profile.name ?? pretty(profile.class)}</span><small>Stufe {profile.level ?? 1}{profile.active ? " · aktiv" : ""}</small></button>)}</div>}</>}
  </div>;
}
