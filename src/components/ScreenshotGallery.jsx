import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getScreenshotDataUrl, listScreenshots, openScreenshot, openScreenshotsFolder } from "../api/screenshots.js";

const FAVORITES_KEY = "erzmark.memory-favorites.v1";
function readFavorites() { try { return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]")); } catch { return new Set(); } }
function dateLabel(value) { const normalized = typeof value === "number" && value < 1_000_000_000_000 ? value * 1000 : value; const date = new Date(normalized); return Number.isNaN(date.getTime()) ? "Aus deiner Reise" : date.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }); }

function MemoryCarousel({ memories, initialName, favorites, onFavorite, onClose }) {
  const [index, setIndex] = useState(() => Math.max(0, memories.findIndex((item) => item.filename === initialName)));
  const [playing, setPlaying] = useState(false);
  const [fullUrl, setFullUrl] = useState(null);
  const current = memories[index] ?? memories[0];
  const move = (direction) => setIndex((value) => (value + direction + memories.length) % memories.length);
  useEffect(() => {
    function onKey(event) { if (event.key === "Escape") onClose(); if (event.key === "ArrowLeft") move(-1); if (event.key === "ArrowRight") move(1); }
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => { if (!playing || memories.length < 2) return undefined; const timer = window.setInterval(() => move(1), 4200); return () => window.clearInterval(timer); }, [playing, memories.length]);
  useEffect(() => { let cancelled = false; setFullUrl(null); getScreenshotDataUrl(current.filename).then((url) => { if (!cancelled) setFullUrl(url); }).catch(() => {}); return () => { cancelled = true; }; }, [current.filename]);
  if (!current) return null;
  return createPortal(<div className="erzmark-memory-cinema" role="dialog" aria-modal="true" aria-label="Erinnerungskarussell">
    <div className="erzmark-memory-cinema-backdrop" style={{ backgroundImage: `url(${current.thumbnail_data_url})` }} aria-hidden="true" />
    <header><span><small>Erinnerung {index + 1} von {memories.length}</small><strong>{dateLabel(current.taken_at)}</strong></span><div><button className={playing ? "is-active" : ""} onClick={() => setPlaying((value) => !value)}>{playing ? "Reise anhalten" : "Reise abspielen"}</button><button onClick={onClose} aria-label="Galerie schließen">✕</button></div></header>
    <main><button className="erzmark-memory-cinema-arrow is-left" onClick={() => move(-1)} aria-label="Vorheriges Bild">‹</button><figure key={current.filename} className={fullUrl ? "is-original" : "is-loading"}><img src={fullUrl ?? current.thumbnail_data_url} alt={current.filename} /><figcaption><span><small>{fullUrl ? "Original geladen" : "Original wird entfaltet…"}</small><strong>{current.filename}</strong></span><button className={favorites.has(current.filename) ? "is-favorite" : ""} onClick={() => onFavorite(current.filename)} title="Sternbild umschalten">★</button></figcaption></figure><button className="erzmark-memory-cinema-arrow is-right" onClick={() => move(1)} aria-label="Nächstes Bild">›</button></main>
    <footer><div className="erzmark-memory-cinema-film">{memories.map((item, itemIndex) => <button key={item.filename} className={itemIndex === index ? "is-active" : ""} onClick={() => setIndex(itemIndex)}><img src={item.thumbnail_data_url} alt="" /></button>)}</div><div className="erzmark-memory-cinema-actions"><button onClick={() => openScreenshotsFolder()}>Im Verzeichnis anzeigen ↗</button><button onClick={() => openScreenshot(current.filename)}>Original öffnen ↗</button></div></footer>
  </div>, document.body);
}

export default function ScreenshotGallery() {
  const [screenshots, setScreenshots] = useState([]); const [selectedName, setSelectedName] = useState(null); const [filter, setFilter] = useState("all"); const [favorites, setFavorites] = useState(readFavorites); const [cinemaOpen, setCinemaOpen] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  async function refresh() { setLoading(true); setError(null); try { const result = await listScreenshots(30); setScreenshots(result); setSelectedName((current) => result.some((item) => item.filename === current) ? current : result[0]?.filename ?? null); } catch (err) { setError(err?.message ?? String(err)); } finally { setLoading(false); } }
  useEffect(() => { refresh(); }, []);
  function toggleFavorite(filename) { setFavorites((current) => { const next = new Set(current); if (next.has(filename)) next.delete(filename); else next.add(filename); localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next])); return next; }); }
  const visible = useMemo(() => filter === "favorites" ? screenshots.filter((item) => favorites.has(item.filename)) : screenshots, [screenshots, favorites, filter]); const selected = visible.find((item) => item.filename === selectedName) ?? visible[0];
  return <div className="erzmark-memories">
    <header className="erzmark-module-head"><span><small>Bewahrte Augenblicke</small><strong>Erinnerungen</strong></span><button className="erzmark-link-btn" onClick={refresh} disabled={loading} title="Neu laden">↻</button></header>
    <div className="erzmark-memory-filter"><button className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>Alle <i>{screenshots.length}</i></button><button className={filter === "favorites" ? "is-active" : ""} onClick={() => setFilter("favorites")}>Sternbilder <i>{favorites.size}</i></button></div>
    {loading && <div className="erzmark-module-skeleton"><i /><i /><i /></div>}{error && <p className="erzmark-error">{error}</p>}{!loading && !error && !selected && <div className="erzmark-empty-state"><b>Noch keine Erinnerungen</b><span>Drücke F2 im Spiel. Der Augenblick erscheint dann hier.</span></div>}
    {selected && <article className="erzmark-memory-hero"><button onClick={() => setCinemaOpen(true)} title="Galerie im Launcher öffnen"><img src={selected.thumbnail_data_url} alt={selected.filename} /><span>Galerie betreten ✦</span></button><div><span><small>Aufgenommen</small><b>{dateLabel(selected.taken_at)}</b></span><button className={favorites.has(selected.filename) ? "is-favorite" : ""} onClick={() => toggleFavorite(selected.filename)} aria-label="Als Sternbild markieren">★</button></div></article>}
    {visible.length > 1 && <div className="erzmark-memory-strip">{visible.map((item) => <button key={item.filename} className={item.filename === selected?.filename ? "is-active" : ""} onClick={() => setSelectedName(item.filename)} title={item.filename}><img src={item.thumbnail_data_url} alt="" />{favorites.has(item.filename) && <i>★</i>}</button>)}</div>}
    <button className="erzmark-memory-folder" onClick={() => setCinemaOpen(true)} disabled={!visible.length}><span>Erinnerungskarussell öffnen</span><i>✦</i></button>
    {cinemaOpen && <MemoryCarousel memories={visible} initialName={selected?.filename} favorites={favorites} onFavorite={toggleFavorite} onClose={() => setCinemaOpen(false)} />}
  </div>;
}
