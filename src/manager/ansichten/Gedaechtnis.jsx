import { useEffect, useState } from 'react';
import { ausfuehren } from '../klient.js';

/**
 * Das Gedaechtnis - das Audit-Log (3.9).
 *
 * Nur lesen. Es gibt hier keinen Knopf zum Aendern oder Loeschen, weil es im
 * Agent keine Operation dafuer gibt - auch nicht fuer den Inhaber (Regel 4).
 */
export function Gedaechtnis() {
  const [eintraege, setEintraege] = useState(null);
  const [nurAbgelehnt, setNurAbgelehnt] = useState(false);
  const [pruefung, setPruefung] = useState(null);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const daten = await ausfuehren('audit.query', { limit: 200 });
        setEintraege(daten.entries);
      } catch (err) {
        setFehler(err instanceof Error ? err.message : 'Gedächtnis nicht erreichbar.');
      }
    })();
  }, []);

  const gezeigt = (eintraege || []).filter((e) => !nurAbgelehnt || e.outcome !== 'ok');

  return (
    <div className="mgr-ebene">
      <div className="mgr-abschnitt-titel">Was geschehen ist</div>

      {fehler && <div className="mgr-hinweis-kasten mgr-fehler">{fehler}</div>}

      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '1.1rem' }}>
        <button
          className="mgr-knopf"
          style={{
            padding: '0.25rem 0.65rem',
            fontSize: '0.78rem',
            borderColor: nurAbgelehnt ? 'var(--mgr-kupfer)' : undefined,
          }}
          onClick={() => setNurAbgelehnt((v) => !v)}
        >
          Nur Ablehnungen und Fehler
        </button>
        <button
          className="mgr-knopf"
          style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem', marginLeft: 'auto' }}
          onClick={async () => {
            setPruefung('prüfe …');
            try {
              const e = await ausfuehren('audit.verify');
              setPruefung(e.message);
            } catch (err) {
              setPruefung(err instanceof Error ? err.message : 'Prüfung fehlgeschlagen.');
            }
          }}
        >
          Kette prüfen
        </button>
      </div>

      {pruefung && (
        <div className="mgr-hinweis-kasten" style={{ marginBottom: '1.1rem' }}>
          {pruefung}
        </div>
      )}

      {!eintraege ? (
        <div className="mgr-laedt">Lade …</div>
      ) : (
        <div className="mgr-tabelle-rahmen">
          <table className="mgr-tabelle">
            <thead>
              <tr>
                <th style={{ width: '4rem' }}>Nr.</th>
                <th style={{ width: '11rem' }}>Wann</th>
                <th style={{ width: '9rem' }}>Wer</th>
                <th>Was</th>
                <th style={{ width: '6rem' }}>Ausgang</th>
              </tr>
            </thead>
            <tbody>
              {gezeigt.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontFamily: 'var(--mgr-schrift-fest)', color: 'var(--mgr-text-schwach)' }}>
                    {e.id}
                  </td>
                  <td style={{ fontFamily: 'var(--mgr-schrift-fest)', fontSize: '0.78rem' }}>
                    {new Date(e.occurredAt).toLocaleString('de-DE')}
                  </td>
                  <td>{e.actorLabel}</td>
                  <td>
                    {e.summary}
                    {e.sensitive && (
                      <span className="mgr-siegel" style={{ marginLeft: '0.5rem', color: 'var(--mgr-warnung)' }}>
                        sensibel
                      </span>
                    )}
                    {e.errorText && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--mgr-text-schwach)' }}>
                        {e.errorText}
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        color: farbe(e.outcome),
                        fontFamily: 'var(--mgr-schrift-fest)',
                        fontSize: '0.76rem',
                      }}
                    >
                      {text(e.outcome)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {gezeigt.length === 0 && <div className="mgr-leer">Nichts gefunden.</div>}
        </div>
      )}
    </div>
  );
}

function farbe(a) {
  return a === 'ok' ? 'var(--mgr-gut)' : a === 'denied' ? 'var(--mgr-warnung)' : 'var(--mgr-kritisch)';
}

function text(a) {
  return a === 'ok' ? 'ok' : a === 'denied' ? 'abgelehnt' : 'Fehler';
}
