import { useState } from 'react';
import { anmelden, codeBestaetigen, ApiFehler } from '../klient.js';

/**
 * Der Login ist R.U.D.O.L.F.s Erwachen (Abschnitt 1.4).
 *
 * Hier darf es gluehen - man sieht diese Seite selten. Der Ablauf bleibt
 * trotzdem streng zweistufig: Kennung und Passwort, dann der Code. Es gibt
 * keinen Weg, der den zweiten Schritt ueberspringt.
 *
 * Das ist NICHT der Microsoft-Login des Launchers. Der Manager prueft gegen
 * die Erzmark-Identitaet auf erzmark.de - dieselben Zugangsdaten wie fuer die
 * Webseite, inklusive des dortigen zweiten Faktors.
 */
export function Anmeldung({ fertig, abbrechen }) {
  const [schritt, setSchritt] = useState('zugangsdaten');
  const [kennung, setKennung] = useState('');
  const [passwort, setPasswort] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [name, setName] = useState('');
  const [rollen, setRollen] = useState([]);
  const [fehler, setFehler] = useState(null);
  const [laeuft, setLaeuft] = useState(false);
  const [codes, setCodes] = useState(null);
  const [sitzung, setSitzung] = useState(null);

  async function zugangsdatenSenden(e) {
    e.preventDefault();
    setFehler(null);
    setLaeuft(true);
    try {
      const schrittZwei = await anmelden(kennung.trim(), passwort);
      setChallenge(schrittZwei.challengeToken);
      setName(schrittZwei.displayName);
      setRollen(schrittZwei.rollen);
      setPasswort('');
      setSchritt('code');
    } catch (err) {
      if (err instanceof ApiFehler && err.code === 'zweiter_faktor_fehlt') {
        // Hier hilft Verschweigen niemandem: Wer bis hierher kommt, hat Kennung
        // und Passwort richtig - er muss wissen, was ihm fehlt.
        setFehler({
          text: err.message,
          hilfe: 'erzmark.de öffnen → Profil → Zwei-Faktor-Authentifizierung → QR-Code scannen.',
        });
      } else {
        setFehler({ text: err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.' });
      }
    } finally {
      setLaeuft(false);
    }
  }

  async function codeSenden(e) {
    e.preventDefault();
    setFehler(null);
    setLaeuft(true);
    try {
      const ergebnis = await codeBestaetigen(challenge, code.trim());
      if (ergebnis.recoveryCodes) {
        // Sie erscheinen genau einmal. Die Sitzung wird erst freigegeben, wenn
        // die Person bestaetigt hat, sie gesichert zu haben.
        setCodes(ergebnis.recoveryCodes);
        setSitzung(ergebnis.sitzung);
      } else {
        fertig(ergebnis.sitzung);
      }
    } catch (err) {
      setCode('');
      setFehler({
        text: err instanceof Error ? err.message : 'Der Code stimmt nicht.',
        hilfe:
          err instanceof ApiFehler && err.code === 'code_falsch'
            ? 'Stimmt die Uhrzeit des Geräts? Der Code hängt an der Uhr.'
            : undefined,
      });
    } finally {
      setLaeuft(false);
    }
  }

  if (codes && sitzung) {
    return <Wiederherstellungscodes codes={codes} weiter={() => fertig(sitzung)} />;
  }

  return (
    <div className="mgr-erwachen">
      <div className="mgr-erwachen-tafel">
        <p className="mgr-erwachen-marke">Erzmark Manager</p>
        <h1 className="mgr-erwachen-titel">R.U.D.O.L.F.s Kern</h1>
        <p className="mgr-erwachen-unterzeile">
          {schritt === 'zugangsdaten'
            ? 'Dieselben Zugangsdaten wie auf erzmark.de.'
            : `Willkommen, ${name}${rollen.length ? ' · ' + rollen.join(', ') : ''}`}
        </p>

        {fehler && (
          <div className="mgr-hinweis-kasten mgr-fehler" style={{ marginBottom: '1.15rem' }}>
            <div>{fehler.text}</div>
            {fehler.hilfe && (
              <div style={{ marginTop: '0.4rem', color: 'var(--mgr-text-leise)', fontSize: '0.88rem' }}>
                {fehler.hilfe}
              </div>
            )}
          </div>
        )}

        {schritt === 'zugangsdaten' ? (
          <form className="mgr-erwachen-formular" onSubmit={zugangsdatenSenden}>
            <div>
              <label className="mgr-etikett" htmlFor="mgr-kennung">Benutzername oder E-Mail</label>
              <input
                id="mgr-kennung"
                className="mgr-feld"
                value={kennung}
                onChange={(e) => setKennung(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="mgr-etikett" htmlFor="mgr-passwort">Passwort</label>
              <input
                id="mgr-passwort"
                className="mgr-feld"
                type="password"
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button className="mgr-knopf mgr-knopf-haupt" type="submit" disabled={laeuft}>
              {laeuft ? 'Prüfe …' : 'Weiter'}
            </button>
            {abbrechen && (
              <button className="mgr-knopf" type="button" onClick={abbrechen}>
                Zurück zum Launcher
              </button>
            )}
          </form>
        ) : (
          <form className="mgr-erwachen-formular" onSubmit={codeSenden}>
            <div>
              <label className="mgr-etikett" htmlFor="mgr-code">Code aus der Authenticator-App</label>
              <input
                id="mgr-code"
                className="mgr-feld"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                style={{
                  fontFamily: 'var(--mgr-schrift-fest)',
                  fontSize: '1.15rem',
                  letterSpacing: '0.25em',
                  textAlign: 'center',
                }}
                autoFocus
                required
              />
            </div>
            <button className="mgr-knopf mgr-knopf-haupt" type="submit" disabled={laeuft}>
              {laeuft ? 'Prüfe …' : 'Eintreten'}
            </button>
            <button
              className="mgr-knopf"
              type="button"
              onClick={() => {
                setSchritt('zugangsdaten');
                setFehler(null);
                setCode('');
              }}
            >
              Zurück
            </button>
            <p
              style={{
                fontSize: '0.82rem',
                color: 'var(--mgr-text-schwach)',
                textAlign: 'center',
                margin: 0,
              }}
            >
              Ein Wiederherstellungscode wird hier ebenfalls angenommen.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Wiederherstellungscodes - genau einmal sichtbar (3.7).
 *
 * Bewusst mit einer Huerde davor: Ohne ausdrueckliche Bestaetigung geht es nicht
 * weiter. Wer hier durchklickt, ohne sie zu sichern, hat spaeter keinen Weg
 * zurueck ins System.
 */
function Wiederherstellungscodes({ codes, weiter }) {
  const [bestaetigt, setBestaetigt] = useState(false);

  return (
    <div className="mgr-erwachen">
      <div className="mgr-erwachen-tafel" style={{ maxWidth: '32rem' }}>
        <p className="mgr-erwachen-marke">Einmalig</p>
        <h1 className="mgr-erwachen-titel" style={{ fontSize: '1.5rem' }}>
          Wiederherstellungscodes
        </h1>
        <p className="mgr-erwachen-unterzeile">
          Sie sind der Weg zurück, wenn das Gerät mit der Authenticator-App verloren geht.
          Diese Anzeige erscheint kein zweites Mal.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.5rem 1.5rem',
            background: 'var(--mgr-stein-tief)',
            border: '1px dashed var(--mgr-kante-hell)',
            borderRadius: '3px',
            padding: '1.1rem 1.3rem',
            fontFamily: 'var(--mgr-schrift-fest)',
            fontSize: '0.95rem',
            marginBottom: '1.25rem',
          }}
        >
          {codes.map((c) => (
            <div key={c}>{c}</div>
          ))}
        </div>

        <div className="mgr-erwachen-formular">
          <button
            className="mgr-knopf"
            type="button"
            onClick={() => navigator.clipboard && navigator.clipboard.writeText(codes.join('\n'))}
          >
            In die Zwischenablage kopieren
          </button>
          <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={bestaetigt}
              onChange={(e) => setBestaetigt(e.target.checked)}
              style={{ marginTop: '0.25rem' }}
            />
            <span>Ich habe die Codes ausgedruckt oder an einem sicheren Ort gespeichert.</span>
          </label>
          <button className="mgr-knopf mgr-knopf-haupt" type="button" disabled={!bestaetigt} onClick={weiter}>
            Weiter
          </button>
        </div>
      </div>
    </div>
  );
}
