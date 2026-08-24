/**
 * Halbrunde Anzeige, als Runenkreis gestaltet - aber mit exakter Zahl in der
 * Mitte (Abschnitt 9.2). Der Bogen ist Schmuck, die Zahl ist die Aussage; wer
 * ablesen will, wie voll der Speicher ist, soll keinen Kreis abschaetzen muessen.
 */
export function Runenkreis({ name, wert, einheit = '%', zusatz, maximum = 100 }) {
  const anteil = wert === null || wert === undefined ? 0 : Math.max(0, Math.min(1, wert / maximum));

  const radius = 46;
  const umfang = Math.PI * radius;
  const gefuellt = umfang * anteil;

  const farbe =
    anteil >= 0.9 ? 'var(--mgr-kritisch)' : anteil >= 0.75 ? 'var(--mgr-warnung)' : 'var(--mgr-kupfer)';

  const fehlt = wert === null || wert === undefined;

  return (
    <div className="mgr-runenkreis">
      <svg
        viewBox="0 0 108 62"
        width="100%"
        height="62"
        role="img"
        aria-label={`${name}: ${fehlt ? 'unbekannt' : wert + einheit}`}
      >
        <path
          d={`M 8 54 A ${radius} ${radius} 0 0 1 100 54`}
          fill="none"
          stroke="var(--mgr-kante)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {!fehlt && (
          <path
            d={`M 8 54 A ${radius} ${radius} 0 0 1 100 54`}
            fill="none"
            stroke={farbe}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${gefuellt} ${umfang}`}
          />
        )}
      </svg>
      <div className="mgr-runenkreis-zahl" style={fehlt ? { color: 'var(--mgr-text-schwach)' } : undefined}>
        {fehlt ? '–' : formatiere(wert)}
        <span style={{ fontSize: '0.7em', color: 'var(--mgr-text-leise)' }}>{einheit}</span>
      </div>
      <div className="mgr-runenkreis-name">{name}</div>
      {zusatz && <div className="mgr-runenkreis-zusatz">{zusatz}</div>}
    </div>
  );
}

/**
 * Eine Kennzahl ohne Bogen.
 *
 * Fuer Werte ohne Obergrenze - eine Laufzeit hat keinen Anteil an einem
 * Maximum. Ein leerer Runenkreis mit einem Strich in der Mitte sieht aus wie
 * ein fehlender Wert, und genau das ist er nicht.
 */
export function Wert({ name, text, zusatz }) {
  return (
    <div
      className="mgr-runenkreis"
      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
    >
      <div className="mgr-runenkreis-zahl" style={{ fontSize: '1.15rem', marginTop: '0.9rem' }}>
        {text}
      </div>
      <div className="mgr-runenkreis-name">{name}</div>
      {zusatz && <div className="mgr-runenkreis-zusatz">{zusatz}</div>}
    </div>
  );
}

function formatiere(wert) {
  if (wert >= 100) return String(Math.round(wert));
  return wert.toFixed(1);
}

/** Bytes in eine Form bringen, die man vorlesen kann. */
export function bytes(anzahl) {
  const einheiten = ['B', 'KB', 'MB', 'GB', 'TB'];
  let wert = anzahl;
  let i = 0;
  while (wert >= 1024 && i < einheiten.length - 1) {
    wert /= 1024;
    i++;
  }
  return `${wert.toFixed(wert >= 100 || i === 0 ? 0 : 1)} ${einheiten[i]}`;
}

/** Sekunden als Laufzeit, wie man sie im Gespraech nennen wuerde. */
export function laufzeit(sekunden) {
  const tage = Math.floor(sekunden / 86400);
  const stunden = Math.floor((sekunden % 86400) / 3600);
  const minuten = Math.floor((sekunden % 3600) / 60);
  if (tage > 0) return `${tage} T ${stunden} h`;
  if (stunden > 0) return `${stunden} h ${minuten} min`;
  return `${minuten} min`;
}
