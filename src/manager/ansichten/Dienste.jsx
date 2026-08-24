import { useEffect, useState } from 'react';
import { ausfuehren } from '../klient.js';

/**
 * Ebene 2 - der Serverpark.
 *
 * Alle CloudNet-Dienste als anklickbare Felder mit Name, Zustand, Port und
 * Wartungsvermerk (Abschnitt 4).
 */
export function Dienste({ oeffne }) {
  const [dienste, setDienste] = useState(null);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    let aktiv = true;

    const laden = async () => {
      try {
        const daten = await ausfuehren('cloudnet.service.list');
        if (aktiv) {
          setDienste(daten.dienste);
          setFehler(null);
        }
      } catch (err) {
        if (aktiv) setFehler(err instanceof Error ? err.message : 'Dienste nicht erreichbar.');
      }
    };

    laden();
    const takt = setInterval(laden, 10000);
    return () => {
      aktiv = false;
      clearInterval(takt);
    };
  }, []);

  if (fehler) return <div className="mgr-hinweis-kasten mgr-fehler">{fehler}</div>;
  if (!dienste) return <div className="mgr-laedt">Lade Dienste …</div>;

  return (
    <div className="mgr-ebene">
      <div className="mgr-abschnitt-titel">
        {dienste.length} {dienste.length === 1 ? 'Dienst' : 'Dienste'}
      </div>

      {dienste.length === 0 ? (
        <div className="mgr-leer">CloudNet meldet keine laufenden Dienste.</div>
      ) : (
        <div className="mgr-dienst-gitter">
          {dienste.map((d) => (
            <button
              key={d.uniqueId || d.name}
              className="mgr-dienst-feld"
              onClick={() => oeffne(d.name)}
            >
              <div className="mgr-dienst-kopf">
                <span className={`mgr-zustand-punkt ${punktKlasse(d.zustand)}`} />
                <span className="mgr-dienst-name">{d.name}</span>
                {d.wartung && (
                  <span
                    className="mgr-siegel"
                    style={{ marginLeft: 'auto', color: 'var(--mgr-warnung)' }}
                  >
                    Wartung
                  </span>
                )}
              </div>
              <div className="mgr-dienst-zeile">
                <span>Zustand</span>
                <span>{zustandText(d.zustand)}</span>
              </div>
              <div className="mgr-dienst-zeile">
                <span>Port</span>
                <span>{d.port ?? '–'}</span>
              </div>
              <div className="mgr-dienst-zeile">
                <span>Vorlage</span>
                <span>{d.task}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function punktKlasse(zustand) {
  if (zustand === 'RUNNING') return 'mgr-laeuft';
  if (zustand === 'PREPARED' || zustand === 'STARTING') return 'mgr-startet';
  return 'mgr-aus';
}

export function zustandText(zustand) {
  switch (zustand) {
    case 'RUNNING':
      return 'läuft';
    case 'PREPARED':
      return 'vorbereitet';
    case 'STARTING':
      return 'startet';
    case 'STOPPED':
      return 'gestoppt';
    case 'DELETED':
      return 'entfernt';
    default:
      return String(zustand || '').toLowerCase() || 'unbekannt';
  }
}
