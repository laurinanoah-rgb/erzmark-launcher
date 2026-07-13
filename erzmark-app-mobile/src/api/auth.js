import * as SecureStore from "expo-secure-store";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { apiRequest } from "./client";

// Notwendig, damit ein offener Login-Browser-Tab nach dem Redirect zurück
// in die App sauber geschlossen/aufgelöst wird.
WebBrowser.maybeCompleteAuthSession();

// ---- Mehrere-Konten-Speicher ----
// Jedes Konto: { accountUuid, username, msRefreshToken, sanctumToken,
// activeProfileUuid }. SecureStore kennt nur flache String-Werte, deshalb
// liegt die ganze Liste als EIN JSON-Array unter einem Key - nicht ideal für
// sehr viele Konten, aber für die realistische Handvoll pro Spieler völlig
// ausreichend.
const ACCOUNTS_KEY = "erzmark_accounts";
const ACTIVE_ACCOUNT_KEY = "erzmark_active_account_uuid";

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

// WICHTIG: `erzmark://auth` funktioniert nur in einem Dev-Client- oder
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
 *
 * Fügt das eingeloggte Konto der Konten-Liste hinzu (oder aktualisiert es,
 * falls es schon existiert) und macht es zum aktiven Konto - dieselbe
 * Funktion dient also sowohl für den allerersten Login (LoginScreen.jsx)
 * als auch für "Konto hinzufügen" (SettingsScreen.jsx), der Unterschied
 * ist nur, ob am Ende schon ein anderes Konto in der Liste stand.
 */
export async function loginWithMinecraft() {
  const msTokens = await runMicrosoftLogin();
  const { mcAccessToken, profile } = await completeMinecraftLogin(msTokens.accessToken);
  const sanctumToken = await exchangeForSanctumToken(mcAccessToken);

  const accounts = await getAccounts();
  const existing = accounts.find((a) => a.accountUuid === profile.id);
  const account = {
    accountUuid: profile.id,
    username: profile.name,
    msRefreshToken: msTokens.refreshToken,
    sanctumToken,
    activeProfileUuid: existing?.activeProfileUuid ?? null,
  };
  await saveAccounts(
    existing
      ? accounts.map((a) => (a.accountUuid === profile.id ? account : a))
      : [...accounts, account]
  );
  await setActiveAccountUuid(profile.id);

  return { token: sanctumToken, activeProfileUuid: account.activeProfileUuid };
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
    // Ohne das hier haelt der System-Browser die Microsoft-Session vom
    // letzten Login fest - ein erneuter Login-Versuch meldet dann OHNE
    // Rueckfrage automatisch mit demselben Konto an, es gibt keinen Weg
    // zurueck zum Kontoauswahl-Dialog (Bug-Report: "kann sich nicht mehr
    // abmelden, um ein anderes Microsoft-/Xbox-Konto zu verwenden").
    // `select_account` erzwingt den Kontoauswahl-Dialog bei JEDEM
    // interaktiven Login, egal welche Session der Browser noch hat -
    // Voraussetzung dafuer, dass "Konto hinzufuegen" (unten) ueberhaupt ein
    // ANDERES Konto anbieten kann statt automatisch das alte zu nehmen.
    extraParams: { prompt: "select_account" },
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

/**
 * Schritte 2-5 der Auth-Chain (Xbox Live -> XSTS -> Minecraft -> Profil).
 * Liefert neben dem Minecraft-Access-Token auch das Mojang-Profil ({id,
 * name}) zurück - `id` ist die rohe Account-UUID (für friends.php & Co.,
 * siehe getAccountUuid()), `name` der Minecraft-Name (Anzeige in der
 * Konten-Liste).
 */
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

  return { mcAccessToken, profile };
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

// ---- Konten-Liste: interne Speicher-Helfer ----

async function getAccounts() {
  const raw = await SecureStore.getItemAsync(ACCOUNTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveAccounts(accounts) {
  await SecureStore.setItemAsync(ACCOUNTS_KEY, JSON.stringify(accounts));
}

async function updateAccount(uuid, patch) {
  const accounts = await getAccounts();
  await saveAccounts(accounts.map((a) => (a.accountUuid === uuid ? { ...a, ...patch } : a)));
}

async function setActiveAccountUuid(uuid) {
  if (uuid) {
    await SecureStore.setItemAsync(ACTIVE_ACCOUNT_KEY, uuid);
  } else {
    await SecureStore.deleteItemAsync(ACTIVE_ACCOUNT_KEY);
  }
}

async function getActiveAccountUuid() {
  return SecureStore.getItemAsync(ACTIVE_ACCOUNT_KEY);
}

async function getActiveAccount() {
  const uuid = await getActiveAccountUuid();
  if (!uuid) return null;
  const accounts = await getAccounts();
  return accounts.find((a) => a.accountUuid === uuid) ?? null;
}

// ---- Konten-Liste: öffentliche API fürs Einstellungen-Menü ----

/** Für den Konten-Umschalter in SettingsScreen.jsx - ohne Tokens, nur Anzeigedaten. */
export async function listAccounts() {
  const [accounts, activeUuid] = await Promise.all([getAccounts(), getActiveAccountUuid()]);
  return accounts.map((a) => ({
    accountUuid: a.accountUuid,
    username: a.username,
    isActive: a.accountUuid === activeUuid,
  }));
}

/**
 * Wechselt das aktive Konto. Erneuert dabei sicherheitshalber den
 * Sanctum-Token über den gespeicherten Microsoft-Refresh-Token (könnte
 * abgelaufen sein, seit dieses Konto zuletzt aktiv war) - schlägt das fehl
 * (z.B. kurzer Netzwerkhänger), wird trotzdem mit dem zuletzt bekannten
 * Token gewechselt, statt den Nutzer auszusperren.
 */
export async function switchAccount(uuid) {
  const accounts = await getAccounts();
  const target = accounts.find((a) => a.accountUuid === uuid);
  if (!target) {
    throw new Error("Konto nicht gefunden.");
  }

  await setActiveAccountUuid(uuid);

  try {
    const msTokens = await refreshMicrosoftToken(target.msRefreshToken);
    const { mcAccessToken } = await completeMinecraftLogin(msTokens.accessToken);
    const sanctumToken = await exchangeForSanctumToken(mcAccessToken);
    await updateAccount(uuid, { msRefreshToken: msTokens.refreshToken, sanctumToken });
    return { token: sanctumToken, activeProfileUuid: target.activeProfileUuid };
  } catch {
    return { token: target.sanctumToken, activeProfileUuid: target.activeProfileUuid };
  }
}

/**
 * Entfernt ein Konto komplett aus der Liste. Betrifft das GERADE aktive
 * Konto, wird - falls noch andere Konten übrig sind - automatisch zum
 * ersten verbleibenden gewechselt (Rückgabewert dann dessen {token,
 * activeProfileUuid}), sonst `null` (zurück zum Login-Screen). Wird ein
 * NICHT-aktives Konto entfernt, ändert sich am aktiven Zustand nichts,
 * Rückgabewert ist dann `null` (nichts zu tun für den Aufrufer).
 */
export async function removeAccount(uuid) {
  const [accounts, activeUuid] = await Promise.all([getAccounts(), getActiveAccountUuid()]);
  const remaining = accounts.filter((a) => a.accountUuid !== uuid);
  await saveAccounts(remaining);

  if (uuid !== activeUuid) {
    return null;
  }

  if (remaining.length === 0) {
    await setActiveAccountUuid(null);
    return null;
  }

  const next = remaining[0];
  await setActiveAccountUuid(next.accountUuid);
  return { token: next.sanctumToken, activeProfileUuid: next.activeProfileUuid };
}

/** Meldet das AKTIVE Konto ab (siehe removeAccount) - Name bewusst beibehalten, wird an vielen Stellen als "Abmelden"-Aktion aufgerufen. */
export async function logout() {
  const activeUuid = await getActiveAccountUuid();
  if (!activeUuid) return null;
  return removeAccount(activeUuid);
}

/**
 * Stiller Auto-Login beim App-Start für das aktive Konto (analog zum
 * Desktop-Launcher, siehe ms_oauth.rs::refresh). Ist der gespeicherte
 * Microsoft-Refresh-Token nicht mehr gültig, wird dieses eine Konto
 * entfernt (siehe removeAccount) und - falls vorhanden - automatisch zum
 * nächsten verbleibenden wird gewechselt; dessen Token wird dabei NICHT
 * zusätzlich validiert (bewusst einfach gehalten, ein ungültiges
 * Zweit-Konto fällt dann eben beim nächsten API-Call auf statt schon hier).
 */
export async function tryRefreshLogin() {
  const active = await getActiveAccount();
  if (!active) return null;

  try {
    const msTokens = await refreshMicrosoftToken(active.msRefreshToken);
    const { mcAccessToken } = await completeMinecraftLogin(msTokens.accessToken);
    const sanctumToken = await exchangeForSanctumToken(mcAccessToken);
    await updateAccount(active.accountUuid, { msRefreshToken: msTokens.refreshToken, sanctumToken });
    return { token: sanctumToken, activeProfileUuid: active.activeProfileUuid };
  } catch {
    return removeAccount(active.accountUuid);
  }
}

// ---- Aktives Konto: einfache Abfragen für die restliche App ----
// (Namen bewusst beibehalten, obwohl intern jetzt über die Konten-Liste
// gelesen wird - so bleiben HomeScreen.jsx/GuildListScreen.jsx/etc. unverändert.)

export async function getStoredToken() {
  const active = await getActiveAccount();
  return active?.sanctumToken ?? null;
}

/** Rohe Minecraft-Account-UUID (Mojang-Account, nicht MMOProfiles) des aktiven Kontos - für friends.php & Co. */
export async function getAccountUuid() {
  const active = await getActiveAccount();
  return active?.accountUuid ?? null;
}

// ---- Aktives MMOProfiles-Profil (pro Konto!) ----
// (siehe Task #51/#82: MMOProfiles vergibt pro Charakter-Profil eine eigene
// UUID, deshalb muss der Spieler explizit wählen, welches Profil gerade
// "er" ist - kein automatisches Erraten. Jetzt pro Konto gespeichert, da
// jedes Microsoft-Konto sein eigenes Minecraft-Konto mit eigenen Profilen hat.)

export async function getActiveProfileUuid() {
  const active = await getActiveAccount();
  return active?.activeProfileUuid ?? null;
}

export async function storeActiveProfileUuid(uuid) {
  const activeUuid = await getActiveAccountUuid();
  if (!activeUuid) return;
  await updateAccount(activeUuid, { activeProfileUuid: uuid });
}

export async function clearActiveProfileUuid() {
  const activeUuid = await getActiveAccountUuid();
  if (!activeUuid) return;
  await updateAccount(activeUuid, { activeProfileUuid: null });
}
