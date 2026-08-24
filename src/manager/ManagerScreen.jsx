import { useEffect, useState } from 'react';
import './manager.css';
import { abmelden, aktuelleSitzung, ausfuehren } from './klient.js';
import { Anmeldung } from './ansichten/Anmeldung.jsx';
import { Startseite, bereichName } from './ansichten/Startseite.jsx';
import { Dienste } from './ansichten/Dienste.jsx';
import { Dienst } from './ansichten/Dienst.jsx';
import { Gedaechtnis } from './ansichten/Gedaechtnis.jsx';
import { Team } from './ansichten/Team.jsx';
import { Freigaben } from './ansichten/Freigaben.jsx';

/**
 * Der Team-Bereich im Launcher - R.U.D.O.L.F.s Kern.
 *
 * Drei Ebenen, Aufklappen statt Vollstopfen (Abschnitt 4). Bewusst ohne
 * Router-Bibliothek: Es gibt genau drei Tiefen, und ein Zustand mit drei Feldern
 * ist ehrlicher als eine Abhaengigkeit, die URLs verwaltet, die in einem
 * Launcher-Fenster niemand sieht.
 *
 * Die Anmeldung hier ist eigenstaendig und hat nichts mit dem Microsoft-Login
 * des Launchers zu tun: Der Manager prueft gegen die Erzmark-Identitaet auf
 * erzmark.de. Solange beide nicht verknuepft sind, ist das der ehrliche Weg -
 * ein Minecraft-Login sagt nichts ueber eine Team-Rolle aus.
 */
export default function ManagerScreen({ onClose }) {
  const [sitzung, setSitzung] = useState(aktuelleSitzung);
  const [ort, setOrt] = useState({ ebene: 'start' });
  const [istInhaber, setIstInhaber] = useState(false);

  useEffect(() => {
    if (!sitzung) return;
    (async () => {
      try {
        const ich = await ausfuehren('meta.self');
        setIstInhaber(Boolean(ich.isOwner));
      } catch {
        /* Das Siegel ist Schmuck - ohne es bleibt alles bedienbar. */
      }
    })();
  }, [sitzung]);

  // Escape schliesst den Bereich, wie in den anderen Vollbild-Ansichten des
  // Launchers auch.
  useEffect(() => {
    const taste = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onClose]);

  if (!sitzung) {
    return (
      <div className="mgr-wurzel mgr-vollbild">
        <Anmeldung
          fertig={(s) => {
            setSitzung(s);
            setOrt({ ebene: 'start' });
          }}
          abbrechen={onClose}
        />
      </div>
    );
  }

  return (
    <div className="mgr-wurzel mgr-vollbild">
      <div className="mgr-geruest">
        <header className="mgr-kopfleiste">
          <div className="mgr-kopf-marke">
            R.U.D.O.L.F.<span>s Kern</span>
          </div>

          <nav className="mgr-brotkrumen" aria-label="Pfad">
            <button onClick={() => setOrt({ ebene: 'start' })}>Übersicht</button>
            {ort.ebene !== 'start' && (
              <>
                <span>·</span>
                <button
                  onClick={() =>
                    setOrt(
                      ort.ebene === 'dienst'
                        ? { ebene: 'bereich', bereich: 'server' }
                        : { ebene: 'start' },
                    )
                  }
                >
                  {ort.ebene === 'bereich' ? bereichName(ort.bereich) : 'Die Schächte'}
                </button>
              </>
            )}
            {ort.ebene === 'dienst' && (
              <>
                <span>·</span>
                <span style={{ color: 'var(--mgr-bernstein)' }}>{ort.name}</span>
              </>
            )}
          </nav>

          <div className="mgr-kopf-rechts">
            {istInhaber && <span className="mgr-siegel">Inhaber</span>}
            <span style={{ fontSize: '0.85rem', color: 'var(--mgr-text-leise)' }}>
              {sitzung.displayName}
            </span>
            <button
              className="mgr-knopf"
              style={{ padding: '0.3rem 0.7rem', fontSize: '0.82rem' }}
              onClick={async () => {
                await abmelden();
                setSitzung(null);
              }}
            >
              Abmelden
            </button>
            {onClose && (
              <button
                className="mgr-knopf"
                style={{ padding: '0.3rem 0.7rem', fontSize: '0.82rem' }}
                onClick={onClose}
              >
                Schließen
              </button>
            )}
          </div>
        </header>

        <main className="mgr-inhalt">
          {ort.ebene === 'start' && (
            <Startseite oeffne={(bereich) => setOrt({ ebene: 'bereich', bereich })} />
          )}

          {ort.ebene === 'bereich' && ort.bereich === 'server' && (
            <Dienste oeffne={(name) => setOrt({ ebene: 'dienst', name })} />
          )}
          {ort.ebene === 'bereich' && ort.bereich === 'gedaechtnis' && <Gedaechtnis />}
          {ort.ebene === 'bereich' && ort.bereich === 'team' && <Team />}
          {ort.ebene === 'bereich' && ort.bereich === 'freigaben' && <Freigaben />}

          {ort.ebene === 'dienst' && (
            <Dienst
              name={ort.name}
              zurueck={() => setOrt({ ebene: 'bereich', bereich: 'server' })}
            />
          )}
        </main>
      </div>
    </div>
  );
}
