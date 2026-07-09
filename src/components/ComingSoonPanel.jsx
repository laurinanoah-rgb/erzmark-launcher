/**
 * Generischer "Bald verfügbar"-Platzhalter für Dock-Panels, deren Feature
 * serverseitig noch nicht existiert (aktuell: Karte). Sobald die echten
 * Daten/Endpunkte stehen, wird dieses Panel einfach durch die richtige
 * Komponente ersetzt (siehe z. B. CharacterProfiles.jsx als Vorbild für den
 * Aufbau eines "echten" Panels).
 */
export default function ComingSoonPanel({ icon, title, description }) {
  return (
    <div className="erzmark-coming-soon">
      {icon && <div className="erzmark-coming-soon-icon">{icon}</div>}
      <p className="erzmark-coming-soon-title">{title}</p>
      {description && <p className="erzmark-coming-soon-desc">{description}</p>}
      <span className="erzmark-coming-soon-badge">Bald verfügbar</span>
    </div>
  );
}
