import { apiRequest, apiUpload } from "./client";

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

// ---- Profilbild/Titelbild (19.07.2026) ----
// Getrennt vom automatischen Minecraft-Skin-Avatar (der kommt weiterhin
// direkt von Crafatar, siehe ProfileScreen.jsx) - hochladbares, eigenes
// Bild pro Charakterprofil. `profileUuid` bestimmt WELCHES Profil (ein
// Account kann mehrere MMOProfiles-Charaktere haben), server-seitig gegen
// den eingeloggten Account geprueft (siehe ProfileController::
// resolveOwnProfile()).
function assetToProfileFormData(fieldName, profileUuid, asset) {
  const formData = new FormData();
  formData.append("profile_uuid", profileUuid);
  formData.append(fieldName, {
    uri: asset.uri,
    name: asset.fileName ?? `${fieldName}.jpg`,
    type: asset.mimeType ?? "image/jpeg",
  });
  return formData;
}

export function uploadProfilePhoto(token, profileUuid, asset) {
  return apiUpload("/profiles/photo", { token, formData: assetToProfileFormData("photo", profileUuid, asset) });
}

export function removeProfilePhoto(token, profileUuid) {
  return apiRequest("/profiles/photo", { method: "DELETE", token, body: { profile_uuid: profileUuid } });
}

export function uploadProfileCover(token, profileUuid, asset) {
  return apiUpload("/profiles/cover", { token, formData: assetToProfileFormData("cover", profileUuid, asset) });
}

export function removeProfileCover(token, profileUuid) {
  return apiRequest("/profiles/cover", { method: "DELETE", token, body: { profile_uuid: profileUuid } });
}
