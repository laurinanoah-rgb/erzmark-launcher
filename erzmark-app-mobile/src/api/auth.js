import * as SecureStore from "expo-secure-store";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { apiRequest } from "./client";

// Notwendig, damit ein offener Login-Browser-Tab nach dem Redirect zurück
// in die App sauber geschlossen/aufgelöst wird.
WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "erzmark_minecraft_token";
const MS_REFRESH_TOKEN_KEY = "erzmark_ms_refresh_token";
const ACTIVE_PROFILE_KEY = "erzmark_active_profile_uuid";
const ACCOUNT_UUID_KEY = "erzmark_account_uuid";

// Exakt dieselben Werte wie im Desktop-Launcher (src-tauri/src/config.rs).
// Der Client ist bei Microsoft als "public client" (Authorization Code +
// PKCE, kein Secret) registriert und wird von Desktop UND Mobile gemeinsam
// genutzt. Für Mobile muss zusätzlich `erzmark://auth` als Redirect-URI
// unter "Mobile and desktop applications" in der Azure-App-Registrierung
// hinterlegt sein (siehe app.json -> "scheme": "erzmark").
const MS_CLIENT_ID = "980ac0c7-7165-4a8b-8685-8eb070bacb46";
const MS_AUTHORIZE_ENDPOINT = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const MS_TOKEN_ENDPOINT = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const MS_SCOPES = ["XboxLive.signin", "offline_access"];

const XBOX_AUTH_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN_URL = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_ENTITLEMENTS_URL = "https://api.minecraftservices.com/entitlements/mcstore";
const MC_PROFILE_URL = "https://api.minecraftservices.com/minecraft/profile";

const discovery = {
  authorizationEndpoint: MS_AUTHORIZE_ENDPOINT,
  tokenEndpoint: MS_TOKEN_ENDPOINT,
};

// WICHTIG: `erzmark://auth` funktioniert nur in einem Dev-Client-/
// Standalone-Build (`npx expo run:android` oder ein EAS-Build), NICHT in
// der normalen Expo-Go-App - Expo Go kann keine fremden Custom-URL-Schemes
// für den Redirect abfangen (der frühere auth.expo.io-Proxy für Expo Go
// wurde von Expo eingestellt).
const redirectUri = AuthSession.makeRedirectUri({ scheme: "erzmark", path: "auth" });

/**
 * Kompletter Login-Flow, exakt wie im Desktop-Launcher (siehe
 * src-tauri/src/auth/{ms_oauth,xbox,minecraft}.rs als Vorlage):
 *   1. Microsoft OAuth2 (Authorization Code + PKCE) über den System-Browser
 *   2. Xbox Live Auth
 *   3. XSTS Autorisierung
 *   4. Minecraft-Login mit dem XSTS-Token
 *   5. Besitz-Check (entitlements) + Profil-Abruf (Existenz-Prüfung)
 *
 * Der fertig verifizierte Minecraft-Access-Token wird danach serverseitig
 * gegen einen echten Sanctum-API-Token getauscht (POST /app-api/auth/
 * minecraft) - auth:sanctum kennt den rohen Mojang-Token nicht, der Server
 * prüft ihn dabei sicherheitshalber noch einmal selbst gegen Mojang nach.
 * Rückgabewert ist dieser Sanctum-Token; er wird vom Aufrufer (LoginScreen)
 * per `storeToken` gespeichert und ist danach der Bearer-Token für alle
 * weiteren Erzmark-App-API-Aufrufe (siehe client.js).
 */
export async function loginWithMinecraft() {
  const msTokens = await runMicrosoftLogin();
  await storeMsRefreshToken(msTokens.refreshToken);
  const mcAccessToken = await completeMinecraftLogin(msTokens.accessToken);
  return exchangeForSanctumToken(mcAccessToken);
}

/**
 * Tauscht einen verifizierten Minecraft-Access-Token gegen einen
 * Erzmark-Sanctum-Token (siehe AppAuthController.php auf dem Server).
 */
async function exchangeForSanctumToken(mcAccessToken) {
  const result = await apiRequest("/auth/minecraft", {
    method: "POST",
    body: { access_token: mcAccessToken },
  });
  return result.access_token;
}

async function runMicrosoftLogin() {
  const request = new AuthSession.AuthRequest({
    clientId: MS_CLIENT_ID,
    scopes: MS_SCOPES,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });

  const result = await request.promptAsync(discovery);

  if (result.type === "cancel" || result.type === "dismiss") {
    throw new Error("Login abgebrochen.");
  }
  if (result.type === "error" || result.params?.error) {
    const desc = result.params?.error_description ?? result.error?.message ?? "";
    throw new Error(`Microsoft-Login abgelehnt: ${result.params?.error ?? ""} ${desc}`.trim());
  }
  if (result.type !== "success" || !result.params?.code) {
    throw new Error(`Microsoft-Login fehlgeschlagen (${result.type}).`);
  }

  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: MS_CLIENT_ID,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier },
    },
    discovery
  );

  return { accessToken: tokenResult.accessToken, refreshToken: tokenResult.refreshToken };
}

/** Erneuert das Microsoft-Token-Paar über den gespeicherten Refresh-Token. */
async function refreshMicrosoftToken(refreshToken) {
  const tokenResult = await AuthSession.refreshAsync(
    { clientId: MS_CLIENT_ID, refreshToken, scopes: MS_SCOPES },
    discovery
  );
  return {
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken ?? refreshToken,
  };
}

/** Schritte 2-5 der Auth-Chain (Xbox Live -> XSTS -> Minecraft -> Profil). */
async function completeMinecraftLogin(msAccessToken) {
  const xbl = await postJson(
    XBOX_AUTH_URL,
    {
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${msAccessToken}`,
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
    },
    "Xbox-Live-Authentifizierung"
  );

  const xsts = await postJson(
    XSTS_AUTH_URL,
    {
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [xbl.Token],
      },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    },
    "XSTS-Autorisierung",
    { isXsts: true }
  );

  const userHash = xsts.DisplayClaims?.xui?.[0]?.uhs;
  if (!userHash) {
    throw new Error("Kein User-Hash (uhs) in der XSTS-Antwort enthalten.");
  }

  const identityToken = `XBL3.0 x=${userHash};${xsts.Token}`;
  const mcLogin = await postJson(MC_LOGIN_URL, { identityToken }, "Minecraft-Login");
  const mcAccessToken = mcLogin.access_token;

  // Besitz-Check: wohlwollend, siehe minecraft.rs (owns_game) - bei
  // Netzwerk-/Serverfehlern nicht hart abbrechen, sondern erst beim
  // eigentlichen Profil-Abruf scheitern, falls wirklich kein Account
  // existiert.
  await checkOwnsGame(mcAccessToken);
  // Wirft, falls kein Minecraft-Account auf diesem Microsoft-Konto existiert.
  const profile = await fetchMinecraftProfile(mcAccessToken);
  // Rohe Account-UUID (nicht die MMOProfiles-Profil-UUID!) wird für die
  // öffentlichen Launcher-Endpunkte gebraucht (friends.php erwartet sie),
  // siehe getAccountUuid() unten.
  if (profile?.id) {
    await storeAccountUuid(profile.id);
  }

  return mcAccessToken;
}

async function postJson(url, body, label, { isXsts = false } = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  if (isXsts && response.status === 401) {
    const text = await response.text();
    throw new Error(
      `${label} abgelehnt (evtl. kein Xbox-Profil angelegt oder Kinderkonto ohne Freigabe): ${text}`
    );
  }
  if (!response.ok) {
    throw new Error(`${label} fehlgeschlagen: ${await response.text()}`);
  }
  return response.json();
}

async function checkOwnsGame(mcAccessToken) {
  try {
    await fetch(MC_ENTITLEMENTS_URL, {
      headers: { Authorization: `Bearer ${mcAccessToken}` },
    });
  } catch {
    // Netzwerkfehler hier bewusst ignorieren, siehe Kommentar oben.
  }
}

async function fetchMinecraftProfile(mcAccessToken) {
  const response = await fetch(MC_PROFILE_URL, {
    headers: { Authorization: `Bearer ${mcAccessToken}` },
  });
  if (!response.ok) {
    throw new Error(
      `Profil-Abruf fehlgeschlagen (kein Minecraft-Account auf diesem Microsoft-Konto?): ${await response.text()}`
    );
  }
  return response.json();
}

// ---- Minecraft-Token-Speicherung ----

export async function getStoredToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function storeToken(token) {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ---- Microsoft-Refresh-Token-Speicherung (für Auto-Login) ----

async function storeMsRefreshToken(refreshToken) {
  if (!refreshToken) return;
  return SecureStore.setItemAsync(MS_REFRESH_TOKEN_KEY, refreshToken);
}

async function getMsRefreshToken() {
  return SecureStore.getItemAsync(MS_REFRESH_TOKEN_KEY);
}

async function clearMsRefreshToken() {
  return SecureStore.deleteItemAsync(MS_REFRESH_TOKEN_KEY);
}

/**
 * Stiller Auto-Login beim App-Start über den gespeicherten
 * Microsoft-Refresh-Token (analog zum Desktop-Launcher, siehe
 * ms_oauth.rs::refresh). Liefert den neuen Minecraft-Token (und speichert
 * ihn) oder `null`, wenn kein Refresh-Token vorhanden bzw. nicht mehr
 * gültig ist - dann muss sich der Nutzer erneut interaktiv einloggen.
 */
export async function tryRefreshLogin() {
  const refreshToken = await getMsRefreshToken();
  if (!refreshToken) return null;

  try {
    const msTokens = await refreshMicrosoftToken(refreshToken);
    await storeMsRefreshToken(msTokens.refreshToken);
    const mcAccessToken = await completeMinecraftLogin(msTokens.accessToken);
    const sanctumToken = await exchangeForSanctumToken(mcAccessToken);
    await storeToken(sanctumToken);
    return sanctumToken;
  } catch {
    await clearMsRefreshToken();
    return null;
  }
}

// ---- Rohe Minecraft-Account-UUID (Mojang-Account, nicht MMOProfiles) ----
// Wird für die öffentlichen, read-only Launcher-Endpunkte gebraucht
// (friends.php erwartet die echte Account-UUID als Query-Parameter, siehe
// friends.rs im Desktop-Launcher als Vorlage).

async function storeAccountUuid(uuid) {
  return SecureStore.setItemAsync(ACCOUNT_UUID_KEY, uuid);
}

export async function getAccountUuid() {
  return SecureStore.getItemAsync(ACCOUNT_UUID_KEY);
}

async function clearAccountUuid() {
  return SecureStore.deleteItemAsync(ACCOUNT_UUID_KEY);
}

// ---- Aktives MMOProfiles-Profil ----
// (siehe Task #51/#82: MMOProfiles vergibt pro Charakter-Profil eine eigene
// UUID, deshalb muss der Spieler explizit wählen, welches Profil gerade
// "er" ist - kein automatisches Erraten).
export async function getActiveProfileUuid() {
  return SecureStore.getItemAsync(ACTIVE_PROFILE_KEY);
}

export async function storeActiveProfileUuid(uuid) {
  return SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, uuid);
}

export async function clearActiveProfileUuid() {
  return SecureStore.deleteItemAsync(ACTIVE_PROFILE_KEY);
}

// Kompletter Logout: Minecraft-Token, Microsoft-Refresh-Token UND
// Profil-Wahl zurücksetzen, damit man beim nächsten Start wieder ganz von
// vorne (Login) startet.
export async function logout() {
  await clearActiveProfileUuid();
  await clearToken();
  await clearMsRefreshToken();
  await clearAccountUuid();
}
