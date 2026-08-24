import { useCallback, useEffect, useState } from 'react';
import { AenderungVorgeschlagen, ApiFehler, ausfuehren } from '../klient.js';

/**
 * Ebene 3, Reiter "Plugins" (5.2).
 *
 * Hochladen, per Modrinth installieren, entfernen. Modrinth hat eine
 * oeffentliche, kostenlose API - Spigot nicht (dort waere nur Screen-Scraping
 * moeglich), deshalb bleibt Spigot hier aussen vor.
 */

function formatGroesse(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export function Plugins({ service }) {
  const [plugins, setPlugins] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const [suchOffen, setSuchOffen] = useState(false);
  const [loeschFrage, setLoeschFrage] = useState(null);
  const [hochlaedt, setHochlaedt] = useState(false);

  const laden = useCallback(async () => {
    setFehler(null);
    try {
      const daten = await ausfuehren('plugins.list', { service });
      setPlugins(daten.plugins);
    } catch (err) {
      setPlugins([]);
      setFehler(
        err instanceof ApiFehler && err.code === 'keine_berechtigung'
          ? 'Für Plugins fehlt diesem Konto die Berechtigung.'
          : err instanceof Error ? err.message : 'Plugins nicht erreichbar.',
      );
    }
  }, [service]);

  useEffect(() => { laden(); }, [laden]);

  async function hochladen(datei) {
    if (!datei.name.toLowerCase().endsWith('.jar')) {
      setFehler('Nur .jar-Dateien können hochgeladen werden.');
      return;
    }
    setHochlaedt(true);
    setFehler(null);
    try {
      const buffer = await datei.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ''),
      );
      await ausfuehren('plugins.upload', { service, filename: datei.name, contentBase64: base64 });
      setMeldung(`"${datei.name}" hochgeladen.`);
      laden();
    } catch (err) {
      if (err instanceof AenderungVorgeschlagen) {
        setMeldung(`Änderungsvorschlag #${err.changeRequestId} eingereicht - wartet auf Freigabe.`);
      } else {
        setFehler(err instanceof Error ? err.message : 'Hochladen fehlgeschlagen.');
      }
    } finally {
      setHochlaedt(false);
    }
  }

  return (
    <div>
      <div className="mgr-konsole-leiste" style={{ marginBottom: '0.75rem' }}>
        <span>{plugins ? `${plugins.length} Plugins` : '…'}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
          <label className="mgr-knopf" style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer' }}>
            {hochlaedt ? 'Lädt hoch …' : '.jar hochladen'}
            <input
              type="file"
              accept=".jar"
              style={{ display: 'none' }}
              disabled={hochlaedt}
              onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) hochladen(f); e.target.value = ''; }}
            />
          </label>
          <button className="mgr-knopf mgr-knopf-haupt" style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }} onClick={() => setSuchOffen(true)}>
            Von Modrinth installieren
          </button>
        </span>
      </div>

      {meldung && <div className="mgr-hinweis-kasten" style={{ marginBottom: '0.75rem' }}>{meldung}</div>}
      {fehler && <div className="mgr-hinweis-kasten mgr-fehler" style={{ marginBottom: '0.75rem' }}>{fehler}</div>}

      {plugins === null ? (
        <div className="mgr-laedt">Lade …</div>
      ) : plugins.length === 0 ? (
        <div className="mgr-leer">Keine Plugins in diesem Dienst.</div>
      ) : (
        <div className="mgr-tabelle-rahmen">
          <table className="mgr-tabelle">
            <thead><tr><th>Name</th><th>Größe</th><th>Geändert</th><th></th></tr></thead>
            <tbody>
              {plugins.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td style={{ fontFamily: 'var(--mgr-schrift-fest)', fontSize: '0.82rem' }}>{formatGroesse(p.size)}</td>
                  <td style={{ fontFamily: 'var(--mgr-schrift-fest)', fontSize: '0.82rem', color: 'var(--mgr-text-leise)' }}>
                    {p.modifiedAt ? new Date(p.modifiedAt).toLocaleString('de-DE') : '–'}
                  </td>
                  <td>
                    <button
                      className="mgr-knopf mgr-knopf-gefahr"
                      style={{ padding: '0.1rem 0.4rem', fontSize: '0.76rem' }}
                      onClick={() => setLoeschFrage(p.name)}
                    >
                      Entfernen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loeschFrage && (
        <div className="mgr-modal-grund" onClick={() => setLoeschFrage(null)}>
          <div className="mgr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.7rem' }}>Plugin wirklich entfernen?</h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--mgr-text-leise)' }}>
              <strong style={{ color: 'var(--mgr-text)' }}>{loeschFrage}</strong> wird gelöscht. Eine Kopie
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
                      await ausfuehren('plugins.delete', { service, filename: ziel }, { bestaetigt: true });
                      setMeldung(`"${ziel}" entfernt.`);
                      laden();
                    } catch (err) {
                      setFehler(err instanceof Error ? err.message : 'Entfernen fehlgeschlagen.');
                    }
                  })();
                }}
              >
                Ja, entfernen
              </button>
            </div>
          </div>
        </div>
      )}

      {suchOffen && (
        <ModrinthSuche
          service={service}
          schliessen={() => setSuchOffen(false)}
          installiert={(text) => { setMeldung(text); setSuchOffen(false); laden(); }}
        />
      )}
    </div>
  );
}

function ModrinthSuche({ service, schliessen, installiert }) {
  const [suche, setSuche] = useState('');
  const [treffer, setTreffer] = useState(null);
  const [projekt, setProjekt] = useState(null);
  const [versionen, setVersionen] = useState(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState(null);

  async function suchen(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (suche.trim().length < 2) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const daten = await ausfuehren('plugins.search_modrinth', { query: suche });
      setTreffer(daten.treffer);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Suche fehlgeschlagen.');
    } finally {
      setLaeuft(false);
    }
  }

  async function versionenLaden(t) {
    setProjekt(t);
    setVersionen(null);
    setFehler(null);
    try {
      const daten = await ausfuehren('plugins.modrinth_versions', { projectIdOrSlug: t.slug });
      setVersionen(daten.versionen);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Versionen nicht erreichbar.');
    }
  }

  async function installieren(v) {
    setLaeuft(true);
    setFehler(null);
    try {
      await ausfuehren('plugins.install_modrinth', { service, versionId: v.id });
      installiert(`${v.dateiname || (projekt && projekt.titel) || 'Plugin'} installiert.`);
    } catch (err) {
      if (err instanceof AenderungVorgeschlagen) {
        installiert(`Änderungsvorschlag #${err.changeRequestId} eingereicht - wartet auf Freigabe.`);
      } else {
        setFehler(err instanceof Error ? err.message : 'Installation fehlgeschlagen.');
      }
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="mgr-modal-grund" onClick={schliessen}>
      <div className="mgr-modal" style={{ maxWidth: '38rem', width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.7rem' }}>Von Modrinth installieren</h3>

        {!projekt ? (
          <>
            <form onSubmit={suchen} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                className="mgr-feld"
                style={{ flex: 1 }}
                placeholder="Plugin suchen …"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                autoFocus
              />
              <button className="mgr-knopf mgr-knopf-haupt" type="submit" disabled={laeuft}>
                {laeuft ? '…' : 'Suchen'}
              </button>
            </form>

            {fehler && <div className="mgr-hinweis-kasten mgr-fehler" style={{ marginBottom: '0.75rem' }}>{fehler}</div>}

            <div style={{ maxHeight: '24rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {treffer && treffer.map((t) => (
                <button
                  key={t.projectId}
                  className="mgr-knopf"
                  style={{ textAlign: 'left', padding: '0.5rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}
                  onClick={() => versionenLaden(t)}
                >
                  <span style={{ fontWeight: 600 }}>{t.titel}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--mgr-text-leise)' }}>{t.beschreibung}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--mgr-text-schwach)', fontFamily: 'var(--mgr-schrift-fest)' }}>
                    {t.downloads.toLocaleString('de-DE')} Downloads
                  </span>
                </button>
              ))}
              {treffer && treffer.length === 0 && <div className="mgr-leer">Keine Treffer.</div>}
            </div>
          </>
        ) : (
          <>
            <button className="mgr-knopf" style={{ padding: '0.15rem 0.5rem', fontSize: '0.76rem', marginBottom: '0.75rem' }}
              onClick={() => { setProjekt(null); setVersionen(null); }}>
              ← Zur Suche
            </button>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              <strong>{projekt.titel}</strong> - Version wählen:
            </p>

            {fehler && <div className="mgr-hinweis-kasten mgr-fehler" style={{ marginBottom: '0.75rem' }}>{fehler}</div>}

            {versionen === null ? (
              <div className="mgr-laedt">Lade Versionen …</div>
            ) : (
              <div style={{ maxHeight: '22rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {versionen.map((v) => (
                  <button
                    key={v.id}
                    className="mgr-knopf"
                    style={{ textAlign: 'left', padding: '0.5rem 0.7rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onClick={() => installieren(v)}
                    disabled={laeuft}
                  >
                    <span>
                      <strong>{v.versionNummer}</strong>{' '}
                      <span style={{ fontSize: '0.78rem', color: 'var(--mgr-text-leise)' }}>
                        {v.dateiname} {v.groesse ? `· ${formatGroesse(v.groesse)}` : ''}
                      </span>
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--mgr-text-schwach)' }}>Installieren →</span>
                  </button>
                ))}
                {versionen.length === 0 && <div className="mgr-leer">Keine Versionen gefunden.</div>}
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem' }}>
          <button className="mgr-knopf" onClick={schliessen}>Schließen</button>
        </div>
      </div>
    </div>
  );
}
