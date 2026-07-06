import { useEffect, useRef, useState } from "react";
import { getNews, openExternalUrl } from "../api/news.js";

// Automatischer Sync-Rhythmus: neu laden, während der Launcher offen bleibt,
// damit neue Blogbeiträge ohne Neustart auftauchen.
const AUTO_REFRESH_MS = 5 * 60 * 1000;

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function PinIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2c-.4 0-.77.24-.93.6L9.5 7.3 5.4 8.6c-.4.13-.68.47-.73.9-.05.42.15.83.5 1.06l3.4 2.2-.9 4.5c-.08.42.1.85.46 1.08.36.23.83.2 1.16-.07L12 15.5l3.1 2.8c.33.27.8.3 1.16.07.37-.23.54-.66.46-1.08l-.9-4.5 3.4-2.2c.35-.23.55-.64.5-1.06-.05-.43-.32-.77-.73-.9l-4.1-1.3-1.57-4.7A1 1 0 0 0 12 2z" />
    </svg>
  );
}

export default function NewsFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    refresh();
    timerRef.current = window.setInterval(refresh, AUTO_REFRESH_MS);
    return () => window.clearInterval(timerRef.current);
  }, []);

  async function refresh() {
    setError(null);
    try {
      const result = await getNews(6);
      setPosts(result);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="erzmark-news">
      <div className="erzmark-gallery-title">
        <span>Neuigkeiten</span>
        <button className="erzmark-link-btn" onClick={refresh} disabled={loading} title="Aktualisieren">
          ↻
        </button>
      </div>

      {loading && <p className="erzmark-hint">Lädt…</p>}
      {error && <p className="erzmark-error">{error}</p>}

      {!loading && !error && posts.length === 0 && (
        <p className="erzmark-gallery-empty">Noch keine Neuigkeiten gefunden.</p>
      )}

      <div className="erzmark-news-list">
        {posts.map((post) => (
          <button
            key={post.id}
            className="erzmark-news-card"
            onClick={() => openExternalUrl(post.url)}
            title={post.title}
          >
            {post.thumbnail_data_url && (
              <img className="erzmark-news-thumb" src={post.thumbnail_data_url} alt="" />
            )}
            <div className="erzmark-news-body">
              <div className="erzmark-news-meta">
                {post.is_pinned && <PinIcon className="erzmark-news-pin" />}
                <span>{formatDate(post.published_at)}</span>
                <span>·</span>
                <span>{post.author_name}</span>
              </div>
              <h3 className="erzmark-news-title">{post.title}</h3>
              <div
                className="erzmark-news-excerpt"
                dangerouslySetInnerHTML={{ __html: post.excerpt_html }}
              />
              <span className="erzmark-news-readmore">Weiterlesen →</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
