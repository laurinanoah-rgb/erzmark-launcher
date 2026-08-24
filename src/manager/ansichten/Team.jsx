import { useEffect, useState } from 'react';
import { ausfuehren } from '../klient.js';

/**
 * Der Rat - Team und Rollen.
 *
 * Nur der Inhaber sieht diesen Bereich (3.5). Die Rollen kommen aus MineTrax und
 * werden bei jedem Login abgeglichen; hier steht deshalb, was tatsaechlich gilt -
 * nicht, was jemand einmal eingetragen hat.
 */
export function Team() {
  const [mitglieder, setMitglieder] = useState(null);
  const [zuordnung, setZuordnung] = useState([]);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const daten = await ausfuehren('team.list');
        setMitglieder(daten.mitglieder);
        const m = await ausfuehren('team.mapping.list');
        setZuordnung(m.zuordnung);
      } catch (err) {
        setFehler(err instanceof Error ? err.message : 'Team nicht abrufbar.');
      }
    })();
  }, []);

  if (fehler) return <div className="mgr-hinweis-kasten mgr-fehler">{fehler}</div>;
  if (!mitglieder) return <div className="mgr-laedt">Lade …</div>;

  const ohneZweitfaktor = mitglieder.filter((m) => !m.totpEnrolled).length;

  return (
    <div className="mgr-ebene">
      <div className="mgr-abschnitt-titel">Wer Zugang hat</div>

      {ohneZweitfaktor > 0 && (
        <div className="mgr-hinweis-kasten" style={{ marginBottom: '1.25rem' }}>
          {ohneZweitfaktor === 1 ? 'Ein Konto hat' : ohneZweitfaktor + ' Konten haben'} noch keinen
          zweiten Faktor und kommt damit nicht herein. Einrichtung auf erzmark.de unter Profil →
          Zwei-Faktor-Authentifizierung.
        </div>
      )}

      <div className="mgr-tabelle-rahmen" style={{ marginBottom: '2.5rem' }}>
        <table className="mgr-tabelle">
          <thead>
            <tr>
              <th>Name</th>
              <th>Rollen</th>
              <th>Zweiter Faktor</th>
              <th>Zuletzt gesehen</th>
            </tr>
          </thead>
          <tbody>
            {mitglieder.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.displayName}
                  {m.isOwner && (
                    <span className="mgr-siegel" style={{ marginLeft: '0.5rem' }}>
                      Inhaber
                    </span>
                  )}
                  {!m.isActive && (
                    <span className="mgr-siegel" style={{ marginLeft: '0.5rem', color: 'var(--mgr-kritisch)' }}>
                      gesperrt
                    </span>
                  )}
                </td>
                <td style={{ fontFamily: 'var(--mgr-schrift-fest)', fontSize: '0.8rem' }}>
                  {m.rollen.join(', ') || '–'}
                </td>
                <td style={{ color: m.totpEnrolled ? 'var(--mgr-gut)' : 'var(--mgr-warnung)' }}>
                  {m.totpEnrolled ? 'eingerichtet' : 'fehlt'}
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--mgr-text-leise)' }}>
                  {m.lastSeenAt ? new Date(m.lastSeenAt).toLocaleString('de-DE') : 'noch nie'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mgr-abschnitt-titel">Wie Rollen übernommen werden</div>
      <p style={{ color: 'var(--mgr-text-leise)', fontSize: '0.9rem', marginBottom: '1rem' }}>
        Der Zugang kommt aus erzmark.de. Wer dort eine dieser Rollen trägt und einen zweiten Faktor
        eingerichtet hat, bekommt beim Anmelden automatisch sein Konto. Wer die Rolle dort verliert,
        verliert hier beim nächsten Versuch den Zugang.
      </p>
      <div className="mgr-tabelle-rahmen">
        <table className="mgr-tabelle">
          <thead>
            <tr>
              <th>Rolle auf erzmark.de</th>
              <th>Rolle im Manager</th>
            </tr>
          </thead>
          <tbody>
            {zuordnung.map((z) => (
              <tr key={z.identityRole}>
                <td style={{ fontFamily: 'var(--mgr-schrift-fest)', fontSize: '0.82rem' }}>
                  {z.identityRole}
                </td>
                <td style={{ fontFamily: 'var(--mgr-schrift-fest)', fontSize: '0.82rem' }}>
                  {z.managerRole}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
