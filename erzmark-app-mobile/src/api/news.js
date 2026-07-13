// Erzmark-Neuigkeiten (erzmark.de/news, MineTrax/Laravel+Inertia). Es gibt
// keine öffentliche JSON-API dafür - dieselbe Technik wie im Desktop-Launcher
// (siehe src-tauri/src/news.rs im Projekt-Root): die Seite rendert beim
// initialen Aufruf ihre komplette Inertia-Page-Payload in ein
// `<script data-page="app" type="application/json">`-Tag, daraus wird die
// Neuigkeiten-Liste extrahiert, ganz ohne Änderungen an der Webseite.
const NEWS_PAGE_URL = "https://erzmark.de/news";
const SCRIPT_MARKER = 'data-page="app" type="application/json">';

/** Entfernt HTML-Tags aus dem Kurztext, RN Text kann kein HTML rendern. */
function stripHtml(html) {
  return (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractInertiaPayload(html) {
  const startIdx = html.indexOf(SCRIPT_MARKER);
  if (startIdx === -1) return null;
  const rest = html.slice(startIdx + SCRIPT_MARKER.length);
  const endIdx = rest.indexOf("</script>");
  if (endIdx === -1) return null;
  return rest.slice(0, endIdx);
}

/** Lädt die neuesten Neuigkeiten. Wirft bei Netzwerk-/Parsingfehlern. */
export async function getNews(limit = 6) {
  const response = await fetch(NEWS_PAGE_URL);
  if (!response.ok) {
    throw new Error(`Neuigkeiten-Seite antwortete mit Fehler (${response.status})`);
  }
  const html = await response.text();

  const payload = extractInertiaPayload(html);
  if (!payload) {
    throw new Error("Konnte eingebettete Seitendaten nicht finden (hat sich die Webseite geändert?)");
  }

  const data = JSON.parse(payload);
  const items = data?.props?.newses?.data;
  if (!Array.isArray(items)) {
    throw new Error("Keine Neuigkeiten-Liste in den Seitendaten gefunden");
  }

  return items.slice(0, limit).map((item) => ({
    id: item.id ?? 0,
    title: item.title,
    slug: item.slug,
    url: `https://erzmark.de/news/${item.slug}`,
    publishedAt: item.published_at ?? null,
    isPinned: Boolean(item.is_pinned),
    excerpt: stripHtml(item.body_html_small),
    authorName: item.creator?.name ?? "Erzmark-Team",
    photoUrl: item.photo_url ?? null,
  }));
}
