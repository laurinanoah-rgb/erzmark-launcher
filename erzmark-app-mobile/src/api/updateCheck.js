import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiRequest } from "./client";

/**
 * Zwei-stufiger Update-Check, analog zum Launcher-Update-Flow:
 *
 * 1. `minimumVersion` von erzmark.de abfragen. Ist die installierte Version
 *    kleiner, MUSS über den Store aktualisiert werden (native Änderungen,
 *    z.B. neue Permissions/Module) -> `type: "store"`.
 * 2. Sonst: über expo-updates prüfen, ob ein neues OTA-JS-Bundle bereitsteht
 *    (reine UI-/Logik-Änderungen, kein Store-Review nötig) -> `type: "ota"`.
 *
 * Rückgabe `null`, wenn kein Update verfügbar ist.
 */
export async function checkForAppUpdate() {
  const installedVersion = Constants.expoConfig?.version ?? "0.0.0";

  const { minimumVersion, storeUrl } = await apiRequest(`/version?platform=${Platform.OS}`);
  if (isVersionLower(installedVersion, minimumVersion)) {
    return { type: "store", storeUrl };
  }

  if (!__DEV__) {
    const otaResult = await Updates.checkForUpdateAsync();
    if (otaResult.isAvailable) {
      return { type: "ota" };
    }
  }

  return null;
}

export async function applyOtaUpdate() {
  await Updates.fetchUpdateAsync();
  await Updates.reloadAsync();
}

function isVersionLower(current, minimum) {
  const c = current.split(".").map(Number);
  const m = minimum.split(".").map(Number);
  for (let i = 0; i < Math.max(c.length, m.length); i++) {
    const a = c[i] ?? 0;
    const b = m[i] ?? 0;
    if (a < b) return true;
    if (a > b) return false;
  }
  return false;
}
