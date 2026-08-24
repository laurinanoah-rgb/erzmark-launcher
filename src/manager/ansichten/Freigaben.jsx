import { useCallback, useEffect, useState } from 'react';
import { ausfuehren } from '../klient.js';

/**
 * Freigabe-Workflow (3.8).
 *
 * Zeigt Aenderungsvorschlaege von Builder-Schreibvorgaengen mit
 * Vorher-Nachher-Vergleich. Developer und Admin nehmen an oder lehnen mit
 * Begruendung ab - beides landet im Gedaechtnis.
 */

function zielBeschreibung(v) {
  const p = v.params;
  const teile = [p.service, p.scope, p.path || p.filename].filter(Boolean);
  return teile.length > 0 ? teile.join(' / ') : v.operation;
}

export function Freigaben() {
  const [vorschlaege, setVorschlaege] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const [ablehnFrage, setAblehnFrage] = useState(null);
  const [ablehnGrund, setAblehnGrund] = useState('');
  const [laeuft, setLaeuft] = useState(false);

  const laden = useCallback(async () => {
    try {
      const daten = await ausfuehren('changes.list', { status: 'pending' });
      setVorschlaege(daten.vorschlaege);
      setFehler(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Vorschläge nicht erreichbar.');
    }
  }, []);

  useEffect(() => {
    laden();
    const takt = setInterval(laden, 20000);
    return () => clearInterval(takt);
  }, [laden]);

  async function annehmen(v) {
    setLaeuft(true);
    try {
      await ausfuehren('changes.approve', { id: v.id });
      setMeldung(`Vorschlag #${v.id} übernommen.`);
      laden();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Freigeben fehlgeschlagen.');
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="mgr-ebene">
      <div className="mgr-abschnitt-titel">Ausstehende Änderungsvorschläge</div>
      <p style={{ fontSize: '0.85rem', color: 'var(--mgr-text-leise)', marginBottom: '1.25rem' }}>
        Schreibvorgänge der Rolle Builder werden erst nach Freigabe wirksam (3.8). Beide
        Entscheidungen - annehmen wie ablehnen - stehen im Gedächtnis.
      </p>

      {meldung && <div className="mgr-hinweis-kasten" style={{ marginBottom: '1rem' }}>{meldung}</div>}
      {fehler && <div className="mgr-hinweis-kasten mgr-fehler" style={{ marginBottom: '1rem' }}>{fehler}</div>}

      {vorschlaege === null ? (
        <div className="mgr-laedt">Lade …</div>
      ) : vorschlaege.length === 0 ? (
        <div className="mgr-leer">Keine offenen Vorschläge.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {vorschlaege.map((v) => (
            <div key={v.id} className="mgr-modal" style={{ maxWidth: 'none', margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.6rem' }}>
                <strong>#{v.id}</strong>
                <span style={{ fontFamily: 'var(--mgr-schrift-fest)', fontSize: '0.82rem' }}>{v.operation}</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--mgr-text-leise)' }}>{zielBeschreibung(v)}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.76rem', color: 'var(--mgr-text-schwach)' }}>
                  {v.requesterName} · {new Date(v.createdAt).toLocaleString('de-DE')}
                </span>
              </div>

              {(v.previewBefore !== null || v.previewAfter !== null) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.9rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--mgr-text-schwach)', marginBottom: '0.2rem' }}>Vorher</div>
                    <pre className="mgr-konsole" style={{ height: '10rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {v.previewBefore || '(existiert noch nicht)'}
                    </pre>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--mgr-text-schwach)', marginBottom: '0.2rem' }}>Nachher</div>
                    <pre className="mgr-konsole" style={{ height: '10rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {v.previewAfter || '(wird gelöscht)'}
                    </pre>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button className="mgr-knopf mgr-knopf-haupt" onClick={() => annehmen(v)} disabled={laeuft}>
                  Annehmen
                </button>
                <button className="mgr-knopf mgr-knopf-gefahr" onClick={() => { setAblehnFrage(v); setAblehnGrund(''); }} disabled={laeuft}>
                  Ablehnen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {ablehnFrage && (
        <div className="mgr-modal-grund" onClick={() => setAblehnFrage(null)}>
          <div className="mgr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.7rem' }}>Vorschlag #{ablehnFrage.id} ablehnen</h3>
            <input
              className="mgr-feld"
              style={{ width: '100%' }}
              placeholder="Begründung (Pflicht)"
              value={ablehnGrund}
              onChange={(e) => setAblehnGrund(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem' }}>
              <button className="mgr-knopf" onClick={() => setAblehnFrage(null)}>Abbrechen</button>
              <button
                className="mgr-knopf mgr-knopf-gefahr"
                disabled={ablehnGrund.trim().length < 3}
                onClick={() => {
                  const v = ablehnFrage;
                  const grund = ablehnGrund.trim();
                  setAblehnFrage(null);
                  (async () => {
                    try {
                      await ausfuehren('changes.reject', { id: v.id, reason: grund });
                      setMeldung(`Vorschlag #${v.id} abgelehnt.`);
                      laden();
                    } catch (err) {
                      setFehler(err instanceof Error ? err.message : 'Ablehnen fehlgeschlagen.');
                    }
                  })();
                }}
              >
                Ja, ablehnen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
