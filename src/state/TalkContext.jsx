import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getFriends } from "../api/friends.js";
import { getVoicePresence } from "../api/voice.js";
import { getTalkStatus, startTalk } from "../api/talk.js";
import { openExternalUrl } from "../api/events.js";

/**
 * "Anker-Widget"-State (22.08.2026 Design-Prototyp -> 23.08.2026 echte
 * Voice-Presence-Daten -> 23.08.2026 echter Talk-Start).
 *
 * WICHTIG - Grenze unbedingt einhalten: Der Launcher selbst nimmt weiterhin
 * NICHT aktiv an Voice-Chats teil (kein Audio/WebRTC, keine eigene
 * Verbindung, kein Mikrofon/Audio-Gerät wird angefasst) - das ist auch nach
 * dem echten Talk-Start unverändert nicht Teil dieses Plans, siehe
 * Plan-Dokument Abschnitt "Ausdrücklich NICHT Teil dieses Plans". Was jetzt
 * echt ist: Discord-Channel-Erstellung über den Bot R.U.D.O.L.F.
 *
 * Zwei zusammenspielende, aber unabhängige Bausteine:
 *  1. **Passive Anzeige** (unverändert seit 23.08.2026 vormittags): pollt
 *     `GET app-api/voice/presence` (siehe voice.rs) - ein read-only Abbild
 *     dessen, wer laut R.U.D.O.L.F. gerade in welchem Voice-Channel ist. Das
 *     Anker-Widget zeigt etwas an, sobald der eigene User laut diesen Daten
 *     selbst im Voice ist - alle anderen Freunde im selben `channelId`
 *     werden dann als Mitglieder angezeigt.
 *  2. **Aktiver Trigger** (neu, `startRealTalk`): ruft `POST
 *     app-api/talk/start` (siehe talk.rs) für einen bestimmten Freund auf,
 *     pollt danach `GET app-api/talk/status/{id}` bis der Bot den privaten
 *     Channel erstellt hat, öffnet dann den Discord-Invite-Link im
 *     System-Standardbrowser/-Discord-Client und blendet das Widget
 *     optimistisch schon mit den zwei bekannten Mitgliedern ein - der
 *     nächste reguläre Voice-Presence-Poll (Baustein 1) gleicht das dann mit
 *     den echten Daten ab (z. B. sobald der Freund dem Channel wirklich
 *     beigetreten ist). HINWEIS: Die Backend-Endpunkte hinter `talk.rs`
 *     (`app-api/talk/*`) existieren zum Zeitpunkt dieser Änderung noch
 *     nicht - sie werden parallel auf dem Server gebaut, siehe HANDOFF.md.
 *     Bis dahin schlägt `startRealTalk` mit einem Netzwerkfehler fehl, was
 *     hier sauber als `talkRequest.status === "failed"` abgebildet wird
 *     (kein Absturz).
 */

const TalkContext = createContext(null);

// Gleiches Muster wie NotificationsContext.jsx (20s) - Voice-Presence kann
// sich jederzeit ändern (Channel-Wechsel, Mute, Verlassen).
const POLL_INTERVAL_MS = 15 * 1000;

// Poll-Fallback für den Talk-Start-Status (kein Reverb/Echo-Client in dieser
// Session, siehe Plan-Dokument) - kurzes Intervall, aber klar begrenzte
// Versuchsanzahl, damit ein hängender Bot/Backend nicht endlos weiterpollt.
const POLL_TALK_STATUS_INTERVAL_MS = 1500;
const POLL_TALK_STATUS_MAX_ATTEMPTS = 8;

const IDLE_TALK_REQUEST = { status: "idle", error: null, friendUuid: null };

function defaultPosition() {
  if (typeof window === "undefined") return { x: 40, y: 40 };
  return {
    x: Math.max(16, window.innerWidth - 336 - 28),
    y: Math.max(16, window.innerHeight - 120 - 28),
  };
}

/**
 * Baut aus der rohen Presence-Liste + der bereits geladenen Freundesliste
 * (für Name/Avatar - der Voice-Endpoint liefert nur UUID+Status) das von der
 * UI erwartete `talk`-Objekt. Liefert `null`, wenn der eigene User laut
 * `presences` gerade NICHT im Voice ist.
 */
function buildTalk(presences, self, friendsByUuid) {
  const selfUuid = self?.uuid;
  if (!selfUuid) return null;

  const selfEntry = presences.find((p) => p.uuid === selfUuid);
  if (!selfEntry) return null;

  const channelMembers = presences.filter((p) => p.channelId === selfEntry.channelId);

  const members = channelMembers.map((p) => {
    const isSelf = p.uuid === selfUuid;
    const friend = friendsByUuid.get(p.uuid);
    return {
      uuid: p.uuid,
      name: isSelf ? self.name ?? "Du" : friend?.name ?? p.uuid,
      photoUrl: (isSelf ? self.photoUrl : friend?.photoUrl) ?? null,
      isSelf,
      micMuted: !!p.micMuted,
      deafened: !!p.deafened,
      volume: 100,
    };
  });

  return {
    id: selfEntry.channelId,
    name: selfEntry.channelName || "Voice-Channel",
    startedAt: selfEntry.joinedAt ? Date.parse(selfEntry.joinedAt) : Date.now(),
    members,
  };
}

export function TalkProvider({ self, children }) {
  const [voicePresences, setVoicePresences] = useState([]);
  const [talk, setTalk] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState(defaultPosition);
  const [selfMicMuted, setSelfMicMuted] = useState(false);
  const [selfDeafened, setSelfDeafened] = useState(false);
  // Keine echten Sprecher-Events verfügbar (nur Mute-/Deafen-Status kommt
  // vom Backend) - bleibt deshalb dauerhaft null, siehe Datei-Kommentar.
  const speakingUuid = null;
  const timerRef = useRef(null);
  // Solange sich diese Talk-Id hier drin befindet, blendet "Verlassen" das
  // Widget lokal aus, auch wenn die Presence-Daten weiterhin denselben Talk
  // melden (der Launcher kann niemanden real aus dem Voice werfen/verlassen
  // lassen - "Verlassen" ist deshalb nur ein lokales Ausblenden, bis sich
  // der Channel wirklich ändert).
  const [dismissedTalkId, setDismissedTalkId] = useState(null);
  // Status des zuletzt über startRealTalk() angestoßenen Talk-Requests -
  // getrennt vom passiven `talk`-State, damit FriendProfilePopup.jsx sofort
  // Rückmeldung geben kann ("wird gestartet…"/Fehler), bevor der reguläre
  // Voice-Presence-Poll überhaupt etwas davon mitbekommt.
  const [talkRequest, setTalkRequest] = useState(IDLE_TALK_REQUEST);

  const poll = useCallback(async () => {
    try {
      const [presences, friends] = await Promise.all([getVoicePresence(), getFriends()]);
      setVoicePresences(presences);

      const friendsByUuid = new Map(friends.map((f) => [f.uuid, f]));
      const nextTalk = buildTalk(presences, self, friendsByUuid);

      setTalk((current) => {
        if (!nextTalk) return null;
        // Neuer/aktueller Talk unterscheidet sich vom zuvor lokal
        // ausgeblendeten -> Ausblendung aufheben (z. B. Channel gewechselt).
        if (dismissedTalkId && nextTalk.id !== dismissedTalkId) {
          setDismissedTalkId(null);
        } else if (dismissedTalkId === nextTalk.id) {
          return null;
        }
        if (!current || current.id !== nextTalk.id) {
          setCollapsed(false);
          setPosition(defaultPosition());
        }
        return nextTalk;
      });

      const selfEntry = presences.find((p) => p.uuid === self?.uuid);
      // Eigener Mute-/Deafen-Status ist real (kommt von R.U.D.O.L.F.) -
      // wird deshalb bei jedem Poll aus den Presence-Daten übernommen, siehe
      // toggleSelfMic()/toggleSelfDeafen() unten für die (rein optische,
      // bis zum nächsten Poll geltende) lokale Umschaltung.
      if (selfEntry) {
        setSelfMicMuted(!!selfEntry.micMuted);
        setSelfDeafened(!!selfEntry.deafened);
      }
    } catch {
      // Kein kritischer Pfad - Widget bleibt einfach auf dem letzten Stand,
      // gleiches Verhalten wie NotificationsContext.jsx bei Netzwerkfehlern.
    }
  }, [self, dismissedTalkId]);

  useEffect(() => {
    poll();
    timerRef.current = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => window.clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self?.uuid]);

  /**
   * Startet einen echten Talk mit `friend` ({uuid,name,photoUrl,...} - z. B.
   * direkt das Objekt aus `getFriends()`). Ruft `POST app-api/talk/start`
   * auf, pollt danach `GET app-api/talk/status/{id}` bis der Bot fertig ist
   * (oder die Versuche ausgehen), und öffnet bei Erfolg den Discord-Invite
   * im System-Standardbrowser/-Discord-Client - exakt das Muster, das der
   * Discord-Social-Button in MainScreen.jsx für externe Links nutzt
   * (`openExternalUrl` -> Rust-`open`-Crate), kein zusätzliches
   * Shell-Plugin nötig.
   */
  const startRealTalk = useCallback(
    async (friend) => {
      if (!friend?.uuid || talkRequest.status === "pending") return;

      setTalkRequest({ status: "pending", error: null, friendUuid: friend.uuid });

      let requestId;
      try {
        const result = await startTalk(friend.uuid);
        requestId = result?.requestId;
        if (!requestId) throw new Error("Keine Anfrage-Id vom Server erhalten");
      } catch (err) {
        setTalkRequest({
          status: "failed",
          error: err?.message ?? "Talk konnte nicht gestartet werden",
          friendUuid: friend.uuid,
        });
        return;
      }

      for (let attempt = 0; attempt < POLL_TALK_STATUS_MAX_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, POLL_TALK_STATUS_INTERVAL_MS));

        let status;
        try {
          status = await getTalkStatus(requestId);
        } catch {
          // Netzwerk-Hakler beim Poll - nächster Versuch statt sofort
          // aufzugeben, gleiche Großzügigkeit wie beim regulären poll() oben.
          continue;
        }

        if (status?.status === "created") {
          setTalkRequest({ status: "created", error: null, friendUuid: friend.uuid });
          setDismissedTalkId(null);
          setCollapsed(false);
          setPosition(defaultPosition());
          setTalk((current) => {
            // Bereits über die passive Voice-Presence erkannt (z. B. weil der
            // reguläre Poll schneller war) -> nichts überschreiben.
            if (current && current.id === status.channelId) return current;
            return {
              id: status.channelId ?? requestId,
              name: `Talk mit ${friend.name ?? "Freund"}`,
              startedAt: Date.now(),
              members: [
                {
                  uuid: self?.uuid,
                  name: self?.name ?? "Du",
                  photoUrl: self?.photoUrl ?? null,
                  isSelf: true,
                  micMuted: false,
                  deafened: false,
                  volume: 100,
                },
                {
                  uuid: friend.uuid,
                  name: friend.name ?? friend.uuid,
                  photoUrl: friend.photoUrl ?? null,
                  isSelf: false,
                  micMuted: false,
                  deafened: false,
                  volume: 100,
                },
              ],
            };
          });
          // Sofort neu abgleichen statt bis zu POLL_INTERVAL_MS auf den
          // nächsten regulären Tick zu warten - danach spiegelt das Widget
          // die echten Mitglieder/den echten Channel-Namen.
          poll();
          if (status.inviteUrl) {
            openExternalUrl(status.inviteUrl).catch(() => {
              // Kein kritischer Pfad - der Nutzer sieht den Channel trotzdem
              // im Widget und kann selbst zu Discord wechseln.
            });
          }
          return;
        }

        if (status?.status === "failed") {
          setTalkRequest({
            status: "failed",
            error: status.errorReason || "Talk konnte nicht gestartet werden",
            friendUuid: friend.uuid,
          });
          return;
        }
        // status === "pending" -> weiter pollen
      }

      setTalkRequest({
        status: "failed",
        error: "Zeitüberschreitung - der Bot hat nicht rechtzeitig geantwortet",
        friendUuid: friend.uuid,
      });
    },
    [self, poll, talkRequest.status]
  );

  const resetTalkRequest = useCallback(() => setTalkRequest(IDLE_TALK_REQUEST), []);

  const setMemberVolume = useCallback((uuid, volume) => {
    setTalk((current) => {
      if (!current) return current;
      return {
        ...current,
        members: current.members.map((m) => (m.uuid === uuid ? { ...m, volume } : m)),
      };
    });
  }, []);

  // Rein optisch/optimistisch - es gibt keinen echten Mute-/Deafen-Kanal vom
  // Launcher aus (der wirkliche Status kommt von Discord/R.U.D.O.L.F.), der
  // nächste Poll (spätestens nach POLL_INTERVAL_MS) überschreibt das wieder
  // mit dem tatsächlichen Wert.
  const toggleSelfMic = useCallback(() => setSelfMicMuted((v) => !v), []);
  const toggleSelfDeafen = useCallback(() => setSelfDeafened((v) => !v), []);
  const toggleCollapse = useCallback(() => setCollapsed((v) => !v), []);

  const leaveTalk = useCallback(() => {
    setTalk((current) => {
      if (current) setDismissedTalkId(current.id);
      return null;
    });
    setCollapsed(false);
  }, []);

  const value = useMemo(
    () => ({
      talk,
      collapsed,
      position,
      selfMicMuted,
      selfDeafened,
      speakingUuid,
      voicePresences,
      talkRequest,
      setPosition,
      setMemberVolume,
      toggleSelfMic,
      toggleSelfDeafen,
      toggleCollapse,
      leaveTalk,
      startRealTalk,
      resetTalkRequest,
    }),
    [
      talk,
      collapsed,
      position,
      selfMicMuted,
      selfDeafened,
      speakingUuid,
      voicePresences,
      talkRequest,
      setMemberVolume,
      toggleSelfMic,
      toggleSelfDeafen,
      toggleCollapse,
      leaveTalk,
      startRealTalk,
      resetTalkRequest,
    ]
  );

  return <TalkContext.Provider value={value}>{children}</TalkContext.Provider>;
}

export function useTalk() {
  const ctx = useContext(TalkContext);
  if (!ctx) throw new Error("useTalk muss innerhalb von <TalkProvider> verwendet werden.");
  return ctx;
}
