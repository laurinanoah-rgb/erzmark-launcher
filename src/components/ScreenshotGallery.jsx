import { useEffect, useState } from "react";
import { listScreenshots, openScreenshot, openScreenshotsFolder } from "../api/screenshots.js";

/**
 * Vitrine für die zuletzt gemachten Minecraft-Screenshots (F2 im Spiel).
 * Rein lokal – liest direkt aus dem Spielordner, kein Server-Backend nötig.
 */
export default function ScreenshotGallery() {
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setScreenshots(await listScreenshots(8));
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="erzmark-gallery">
      <div className="erzmark-gallery-title">
        <span>Screenshots</span>
        <button className="erzmark-link-btn" onClick={refresh} disabled={loading} title="Aktualisieren">
          ↻
        </button>
      </div>

      {loading && <p className="erzmark-hint">Lädt…</p>}
      {error && <p className="erzmark-error">{error}</p>}

      {!loading && !error && screenshots.length === 0 && (
        <p className="erzmark-gallery-empty">
          Noch keine Screenshots. Drück F2 im Spiel, um einen zu machen.
        </p>
      )}

      {!loading && screenshots.length > 0 && (
        <div className="erzmark-gallery-grid">
          {screenshots.map((s) => (
            <button
              key={s.filename}
              className="erzmark-gallery-thumb"
              onClick={() => openScreenshot(s.filename)}
              title={s.filename}
            >
              <img src={s.thumbnail_data_url} alt={s.filename} />
            </button>
          ))}
        </div>
      )}

      <button className="erzmark-gallery-folder-btn" onClick={openScreenshotsFolder}>
        Ordner öffnen
      </button>
    </div>
  );
}
