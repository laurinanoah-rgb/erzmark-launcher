import { useCallback, useEffect, useState } from 'react';
import {
  AenderungVorgeschlagen,
  ApiFehler,
  ausfuehren,
  BestaetigungNoetig,
  StepUpNoetig,
  stepUp,
} from '../klient.js';

/**
 * Ebene 3, Reiter "Dateien" (5.1 / 5.2).
 *
 * Bereichsbeschraenkter Zugriff - die Oberflaeche kennt nur, was files.list
 * ihr zeigt. Sie kann den Bereich niemals selbst verlassen, weil die Pruefung
 * dazu ausschliesslich auf dem Agent liegt (Regel 2, Regel 3).
 *
 * Builder-Schreibvorgaenge werden serverseitig zu einem Vorschlag statt sofort
 * zu wirken (3.8) - die Oberflaeche merkt das ausschliesslich daran, dass
 * ausfuehren() eine AenderungVorgeschlagen wirft, nicht an einer eigenen Rolle.
 */

const BEREICHE = [
  { id: 'configs', label: 'Konfigurationen' },
  { id: 'plugins', label: 'Plugin-Ordner' },
  { id: 'worlds', label: 'Welt' },
  { id: 'templates', label: 'Vorlagen' },
];

function formatGroesse(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function istEditierbar(name) {
  return /\.(ya?ml|json|toml|properties|conf|txt|cfg|lang)$/i.test(name);
}

export function Dateien({ service }) {
  const [scope, setScope] = useState('configs');
  const [pfad, setPfad] = useState('');
  const [eintraege, setEintraege] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const [offen, setOffen] = useState(null);
  const [loeschFrage, setLoeschFrage] = useState(null);

  const laden = useCallback(async () => {
    setFehler(null);
    try {
      const daten = await ausfuehren('files.list', { scope, service, path: pfad });
      setEintraege(daten.items);
    } catch (err) {
      setEintraege([]);
      setFehler(
        err instanceof ApiFehler && err.code === 'keine_berechtigung'
          ? 'Für diesen Bereich fehlt die Berechtigung.'
          : err instanceof Error ? err.message : 'Verzeichnis nicht erreichbar.',
      );
    }
  }, [scope, service, pfad]);

  useEffect(() => { laden(); }, [laden]);

  const teile = pfad.split('/').filter(Boolean);

  function neuerOrdner() {
    const name = prompt('Name des neuen Ordners:');
    if (!name) return;
    (async () => {
      try {
        await ausfuehren('files.mkdir', { scope, service, path: pfad ? `${pfad}/${name}` : name });
        setMeldung(`Ordner "${name}" angelegt.`);
        laden();
      } catch (err) {
        if (err instanceof AenderungVorgeschlagen) {
          setMeldung(`Änderungsvorschlag #${err.changeRequestId} eingereicht - wartet auf Freigabe.`);
        } else {
          setFehler(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen.');
        }
      }
    })();
  }

  function neueDatei() {
    const name = prompt('Name der neuen Datei:');
    if (!name) return;
    setOffen(pfad ? `${pfad}/${name}` : name);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {BEREICHE.map((b) => (
          <button
            key={b.id}
            className="mgr-knopf"
            style={{
              padding: '0.25rem 0.65rem',
              fontSize: '0.78rem',
              borderColor: scope === b.id ? 'var(--mgr-kupfer)' : undefined,
            }}
            onClick={() => { setScope(b.id); setPfad(''); setOffen(null); }}
          >
            {b.label}
          </button>
        ))}
      </div>

      {offen !== null ? (
        <Editor
          scope={scope}
          service={service}
          path={offen}
          zurueck={() => { setOffen(null); laden(); }}
          gemeldet={(t) => setMeldung(t)}
        />
      ) : (
        <>
          <div className="mgr-konsole-leiste" style={{ marginBottom: '0.75rem' }}>
            <button className="mgr-knopf" style={{ padding: '0.15rem 0.5rem', fontSize: '0.76rem' }} onClick={() => setPfad('')}>
              {scope === 'configs' ? 'Konfigurationen' : scope === 'plugins' ? 'Plugin-Ordner' : scope === 'worlds' ? 'Welt' : 'Vorlagen'}
            </button>
            {teile.map((t, i) => (
              <span key={i} style={{ display: 'contents' }}>
                <span style={{ color: 'var(--mgr-text-schwach)' }}>/</span>
                <button
                  className="mgr-knopf"
                  style={{ padding: '0.15rem 0.5rem', fontSize: '0.76rem' }}
                  onClick={() => setPfad(teile.slice(0, i + 1).join('/'))}
                >
                  {t}
                </button>
              </span>
            ))}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
              <button className="mgr-knopf" style={{ padding: '0.15rem 0.5rem', fontSize: '0.76rem' }} onClick={neuerOrdner}>
                + Ordner
              </button>
              <button className="mgr-knopf" style={{ padding: '0.15rem 0.5rem', fontSize: '0.76rem' }} onClick={neueDatei}>
                + Datei
              </button>
            </span>
          </div>

          {meldung && <div className="mgr-hinweis-kasten" style={{ marginBottom: '0.75rem' }}>{meldung}</div>}
          {fehler && <div className="mgr-hinweis-kasten mgr-fehler" style={{ marginBottom: '0.75rem' }}>{fehler}</div>}

          {eintraege === null ? (
            <div className="mgr-laedt">Lade …</div>
          ) : eintraege.length === 0 ? (
            <div className="mgr-leer">Dieses Verzeichnis ist leer.</div>
          ) : (
            <div className="mgr-tabelle-rahmen">
              <table className="mgr-tabelle">
                <thead>
                  <tr><th>Name</th><th>Größe</th><th>Geändert</th><th></th></tr>
                </thead>
                <tbody>
                  {eintraege.map((e) => (
                    <tr key={e.name}>
                      <td>
                        {e.type === 'directory' ? (
                          <button
                            className="mgr-knopf"
                            style={{ padding: '0.1rem 0.4rem', fontSize: '0.85rem' }}
                            onClick={() => setPfad(pfad ? `${pfad}/${e.name}` : e.name)}
                          >
                            📁 {e.name}
                          </button>
                        ) : istEditierbar(e.name) ? (
                          <button
                            className="mgr-knopf"
                            style={{ padding: '0.1rem 0.4rem', fontSize: '0.85rem' }}
                            onClick={() => setOffen(pfad ? `${pfad}/${e.name}` : e.name)}
                          >
                            {e.name}
                          </button>
                        ) : (
                          <span>{e.name}</span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--mgr-schrift-fest)', fontSize: '0.82rem' }}>
                        {e.type === 'file' ? formatGroesse(e.size) : '–'}
                      </td>
                      <td style={{ fontFamily: 'var(--mgr-schrift-fest)', fontSize: '0.82rem', color: 'var(--mgr-text-leise)' }}>
                        {e.modifiedAt ? new Date(e.modifiedAt).toLocaleString('de-DE') : '–'}
                      </td>
                      <td>
                        {e.type === 'file' && (
                          <button
                            className="mgr-knopf mgr-knopf-gefahr"
                            style={{ padding: '0.1rem 0.4rem', fontSize: '0.76rem' }}
                            onClick={() => setLoeschFrage(pfad ? `${pfad}/${e.name}` : e.name)}
                          >
                            Löschen
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {loeschFrage && (
        <div className="mgr-modal-grund" onClick={() => setLoeschFrage(null)}>
          <div className="mgr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.7rem' }}>Wirklich löschen?</h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--mgr-text-leise)' }}>
              <strong style={{ color: 'var(--mgr-text)' }}>{loeschFrage}</strong> wird entfernt. Eine Kopie
              bleibt über das Rückgängig-Schild erhalten.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem' }}>
              <button className="mgr-knopf" onClick={() => setLoeschFrage(null)}>Abbrechen</button>
              <button
                className="mgr-knopf mgr-knopf-gefahr"
                onClick={() => {
                  const ziel = loeschFrage;
                  setLoeschFrage(null);
                  (async () => {
                    try {
                      await ausfuehren('files.delete', { scope, service, path: ziel }, { bestaetigt: true });
                      setMeldung(`"${ziel}" gelöscht.`);
                      laden();
                    } catch (err) {
                      if (err instanceof AenderungVorgeschlagen) {
                        setMeldung(`Änderungsvorschlag #${err.changeRequestId} eingereicht - wartet auf Freigabe.`);
                      } else {
                        setFehler(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
                      }
                    }
                  })();
                }}
              >
                Ja, löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

function Editor({ scope, service, path, zurueck, gemeldet }) {
  const [inhalt, setInhalt] = useState('');
  const [neu, setNeu] = useState(false);
  const [fehler, setFehler] = useState(null);
  const [speichert, setSpeichert] = useState(false);
  const [stepUpCode, setStepUpCode] = useState(null);

  useEffect(() => {
    let aktiv = true;
    (async () => {
      try {
        const daten = await ausfuehren('files.read', { scope, service, path });
        if (!aktiv) return;
        if (daten.binary) { setFehler('Binärdatei - kann hier nicht bearbeitet werden.'); return; }
        setInhalt(daten.content || '');
        setNeu(false);
      } catch (err) {
        if (!aktiv) return;
        // Existiert noch nicht - gilt hier als neue Datei, kein Fehler.
        setNeu(true);
        setInhalt('');
        if (!(err instanceof ApiFehler)) setFehler(err instanceof Error ? err.message : null);
      }
    })();
    return () => { aktiv = false; };
  }, [scope, service, path]);

  const speichern = useCallback(async () => {
    setSpeichert(true);
    setFehler(null);
    try {
      await ausfuehren('files.write', { scope, service, path, content: inhalt, encoding: 'utf8' });
      gemeldet(`"${path}" gespeichert.`);
      zurueck();
    } catch (err) {
      if (err instanceof AenderungVorgeschlagen) {
        gemeldet(`Änderungsvorschlag #${err.changeRequestId} eingereicht - wartet auf Freigabe.`);
        zurueck();
      } else if (err instanceof StepUpNoetig) {
        setStepUpCode('');
      } else if (err instanceof BestaetigungNoetig) {
        setFehler(err.message);
      } else {
        setFehler(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
      }
    } finally {
      setSpeichert(false);
    }
  }, [scope, service, path, inhalt, gemeldet, zurueck]);

  return (
    <div>
      <div className="mgr-konsole-leiste" style={{ marginBottom: '0.6rem' }}>
        <button className="mgr-knopf" style={{ padding: '0.15rem 0.5rem', fontSize: '0.76rem' }} onClick={zurueck}>
          ← Zurück
        </button>
        <span style={{ fontFamily: 'var(--mgr-schrift-fest)', fontSize: '0.82rem' }}>
          {path}{neu && ' (neu)'}
        </span>
        <button
          className="mgr-knopf mgr-knopf-haupt"
          style={{ padding: '0.2rem 0.7rem', fontSize: '0.8rem', marginLeft: 'auto' }}
          onClick={() => speichern()}
          disabled={speichert}
        >
          {speichert ? '…' : 'Speichern'}
        </button>
      </div>

      {fehler && <div className="mgr-hinweis-kasten mgr-fehler" style={{ marginBottom: '0.6rem' }}>{fehler}</div>}

      <textarea
        className="mgr-feld"
        style={{
          width: '100%', height: '32rem', fontFamily: 'var(--mgr-schrift-fest)', fontSize: '0.85rem',
          resize: 'vertical', lineHeight: 1.5,
        }}
        value={inhalt}
        onChange={(e) => setInhalt(e.target.value)}
        spellCheck={false}
        placeholder={neu ? 'Neue, leere Datei …' : undefined}
      />
      <p style={{ fontSize: '0.74rem', color: 'var(--mgr-text-schwach)', marginTop: '0.4rem' }}>
        YAML und JSON werden vor dem Speichern auf gültige Syntax geprüft. Eine Kopie des
        vorherigen Standes bleibt über das Rückgängig-Schild erhalten.
      </p>

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
              style={{ fontFamily: 'var(--mgr-schrift-fest)', textAlign: 'center', letterSpacing: '0.25em' }}
            />
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
              <button className="mgr-knopf" onClick={() => setStepUpCode(null)}>Abbrechen</button>
              <button
                className="mgr-knopf mgr-knopf-haupt"
                onClick={() => {
                  (async () => {
                    try {
                      await stepUp(stepUpCode);
                      setStepUpCode(null);
                      await speichern();
                    } catch (err) {
                      setFehler(err instanceof Error ? err.message : 'Bestätigung fehlgeschlagen.');
                    }
                  })();
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
