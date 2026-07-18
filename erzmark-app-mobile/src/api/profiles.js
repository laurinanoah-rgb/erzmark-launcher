import { apiRequest } from "./client";

// Listet alle MMOProfiles-Charakterprofile des eingeloggten Spielers auf.
// Hintergrund: MMOProfiles vergibt pro Profil eine eigene künstliche UUID
// (proxy_based_profiles), deshalb gibt es kein einzelnes "richtiges" UUID
// pro Account - der Spieler wählt aktiv, welches Profil er gerade nutzt
// (siehe PLANNING.md -> Profil-Auswahl, Task #82).
//
// Backend-Endpunkt (Laravel, /api/app-api/profiles/mine) liest
// mmoprofiles_playerdata und gruppiert nach Basis-Account - noch zu bauen,
// dies ist bereits die finale erwartete Antwortform:
// [{ uuid, name, className, lastPlayedAt }, ...]
export function getMyProfiles(token) {
  return apiRequest("/profiles/mine", { token });
}

// "Fehler melden"-Button (z.B. auf ProfileSelectScreen bei einem API-
// Fehler) - schickt dem Team eine Glocken-Benachrichtigung auf MineTrax
// mit den wichtigsten Details (siehe AppErrorReportController.php).
export function reportAppError(token, { message, context, appVersion, platform }) {
  return apiRequest("/error-reports", {
    method: "POST",
    token,
    body: { message, context, app_version: appVersion, platform },
  });
}
