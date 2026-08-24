import { useEffect, useState } from 'react';
import { ausfuehren } from '../klient.js';
import { Runenkreis, Wert, bytes, laufzeit } from '../Runenkreis.jsx';

/**
 * Ebene 1 - die Startseite.
 *
 * Oben der Live-Zustand des Servers als Runenkreise, darunter die Kacheln zur
 * Auswahl des Bereichs (Abschnitt 4).
 *
 * Kacheln, fuer die die Berechtigung fehlt, werden nicht angezeigt. Das ist
 * Bequemlichkeit, keine Sicherheit - der Agent prueft jede Berechtigung ohnehin
 * selbst bei jedem Aufruf (Regel 3).
 */

const KACHELN = [
  { id: 'server', lore: 'Die Schächte', nuechtern: 'Erzmark Server', knoten: 'cloudnet.service.view',
    zusatz: 'Dienste, Konsole, Logs', bereit: true },
  { id: 'gedaechtnis', lore: 'Das Gedächtnis', nuechtern: 'Audit-Log', knoten: 'audit.view',
    zusatz: 'Wer hat was getan', bereit: true },
  { id: 'team', lore: 'Der Rat', nuechtern: 'Team & Rollen', knoten: 'roles.manage',
    zusatz: 'Zugänge und Berechtigungen', bereit: true },
  { id: 'freigaben', lore: 'Die Waage', nuechtern: 'Freigaben', knoten: 'changes.approve',
    zusatz: 'Änderungsvorschläge von Buildern', bereit: true },
  { id: 'spieler', lore: 'Die Bürger', nuechtern: 'Spieler', knoten: 'players.view',
    zusatz: 'Akten, Profile, Strafen', bereit: false },
  { id: 'backups', lore: 'Die Kammer', nuechtern: 'Backups', knoten: 'backups.view',
    zusatz: 'Sicherungen und Wiederherstellung', bereit: false },
  { id: 'app', lore: 'Der Bote', nuechtern: 'App', knoten: 'metrics.view',
    zusatz: 'Push, News, Wartungsbanner', bereit: false },
  { id: 'launcher', lore: 'Das Tor', nuechtern: 'Launcher', knoten: 'metrics.view',
    zusatz: 'Versionen und Auslieferung', bereit: false },
  { id: 'bot', lore: 'Die Stimme', nuechtern: 'Discord-Bot', knoten: 'system.root.service',
    zusatz: 'R.U.D.O.L.F. steuern', bereit: false },
];

export function Startseite({ oeffne }) {
  const [messung, setMessung] = useState(null);
  const [knoten, setKnoten] = useState(new Set());
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    let aktiv = true;

    const laden = async () => {
      try {
        const werte = await ausfuehren('metrics.current');
        if (aktiv) {
          setMessung(werte);
          setFehler(null);
        }
      } catch (err) {
        if (aktiv) setFehler(err instanceof Error ? err.message : 'Messwerte nicht erreichbar.');
      }
    };

    (async () => {
      try {
        const ich = await ausfuehren('meta.self');
        if (aktiv) setKnoten(new Set(ich.nodes));
      } catch {
        /* Kacheln bleiben dann verborgen - die Ansicht bleibt nutzbar. */
      }
    })();

    laden();
    // Die Startseite ist geoeffnet, also darf sie sich auffrischen. Beim
    // Verlassen wird der Takt beendet (6.1) - es gibt keine Dauerabfrage fuer
    // Ansichten, die niemand ansieht.
    const takt = setInterval(laden, 15000);
    return () => {
      aktiv = false;
      clearInterval(takt);
    };
  }, []);

  const host = (messung && messung.werte && messung.werte.host) || {};
  const sichtbar = KACHELN.filter((k) => knoten.has(k.knoten));

  return (
    <div className="mgr-ebene">
      <div className="mgr-abschnitt-titel">Zustand des Servers</div>

      {fehler && (
        <div className="mgr-hinweis-kasten mgr-fehler" style={{ marginBottom: '1.25rem' }}>
          {fehler}
        </div>
      )}

      <div className="mgr-runen-reihe">
        <Runenkreis name="CPU" wert={host['cpu.percent'] ?? null} />
        <Runenkreis
          name="Arbeitsspeicher"
          wert={host['mem.percent'] ?? null}
          zusatz={host['mem.bytes'] ? bytes(host['mem.bytes']) : undefined}
        />
        <Runenkreis
          name="Speicherplatz"
          wert={host['disk.percent'] ?? null}
          zusatz={host['disk.free_bytes'] ? bytes(host['disk.free_bytes']) + ' frei' : undefined}
        />
        <Runenkreis
          name="Dienste"
          wert={host['services.count'] ?? null}
          einheit=""
          maximum={Math.max(5, host['services.count'] ?? 5)}
          zusatz="laufend"
        />
        <Wert
          name="Laufzeit"
          text={host['uptime.seconds'] ? laufzeit(host['uptime.seconds']) : '–'}
          zusatz="ohne Neustart"
        />
      </div>

      <div className="mgr-abschnitt-titel">Bereiche</div>
      <div className="mgr-kachel-gitter">
        {sichtbar.map((k) => (
          <button
            key={k.id}
            className="mgr-kachel"
            onClick={() => oeffne(k.id)}
            disabled={!k.bereit}
            title={k.bereit ? undefined : 'Kommt in einer späteren Phase.'}
          >
            <span className="mgr-kachel-lore">{k.lore}</span>
            <span className="mgr-kachel-nuechtern">{k.nuechtern}</span>
            <span className="mgr-kachel-zusatz">{k.bereit ? k.zusatz : 'Noch nicht gebaut'}</span>
          </button>
        ))}
      </div>

      {sichtbar.length === 0 && (
        <div className="mgr-leer">Für dieses Konto ist noch kein Bereich freigegeben.</div>
      )}

      {messung && (
        <p
          style={{
            marginTop: '2rem',
            fontSize: '0.76rem',
            color: 'var(--mgr-text-schwach)',
            fontFamily: 'var(--mgr-schrift-fest)',
          }}
        >
          Gemessen {new Date(messung.gemessenAm).toLocaleTimeString('de-DE')} · Werte alle 60
          Sekunden aufgezeichnet
        </p>
      )}
    </div>
  );
}

export function bereichName(b) {
  const eintrag = KACHELN.find((k) => k.id === b);
  return eintrag ? eintrag.lore : b;
}
