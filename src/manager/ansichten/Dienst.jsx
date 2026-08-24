import { useCallback, useEffect, useRef, useState } from 'react';
import { ausfuehren, ApiFehler, BestaetigungNoetig, StepUpNoetig, stepUp } from '../klient.js';
import { punktKlasse, zustandText } from './Dienste.jsx';
import { Dateien } from './Dateien.jsx';
import { Plugins } from './Plugins.jsx';

/**
 * Ebene 3 - ein einzelner Dienst.
 *
 * Hier wird gearbeitet, also gilt Nuechternheit (9.1): feste Schriftbreite,
 * hoher Kontrast, keine Animation. Wer um drei Uhr nachts einen Absturz sucht,
 * will keine Effekte.
 */
export function Dienst({ name, zurueck }) {
  const [reiter, setReiter] = useState('konsole');
  const [dienst, setDienst] = useState(null);

  useEffect(() => {
    let aktiv = true;
    const laden = async () => {
      try {
        const daten = await ausfuehren('cloudnet.service.list');
        if (aktiv) setDienst(daten.dienste.find((d) => d.name === name) || null);
      } catch {
        /* Die Reiter bleiben bedienbar, auch wenn der Kopf fehlt. */
      }
    };
    laden();
    const takt = setInterval(laden, 15000);
    return () => {
      aktiv = false;
      clearInterval(takt);
    };
  }, [name]);

  return (
    <div className="mgr-ebene">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <span className={`mgr-zustand-punkt ${punktKlasse(dienst ? dienst.zustand : '')}`} />
        <h2 style={{ fontSize: '1.35rem' }}>{name}</h2>
        {dienst && (
          <span
            style={{
              fontFamily: 'var(--mgr-schrift-fest)',
              fontSize: '0.78rem',
              color: 'var(--mgr-text-leise)',
            }}
          >
            {zustandText(dienst.zustand)} · Port {dienst.port ?? '–'} · Vorlage {dienst.task}
          </span>
        )}
        <button className="mgr-knopf" style={{ marginLeft: 'auto' }} onClick={zurueck}>
          Zur Übersicht
        </button>
      </div>

      <div className="mgr-reiter-leiste" role="tablist">
        {[
          ['konsole', 'Konsole'],
          ['logs', 'Logs'],
          ['dateien', 'Dateien'],
          ['plugins', 'Plugins'],
          ['einstellungen', 'Einstellungen'],
        ].map(([id, beschriftung]) => (
          <button
            key={id}
            className="mgr-reiter"
            role="tab"
            aria-selected={reiter === id}
            onClick={() => setReiter(id)}
          >
            {beschriftung}
          </button>
        ))}
      </div>

      {reiter === 'konsole' && (
        <Konsole service={name} laeuft={dienst ? dienst.zustand === 'RUNNING' : false} />
      )}
      {reiter === 'logs' && <Logs service={name} />}
      {reiter === 'dateien' && <Dateien service={name} />}
      {reiter === 'plugins' && <Plugins service={name} />}
      {reiter === 'einstellungen' && (
        <Einstellungen service={name} task={dienst ? dienst.task : null} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Konsole
// ---------------------------------------------------------------------------

function einstufen(text) {
  if (/\b(ERROR|SEVERE|FATAL)\b/.test(text)) return 'fehler';
  if (/\bWARN(ING)?\b/.test(text)) return 'warnung';
  return 'normal';
}

function Konsole({ service, laeuft }) {
  const [zeilen, setZeilen] = useState([]);
  const [eingabe, setEingabe] = useState('');
  const [verlauf, setVerlauf] = useState([]);
  const [verlaufIndex, setVerlaufIndex] = useState(-1);
  const [filter, setFilter] = useState('alle');
  const [suche, setSuche] = useState('');
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState(null);
  const kasten = useRef(null);
  const amEnde = useRef(true);

  const laden = useCallback(async () => {
    try {
      const daten = await ausfuehren('cloudnet.service.logs', { service, limit: 500 });
      // Eigene Eingaben werden hier bewusst verworfen: Der Server protokolliert
      // jeden Befehl selbst ("CONSOLE issued server command"). Sie dauerhaft
      // anzuhaengen wuerde sie bei jedem Abruf ans Ende schieben - die eigene
      // Zeile stuende dann hinter der Antwort, die sie ausgeloest hat.
      setZeilen(daten.zeilen.map((t) => ({ text: t, art: einstufen(t) })));
      setFehler(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Logzeilen nicht erreichbar.');
    }
  }, [service]);

  useEffect(() => {
    laden();
    const takt = setInterval(laden, 4000);
    return () => clearInterval(takt);
  }, [laden]);

  // Nur mitscrollen, wenn man ohnehin unten steht. Wer nach oben gescrollt hat,
  // liest gerade etwas - dem darf die Ansicht nicht wegspringen.
  useEffect(() => {
    if (amEnde.current && kasten.current) {
      kasten.current.scrollTop = kasten.current.scrollHeight;
    }
  }, [zeilen]);

  async function senden(e) {
    if (e && e.preventDefault) e.preventDefault();
    const befehl = eingabe.trim();
    if (!befehl || sendet) return;

    setSendet(true);
    setZeilen((z) => [...z, { text: '> ' + befehl, art: 'eigen' }]);
    setVerlauf((v) => [...v.filter((x) => x !== befehl), befehl].slice(-50));
    setVerlaufIndex(-1);
    setEingabe('');

    try {
      const antwort = await ausfuehren('console.command', { service, command: befehl });
      setZeilen((z) => [
        ...z,
        ...antwort.antwort.map((t) => ({ text: t, art: einstufen(t) })),
        ...(antwort.hinweis ? [{ text: antwort.hinweis, art: 'normal' }] : []),
      ]);
    } catch (err) {
      setZeilen((z) => [
        ...z,
        {
          text: 'Fehlgeschlagen: ' + (err instanceof Error ? err.message : 'unbekannt'),
          art: 'fehler',
        },
      ]);
    } finally {
      setSendet(false);
    }
  }

  function taste(e) {
    // Enter schickt ab. Ohne diese Zeile haengt es davon ab, ob der Browser den
    // impliziten Absenden-Weg des Formulars nimmt - und wer in einer Konsole
    // tippt, drueckt Enter, nicht einen Knopf.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      senden(e);
      return;
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    if (verlauf.length === 0) return;

    const naechster =
      e.key === 'ArrowUp'
        ? Math.min(verlauf.length - 1, verlaufIndex + 1)
        : Math.max(-1, verlaufIndex - 1);

    setVerlaufIndex(naechster);
    setEingabe(naechster === -1 ? '' : verlauf[verlauf.length - 1 - naechster] || '');
  }

  const gezeigt = zeilen.filter((z) => {
    if (filter === 'fehler' && z.art !== 'fehler') return false;
    if (filter === 'warnung' && z.art !== 'warnung' && z.art !== 'fehler') return false;
    if (suche && !z.text.toLowerCase().includes(suche.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="mgr-konsole-leiste">
        <span>
          {gezeigt.length} von {zeilen.length} Zeilen
        </span>
        {['alle', 'warnung', 'fehler'].map((f) => (
          <button
            key={f}
            className="mgr-knopf"
            style={{
              padding: '0.15rem 0.5rem',
              fontSize: '0.72rem',
              borderColor: filter === f ? 'var(--mgr-kupfer)' : undefined,
            }}
            onClick={() => setFilter(f)}
          >
            {f === 'alle' ? 'Alle' : f === 'warnung' ? 'Ab Warnung' : 'Nur Fehler'}
          </button>
        ))}
        <input
          className="mgr-feld"
          style={{ width: '13rem', padding: '0.2rem 0.5rem', fontSize: '0.76rem', marginLeft: 'auto' }}
          placeholder="Im Rückblick suchen"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />
      </div>

      {fehler && (
        <div className="mgr-hinweis-kasten mgr-fehler" style={{ marginBottom: '0.7rem' }}>
          {fehler}
        </div>
      )}

      <div
        className="mgr-konsole"
        ref={kasten}
        onScroll={(e) => {
          const el = e.currentTarget;
          amEnde.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {gezeigt.length === 0 ? (
          <span style={{ color: 'var(--mgr-text-schwach)' }}>Keine Zeilen.</span>
        ) : (
          gezeigt.map((z, i) => (
            <span
              key={i}
              className={`mgr-konsole-zeile ${z.art === 'normal' ? '' : 'mgr-' + z.art}`}
            >
              {z.text}
            </span>
          ))
        )}
      </div>

      <form className="mgr-konsole-eingabe" onSubmit={senden}>
        <input
          className="mgr-feld"
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          onKeyDown={taste}
          placeholder={laeuft ? 'Befehl an den Minecraft-Server …' : 'Dienst läuft nicht'}
          disabled={!laeuft || sendet}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className="mgr-knopf mgr-knopf-haupt"
          type="submit"
          disabled={!laeuft || sendet || !eingabe.trim()}
        >
          {sendet ? '…' : 'Senden'}
        </button>
      </form>
      <p style={{ fontSize: '0.74rem', color: 'var(--mgr-text-schwach)', marginTop: '0.45rem' }}>
        Geht an den Minecraft-Prozess, nie an eine Shell. Jede Eingabe steht im Gedächtnis.
        Pfeiltasten holen frühere Befehle zurück.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

function Logs({ service }) {
  const [zeilen, setZeilen] = useState(null);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const daten = await ausfuehren('cloudnet.service.logs', { service, limit: 2000 });
        setZeilen(daten.zeilen);
      } catch (err) {
        setFehler(err instanceof Error ? err.message : 'Logzeilen nicht erreichbar.');
      }
    })();
  }, [service]);

  if (fehler) return <div className="mgr-hinweis-kasten mgr-fehler">{fehler}</div>;
  if (!zeilen) return <div className="mgr-laedt">Lade …</div>;

  return (
    <div>
      <div className="mgr-konsole-leiste">
        <span>{zeilen.length} Zeilen im Rückblick</span>
        <button
          className="mgr-knopf"
          style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem', marginLeft: 'auto' }}
          onClick={() => {
            const blob = new Blob([zeilen.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = service + '-log.txt';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Herunterladen
        </button>
      </div>
      <div className="mgr-konsole" style={{ height: '32rem' }}>
        {zeilen.map((t, i) => {
          const art = einstufen(t);
          return (
            <span key={i} className={`mgr-konsole-zeile ${art === 'normal' ? '' : 'mgr-' + art}`}>
              {t}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

function Einstellungen({ service, task }) {
  const [meldung, setMeldung] = useState(null);
  const [laeuft, setLaeuft] = useState(false);
  const [frage, setFrage] = useState(null);
  const [stepUpCode, setStepUpCode] = useState(null);
  const [nachStepUp, setNachStepUp] = useState(null);

  async function fuehreAus(tun) {
    setLaeuft(true);
    setMeldung(null);
    try {
      await tun();
    } catch (err) {
      if (err instanceof StepUpNoetig) {
        // Gefaehrliche Aktion: frische Bestaetigung mit dem zweiten Faktor (3.6).
        setNachStepUp(() => tun);
        setStepUpCode('');
      } else if (err instanceof BestaetigungNoetig) {
        setMeldung({ art: 'fehler', text: err.message });
      } else {
        setMeldung({
          art: 'fehler',
          text:
            err instanceof ApiFehler && err.code === 'keine_berechtigung'
              ? 'Dafür fehlt diesem Konto die Berechtigung.'
              : err instanceof Error
                ? err.message
                : 'Fehlgeschlagen.',
        });
      }
    } finally {
      setLaeuft(false);
    }
  }

  const neustart = () =>
    fuehreAus(async () => {
      await ausfuehren('cloudnet.service.restart', { service });
      setMeldung({ art: 'gut', text: service + ' wird neu gestartet.' });
    });

  const stoppen = () =>
    setFrage({
      text:
        service +
        ' wirklich stoppen? Die Mindestanzahl der Vorlage wird dabei auf 0 gesetzt, damit ' +
        'CloudNet nicht sofort einen neuen Dienst nachstartet.',
      tun: async () => {
        await fuehreAus(async () => {
          await ausfuehren(
            'cloudnet.service.stop',
            { service, dauerhaft: true },
            { bestaetigt: true },
          );
          setMeldung({ art: 'gut', text: service + ' wird gestoppt.' });
        });
        setFrage(null);
      },
    });

  return (
    <div>
      {meldung && (
        <div
          className={`mgr-hinweis-kasten ${meldung.art === 'fehler' ? 'mgr-fehler' : ''}`}
          style={{ marginBottom: '1.25rem' }}
        >
          {meldung.text}
        </div>
      )}

      <div className="mgr-abschnitt-titel">Lebenszyklus</div>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <button className="mgr-knopf" onClick={neustart} disabled={laeuft}>
          Neu starten
        </button>
        <button className="mgr-knopf mgr-knopf-gefahr" onClick={stoppen} disabled={laeuft}>
          Stoppen
        </button>
      </div>

      <div className="mgr-abschnitt-titel">Vorlage</div>
      <p style={{ color: 'var(--mgr-text-leise)', fontSize: '0.9rem' }}>
        Dieser Dienst gehört zur Vorlage{' '}
        <strong style={{ color: 'var(--mgr-text)' }}>{task || '–'}</strong>. Wartungsmodus,
        Mindestanzahl und das Anlegen weiterer Dienste folgen in einer späteren Ausbaustufe der
        Oberfläche.
      </p>

      {frage && (
        <div className="mgr-modal-grund" onClick={() => setFrage(null)}>
          <div className="mgr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.7rem' }}>Bist du sicher?</h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--mgr-text-leise)' }}>{frage.text}</p>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem' }}>
              <button className="mgr-knopf" onClick={() => setFrage(null)}>
                Abbrechen
              </button>
              <button className="mgr-knopf mgr-knopf-gefahr" onClick={() => frage.tun()} disabled={laeuft}>
                Ja, stoppen
              </button>
            </div>
          </div>
        </div>
      )}

      {stepUpCode !== null && (
        <div className="mgr-modal-grund">
          <div className="mgr-modal">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Kurz bestätigen</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--mgr-text-leise)', marginBottom: '1rem' }}>
              Diese Aktion verlangt eine frische Bestätigung mit dem zweiten Faktor.
            </p>
            <input
              className="mgr-feld"
              value={stepUpCode}
              onChange={(e) => setStepUpCode(e.target.value)}
              placeholder="000000"
              inputMode="numeric"
              autoFocus
              style={{
                fontFamily: 'var(--mgr-schrift-fest)',
                textAlign: 'center',
                letterSpacing: '0.25em',
              }}
            />
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
              <button
                className="mgr-knopf"
                onClick={() => {
                  setStepUpCode(null);
                  setNachStepUp(null);
                }}
              >
                Abbrechen
              </button>
              <button
                className="mgr-knopf mgr-knopf-haupt"
                onClick={async () => {
                  try {
                    await stepUp(stepUpCode);
                    const weiter = nachStepUp;
                    setStepUpCode(null);
                    setNachStepUp(null);
                    if (weiter) await fuehreAus(weiter);
                  } catch (err) {
                    setMeldung({
                      art: 'fehler',
                      text: err instanceof Error ? err.message : 'Bestätigung fehlgeschlagen.',
                    });
                  }
                }}
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
