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
