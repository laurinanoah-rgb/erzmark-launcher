import Echo from "laravel-echo";
import Pusher from "pusher-js";

// Realtime-Gildenchat (26.07.2026): Reverb selbst laeuft bereits seit
// 09.07.2026 auf dem Server (REVERB_APP_KEY unten ist ein oeffentlicher
// Client-Key, kein Secret - analog zum Pusher-App-Key-Modell), Apache
// proxied den Websocket-Pfad "/app/" unter der normalen HTTPS-Domain
// (siehe erzmark.de-le-ssl.conf), daher reicht Port 443/wss, kein
// zusaetzlicher Firewall-Port noetig.
const REVERB_APP_KEY = "0vo0owgfb1fazvkub285";
const REVERB_HOST = "erzmark.de";

let echoInstance = null;

/**
 * Ein einziger Echo-Client pro eingeloggtem Konto - der Sanctum-Token wird
 * als fixer Bearer-Header mitgegeben (kein Session-Cookie, siehe
 * routes/api.php::/broadcasting/auth auf dem Server), deshalb muss bei
 * Konto-/Token-Wechsel {@link disconnectEcho} + ein frischer
 * {@link getEcho}-Aufruf erfolgen, statt die Instanz weiterzuverwenden.
 *
 * `client` wird explizit als fertige Pusher-Instanz uebergeben statt Echo
 * `window.Pusher` raten zu lassen - React Native hat kein Browser-`window`
 * mit Pusher-Global, das ist der von Laravel Echo selbst empfohlene Weg fuer
 * Nicht-Browser-Umgebungen (siehe Echo-Doku "Client Side Installation").
 */
export function getEcho(token) {
  if (echoInstance) return echoInstance;

  const client = new Pusher(REVERB_APP_KEY, {
    wsHost: REVERB_HOST,
    wsPort: 443,
    wssPort: 443,
    forceTLS: true,
    enabledTransports: ["ws", "wss"],
    authEndpoint: `https://${REVERB_HOST}/api/app-api/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  });

  echoInstance = new Echo({ broadcaster: "reverb", client });

  return echoInstance;
}

export function disconnectEcho() {
  echoInstance?.disconnect();
  echoInstance = null;
}
