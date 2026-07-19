// Zentraler API-Client für die Erzmark-App. Spricht dieselbe erzmark.de-API
// wie der Desktop-Launcher an, über einen eigenen `app-api`-Namespace
// (getrennt von den Launcher-Endpunkten unter `erzmark.de/launcher/...`).
// Läuft über MineTrax/Laravel - `routes/api.php` wird von Laravel
// automatisch mit `/api` prefixed, daher `/api/app-api/...` und NICHT nur
// `/app-api/...` (live gegen den Server verifiziert, siehe
// GuildController.php auf dem Server).
const BASE_URL = "https://erzmark.de/api/app-api";

/**
 * @param {string} path z.B. "/guilds"
 * @param {{ method?: string, token?: string, body?: object }} options
 */
export async function apiRequest(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API-Fehler ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

/**
 * Wie `apiRequest`, aber für Datei-Uploads (multipart/form-data) - z.B.
 * Gilden-Titelbild/Logo (19.07.2026). Bewusst OHNE `Content-Type`-Header:
 * `fetch` setzt ihn bei einem `FormData`-Body selbst inkl. der nötigen
 * `boundary`, ein manuell gesetzter `multipart/form-data`-Header ohne
 * Boundary würde der Server nicht parsen können.
 * @param {string} path z.B. "/guild/banner"
 * @param {{ method?: string, token?: string, formData: FormData }} options
 */
export async function apiUpload(path, { method = "POST", token, formData }) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, { method, headers, body: formData });

  if (!response.ok) {
    throw new Error(`API-Fehler ${response.status}: ${await response.text()}`);
  }
  return response.json();
}
