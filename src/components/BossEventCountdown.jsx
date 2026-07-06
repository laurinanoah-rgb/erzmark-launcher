import { useEffect, useMemo, useState } from "react";
import { getBossEvent, openExternalUrl } from "../api/events.js";

const EVENTS_PAGE_URL = "https://erzmark.de/events";

function getRemaining(targetIso) {
  const target = new Date(targetIso).getTime();
  const diff = Math.max(0, target - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: diff <= 0,
  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function HourglassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="erzmark-boss-countdown-icon">
      <path d="M6 3h12M6 21h12M7 3c0 4.5 2.5 6.7 5 9-2.5 2.3-5 4.5-5 9M17 3c0 4.5-2.5 6.7-5 9 2.5 2.3 5 4.5 5 9" />
    </svg>
  );
}

/**
 * Kompakte Event-Plaque oben links im Launcher (statt zentraler Blickfang) –
 * zeigt den nächsten Event-Countdown. Der Termin kommt aus einer kleinen
 * JSON-Datei auf erzmark.de, die das Team selbst pflegt (siehe events.rs) –
 * ändert sich der Termin dort, zieht der Launcher ihn beim nächsten Öffnen
 * automatisch nach. Ohne gesetzten Termin (oder wenn er schon vorbei ist)
 * blendet sich das Widget einfach aus.
 */
export default function BossEventCountdown() {
  const [event, setEvent] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    getBossEvent()
      .then(setEvent)
      .catch(() => setEvent(null));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = useMemo(() => {
    if (!event?.nextBossEventAt && !event?.next_boss_event_at) return null;
    return getRemaining(event.nextBossEventAt ?? event.next_boss_event_at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, now]);

  if (!remaining || remaining.expired) return null;

  const eventName = event.eventName ?? event.event_name ?? "Boss-Event";
  const description = event.description;

  return (
    <div className="erzmark-event-corner">
      <button
        type="button"
        className="erzmark-boss-countdown"
        onClick={() => openExternalUrl(EVENTS_PAGE_URL).catch(() => {})}
        title="Zur Event-Übersicht auf erzmark.de"
      >
        <HourglassIcon />
        <div className="erzmark-boss-countdown-text">
          <span className="erzmark-boss-countdown-label">{eventName}</span>
          <div className="erzmark-boss-countdown-digits">
            {remaining.days > 0 && (
              <>
                <div className="erzmark-boss-countdown-unit">
                  <span className="erzmark-boss-countdown-number">{remaining.days}</span>
                  <span className="erzmark-boss-countdown-unit-label">T</span>
                </div>
                <span className="erzmark-boss-countdown-colon">·</span>
              </>
            )}
            <span className="erzmark-boss-countdown-number">{pad(remaining.hours)}</span>
            <span className="erzmark-boss-countdown-colon">:</span>
            <span className="erzmark-boss-countdown-number">{pad(remaining.minutes)}</span>
            <span className="erzmark-boss-countdown-colon">:</span>
            <span className="erzmark-boss-countdown-number erzmark-boss-countdown-seconds">
              {pad(remaining.seconds)}
            </span>
          </div>
          {description && <p className="erzmark-boss-countdown-description">{description}</p>}
        </div>
      </button>
    </div>
  );
}
