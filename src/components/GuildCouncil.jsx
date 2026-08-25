import { useEffect, useMemo, useState } from "react";
import { getFriends } from "../api/friends.js";

const KEY = "erzmark.guild-council-draft.v1";
const DEFAULT_DRAFT = { name: "Freie Gefährten", objective: "Erkundung des Grenzlands", emblem: "ᛉ", members: [] };
function loadDraft() { try { return { ...DEFAULT_DRAFT, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEFAULT_DRAFT; } }

/** Lokaler Expeditionsentwurf. Noch keine behauptete Server-Gilde: Der Rat
 * organisiert reale Freunde, bis ein schreibender Gilden-Endpunkt existiert. */
export default function GuildCouncil({ playerName, onOpenFriends }) {
  const [draft, setDraft] = useState(loadDraft);
  const [friends, setFriends] = useState([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { getFriends().then(setFriends).catch((err) => setError(err?.message ?? String(err))); }, []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(draft)); }, [draft]);
  const roster = useMemo(() => friends.filter((friend) => draft.members.includes(friend.uuid)), [friends, draft.members]);
  const candidates = friends.filter((friend) => !draft.members.includes(friend.uuid));
  function add(uuid) { setDraft((current) => current.members.length >= 5 ? current : { ...current, members: [...current.members, uuid] }); }
  function remove(uuid) { setDraft((current) => ({ ...current, members: current.members.filter((id) => id !== uuid) })); }
  return <div className="erzmark-council">
    <header className="erzmark-module-head"><span><small>Lokaler Expeditionsentwurf</small><strong>Gildenrat</strong></span><button className="erzmark-link-btn" onClick={() => setEditing((value) => !value)}>{editing ? "Fertig" : "Bearbeiten"}</button></header>
    <article className="erzmark-council-banner"><div>{draft.emblem}</div><span>{editing ? <><input value={draft.name} maxLength={28} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /><input value={draft.objective} maxLength={52} onChange={(event) => setDraft({ ...draft, objective: event.target.value })} /></> : <><small>Ratsbanner</small><h3>{draft.name}</h3><p>{draft.objective}</p></>}</span></article>
    <div className="erzmark-council-readiness"><span><b>{roster.filter((friend) => friend.online).length + 1}</b><small>bereit</small></span><i><em style={{ width: `${Math.min(100, ((roster.length + 1) / 6) * 100)}%` }} /></i><small>{roster.length + 1}/6 Sitze</small></div>
    <div className="erzmark-council-roster"><div className="erzmark-council-member is-leader"><i>{(playerName ?? "E").slice(0, 2).toUpperCase()}</i><span><b>{playerName ?? "Du"}</b><small>Ratsführung · online</small></span></div>{roster.map((friend, index) => <div key={friend.uuid} className="erzmark-council-member"><i>{friend.photoUrl ? <img src={friend.photoUrl} alt="" /> : friend.name.slice(0, 2).toUpperCase()}</i><span><b>{friend.name}</b><small>{index === 0 ? "Wegfinder" : "Gefährte"} · {friend.online ? "online" : "offline"}</small></span><button onClick={() => remove(friend.uuid)} aria-label={`${friend.name} entfernen`}>×</button></div>)}</div>
    {candidates.length > 0 && roster.length < 5 && <div className="erzmark-council-candidates"><small>Aus der Freundesliste berufen</small>{candidates.slice(0, 4).map((friend) => <button key={friend.uuid} onClick={() => add(friend.uuid)}><span>{friend.name}</span><i>{friend.online ? "bereit" : "offline"} +</i></button>)}</div>}
    {error && <p className="erzmark-error">{error}</p>}<button className="erzmark-memory-folder" onClick={onOpenFriends}><span>Gemeinschaft öffnen</span><i>→</i></button>
  </div>;
}
