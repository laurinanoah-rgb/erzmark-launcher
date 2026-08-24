import { useEffect, useMemo, useRef, useState } from "react";
import LauncherPage from "./LauncherPage.jsx";
import { getFriends, removeFriend } from "../api/friends.js";
import { useNotifications } from "../state/NotificationsContext.jsx";
import { useTalk } from "../state/TalkContext.jsx";

const AUTO_REFRESH_MS = 30 * 1000;
const IS_BROWSER_PREVIEW = import.meta.env.DEV && typeof window !== "undefined" && !window.__TAURI_INTERNALS__;
const DEV_FRIENDS = [
  { uuid: "preview-rudolf", name: "Rudolf", online: true, lastSeen: null, photoUrl: null, discordLinked: true },
  { uuid: "preview-livia", name: "Livia", online: true, lastSeen: null, photoUrl: null, discordLinked: true },
  { uuid: "preview-bergwart", name: "Bergwart", online: true, lastSeen: null, photoUrl: null, discordLinked: false },
  { uuid: "preview-freya", name: "Freya", online: false, lastSeen: Math.floor(Date.now() / 1000) - 7200, photoUrl: null, discordLinked: true },
  { uuid: "preview-konrad", name: "Konrad", online: false, lastSeen: Math.floor(Date.now() / 1000) - 86400, photoUrl: null, discordLinked: false },
];

function formatLastSeen(unixSeconds) {
  if (!unixSeconds) return "Zuletzt online unbekannt";
  const minutes = Math.max(0, Math.floor((Date.now() - unixSeconds * 1000) / 60000));
  if (minutes < 1) return "Gerade eben online";
  if (minutes < 60) return `Zuletzt vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Zuletzt vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `Zuletzt vor ${days} Tag${days === 1 ? "" : "en"}`;
}

function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.2" /><path d="m15.4 15.4 4.1 4.1" strokeLinecap="round" /></svg>;
}

function TalkIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V21M9 21h6" strokeLinecap="round" /></svg>;
}

function MoreIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>;
}

function AvatarImage({ friend }) {
  return friend.photoUrl ? <img src={friend.photoUrl} alt="" loading="lazy" /> : <span className="erzmark-lounge-avatar-initials">{initials(friend.name)}</span>;
}

function FriendAvatar({ friend, size = "normal", inTalk = false }) {
  return (
    <span className={`erzmark-lounge-avatar erzmark-lounge-avatar-${size}${inTalk ? " is-in-talk" : ""}`}>
      <AvatarImage friend={friend} />
      {inTalk && <span className="erzmark-lounge-voice-ring" aria-hidden="true" />}
      <span className={`erzmark-lounge-presence-dot${friend.online ? " is-online" : ""}`} />
    </span>
  );
}

function FriendRequestCard({ request, onRespond }) {
  const name = request.data?.requesterName ?? "Ein Spieler";
  return (
    <article className="erzmark-lounge-request-card">
      <span className="erzmark-lounge-request-avatar">{initials(name)}</span>
      <div className="erzmark-lounge-request-copy"><span>Neue Freundschaftsanfrage</span><strong>{name}</strong><p>möchte gemeinsam mit dir Erzmark erkunden.</p></div>
      <div className="erzmark-lounge-request-actions">
        <button type="button" className="erzmark-lounge-primary-button" onClick={() => onRespond(request.id, true)}>Annehmen</button>
        <button type="button" className="erzmark-lounge-quiet-button" onClick={() => onRespond(request.id, false)}>Ablehnen</button>
      </div>
    </article>
  );
}

function TalkSpotlightCard({ friend, onSelect }) {
  return (
    <button type="button" className="erzmark-lounge-talk-card" onClick={() => onSelect(friend.uuid)}>
      <div className="erzmark-lounge-talk-waves" aria-hidden="true"><i /><i /><i /><i /></div>
      <FriendAvatar friend={friend} size="large" inTalk />
      <div className="erzmark-lounge-talk-copy"><span>Gerade im Talk</span><strong>{friend.name}</strong><small>Discord-Voice verbunden</small></div>
      <span className="erzmark-lounge-talk-open">Profil ansehen →</span>
    </button>
  );
}

function OnlineFriendCard({ friend, inTalk, onSelect, onTalk, talkPending, delay }) {
  return (
    <article className={`erzmark-lounge-friend-card${inTalk ? " is-in-talk" : ""}`} style={{ "--friend-delay": delay }}>
      <button type="button" className="erzmark-lounge-card-profile" onClick={() => onSelect(friend.uuid)} aria-label={`${friend.name} Profil öffnen`}>
        <FriendAvatar friend={friend} size="large" inTalk={inTalk} />
        <span className="erzmark-lounge-card-state">{inTalk ? "Im Talk" : "Online"}</span>
        <strong>{friend.name}</strong>
        <small>{inTalk ? "Spricht gerade mit Freunden" : "Bereit für ein Abenteuer"}</small>
      </button>
      <div className="erzmark-lounge-card-actions">
        <button type="button" className="erzmark-lounge-talk-button" onClick={() => onTalk(friend)} disabled={!friend.discordLinked || talkPending || inTalk} title={!friend.discordLinked ? "Discord noch nicht verknüpft" : inTalk ? "Bereits in einem Talk" : "Privaten Talk starten"}>
          <TalkIcon /><span>{talkPending ? "Startet…" : inTalk ? "Im Talk" : "Talk"}</span>
        </button>
        <button type="button" className="erzmark-lounge-icon-button" onClick={() => onSelect(friend.uuid)} aria-label={`${friend.name} Details`}><MoreIcon /></button>
      </div>
    </article>
  );
}

function FriendDetail({ friend, inTalk, onClose, onRemove, removing, onTalk, talkRequest }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [friend?.uuid]);
  if (!friend) return null;
  const pending = talkRequest.status === "pending" && talkRequest.friendUuid === friend.uuid;
  const failed = talkRequest.status === "failed" && talkRequest.friendUuid === friend.uuid;

  return (
    <aside className="erzmark-lounge-detail">
      <div className="erzmark-lounge-detail-cover"><div className="erzmark-lounge-detail-cover-light" /><button type="button" className="erzmark-lounge-detail-close" onClick={onClose} aria-label="Freundesprofil schließen">×</button></div>
      <div className="erzmark-lounge-detail-identity">
        <FriendAvatar friend={friend} size="detail" inTalk={inTalk} />
        <span className="erzmark-lounge-detail-kicker">Freundesprofil</span>
        <h3>{friend.name}</h3>
        <p className={friend.online ? "is-online" : ""}>{inTalk ? "Im Talk" : friend.online ? "Online" : formatLastSeen(friend.lastSeen)}</p>
      </div>
      <div className="erzmark-lounge-detail-actions">
        <button type="button" className="erzmark-lounge-primary-button" onClick={() => onTalk(friend)} disabled={!friend.discordLinked || pending || inTalk}><TalkIcon /> {pending ? "Talk wird gestartet…" : inTalk ? "Bereits im Talk" : "Privaten Talk starten"}</button>
        {!friend.discordLinked && <span className="erzmark-lounge-detail-note">Dieser Freund hat Discord noch nicht mit Erzmark verknüpft.</span>}
        {failed && <span className="erzmark-error">{talkRequest.error ?? "Talk konnte nicht gestartet werden."}</span>}
      </div>
      <div className="erzmark-lounge-detail-info">
        <div><span>Status</span><strong>{friend.online ? "Online" : "Offline"}</strong></div>
        <div><span>Voice</span><strong>{inTalk ? "Aktiv" : "Nicht im Talk"}</strong></div>
        <div><span>Discord</span><strong>{friend.discordLinked ? "Verknüpft" : "Nicht verknüpft"}</strong></div>
      </div>
      <div className="erzmark-lounge-detail-danger">
        {confirming ? (
          <div className="erzmark-lounge-remove-confirm"><p><strong>{friend.name}</strong> wirklich aus deiner Freundesliste entfernen?</p><div><button type="button" onClick={() => onRemove(friend.uuid)} disabled={removing}>{removing ? "Wird entfernt…" : "Ja, entfernen"}</button><button type="button" onClick={() => setConfirming(false)} disabled={removing}>Abbrechen</button></div></div>
        ) : <button type="button" onClick={() => setConfirming(true)}>Freundschaft verwalten</button>}
      </div>
    </aside>
  );
}

export default function FriendsLounge({ onClose }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedUuid, setSelectedUuid] = useState(null);
  const [offlineExpanded, setOfflineExpanded] = useState(false);
  const [removingUuid, setRemovingUuid] = useState(null);
  const pendingRemovalsRef = useRef(new Set());
  const { friendRequests, respondFriendRequest } = useNotifications();
  const { voicePresences, talkRequest, startRealTalk, resetTalkRequest } = useTalk();

  async function refresh() {
    setError(null);
    try {
      const result = await getFriends();
      setFriends(result.filter((friend) => !pendingRemovalsRef.current.has(friend.uuid)));
    } catch (requestError) {
      if (IS_BROWSER_PREVIEW) {
        setFriends(DEV_FRIENDS.filter((friend) => !pendingRemovalsRef.current.has(friend.uuid)));
        setError(null);
      } else {
        setError(requestError?.message ?? String(requestError));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRemove(uuid) {
    setRemovingUuid(uuid);
    try {
      await removeFriend(uuid);
      pendingRemovalsRef.current.add(uuid);
      setFriends((current) => current.filter((friend) => friend.uuid !== uuid));
      setSelectedUuid(null);
    } catch (requestError) {
      setError(requestError?.message ?? String(requestError));
    } finally {
      setRemovingUuid(null);
    }
  }

  function openProfile(uuid) {
    resetTalkRequest();
    setSelectedUuid(uuid);
  }

  const voiceUuids = useMemo(() => {
    const uuids = new Set(voicePresences.map((presence) => presence.uuid));
    if (IS_BROWSER_PREVIEW) uuids.add("preview-rudolf");
    return uuids;
  }, [voicePresences]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleFriends = useMemo(() => friends.filter((friend) => !normalizedQuery || friend.name.toLowerCase().includes(normalizedQuery)), [friends, normalizedQuery]);
  const talkFriends = visibleFriends.filter((friend) => friend.online && voiceUuids.has(friend.uuid));
  const onlineFriends = visibleFriends.filter((friend) => friend.online);
  const offlineFriends = visibleFriends.filter((friend) => !friend.online);
  const selectedFriend = friends.find((friend) => friend.uuid === selectedUuid) ?? null;
  const onlineCount = friends.filter((friend) => friend.online).length;

  return (
    <LauncherPage title="Freundeslounge" eyebrow="Gemeinsam nach Erzmark" onClose={onClose} className="erzmark-friends-page">
      <div className={`erzmark-lounge-layout${selectedFriend ? " has-detail" : ""}`}>
        <main className="erzmark-lounge-main">
          <header className="erzmark-lounge-toolbar">
            <div className="erzmark-lounge-summary"><span><i className="is-online" />{onlineCount} online</span><span>{friends.length} Freunde</span>{talkFriends.length > 0 && <span><i className="is-talk" />{talkFriends.length} im Talk</span>}</div>
            <label className="erzmark-lounge-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Freund suchen…" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Suche leeren">×</button>}</label>
          </header>

          {friendRequests.length > 0 && <section className="erzmark-lounge-requests">{friendRequests.map((request) => <FriendRequestCard key={request.id} request={request} onRespond={respondFriendRequest} />)}</section>}
          {loading && <div className="erzmark-lounge-loading"><span />Freundesliste wird geöffnet…</div>}
          {error && <div className="erzmark-lounge-error"><p>{error}</p><button type="button" onClick={refresh}>Erneut versuchen</button></div>}
          {!loading && !error && friends.length === 0 && friendRequests.length === 0 && <div className="erzmark-lounge-empty"><span>◇</span><h3>Noch keine Weggefährten</h3><p>Freunde kannst du direkt im Spiel über MMOCore hinzufügen.</p></div>}
          {!loading && !error && friends.length > 0 && visibleFriends.length === 0 && <div className="erzmark-lounge-empty"><span>⌕</span><h3>Niemand gefunden</h3><p>Für „{query}“ gibt es keinen Treffer.</p></div>}

          {!loading && !error && talkFriends.length > 0 && (
            <section className="erzmark-lounge-section erzmark-lounge-talk-section"><div className="erzmark-lounge-section-heading"><div><span>Live</span><h3>Im Talk</h3></div><small>{talkFriends.length}</small></div><div className="erzmark-lounge-talk-grid">{talkFriends.map((friend) => <TalkSpotlightCard key={friend.uuid} friend={friend} onSelect={openProfile} />)}</div></section>
          )}

          {!loading && !error && onlineFriends.length > 0 && (
            <section className="erzmark-lounge-section"><div className="erzmark-lounge-section-heading"><div><span>Jetzt erreichbar</span><h3>Online</h3></div><small>{onlineFriends.length}</small></div><div className="erzmark-lounge-online-grid">{onlineFriends.map((friend, index) => <OnlineFriendCard key={friend.uuid} friend={friend} inTalk={voiceUuids.has(friend.uuid)} onSelect={openProfile} onTalk={startRealTalk} talkPending={talkRequest.status === "pending" && talkRequest.friendUuid === friend.uuid} delay={`${index * 50}ms`} />)}</div></section>
          )}

          {!loading && !error && visibleFriends.length > 0 && onlineFriends.length === 0 && !offlineExpanded && (
            <section className="erzmark-lounge-quiet-state">
              <span className="erzmark-lounge-quiet-orbit" aria-hidden="true"><i /></span>
              <div><small>Gerade ist es ruhig</small><h3>Niemand deiner Freunde ist online</h3><p>Deine Weggefährten bleiben unten erreichbar, auch wenn sie Erzmark gerade nicht bereisen.</p></div>
              <button type="button" onClick={() => setOfflineExpanded(true)}>Offline-Freunde anzeigen <b>↓</b></button>
            </section>
          )}

          {!loading && !error && offlineFriends.length > 0 && (
            <section className="erzmark-lounge-section erzmark-lounge-offline-section">
              <button type="button" className="erzmark-lounge-offline-toggle" onClick={() => setOfflineExpanded((value) => !value)} aria-expanded={offlineExpanded}><span><strong>Offline</strong><small>{offlineFriends.length} Freunde</small></span><i>{offlineExpanded ? "−" : "+"}</i></button>
              {offlineExpanded && <div className="erzmark-lounge-offline-list">{offlineFriends.map((friend) => <button type="button" key={friend.uuid} className="erzmark-lounge-offline-row" onClick={() => openProfile(friend.uuid)}><FriendAvatar friend={friend} size="small" /><strong>{friend.name}</strong><span>{formatLastSeen(friend.lastSeen)}</span><b>→</b></button>)}</div>}
            </section>
          )}
        </main>
        {selectedFriend && <FriendDetail friend={selectedFriend} inTalk={voiceUuids.has(selectedFriend.uuid)} onClose={() => setSelectedUuid(null)} onRemove={handleRemove} removing={removingUuid === selectedFriend.uuid} onTalk={startRealTalk} talkRequest={talkRequest} />}
      </div>
    </LauncherPage>
  );
}
