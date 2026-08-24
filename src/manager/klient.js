/**
 * Zugang zum Manager-Agent (R.U.D.O.L.F.s Kern).
 *
 * Die Oberflaeche kennt genau zwei Wege nach draussen: die Anmelderouten und
 * `/v1/execute`. Es gibt hier absichtlich keine Funktion je Modul - der
 * Operationskatalog ist die einzige Stelle, an der Aktionen entstehen, und das
 * soll man dem Klienten ansehen.
 *
 * Ausgeblendete Knoepfe sind Bequemlichkeit, keine Sicherheit: Der Agent prueft
 * jede Berechtigung selbst, bei jedem Aufruf. Was diese Datei an Rechten weiss,
 * dient allein der Darstellung.
 *
 * WICHTIG: Die Anmeldung hier ist NICHT der Microsoft-Login des Launchers. Der
 * Manager prueft gegen die Erzmark-Identitaet auf erzmark.de - dieselben
 * Zugangsdaten wie fuer die Webseite, inklusive des dortigen zweiten Faktors.
 */

/**
 * Wohin der Agent antwortet.
 *
 * In Tauri laeuft die Oberflaeche unter einem eigenen Schema, relative Pfade
 * gehen deshalb ins Leere. Beim Entwickeln zeigt VITE_MANAGER_URL auf einen
 * SSH-Tunnel:  ssh -L 8710:127.0.0.1:8710 root@162.55.27.161
 */
export const BASIS =
  import.meta.env?.VITE_MANAGER_URL?.replace(/\/+$/, '') || 'https://manager.erzmark.de';

const SPEICHER_SCHLUESSEL = 'erzmark-manager-sitzung';

export class ApiFehler extends Error {
  constructor(message, code, status, extra) {
    super(message);
    this.name = 'ApiFehler';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

/** Der Aufrufer muss den zweiten Faktor frisch bestaetigen. */
export class StepUpNoetig extends ApiFehler {
  constructor(message) {
    super(message, 'step_up_erforderlich', 428);
    this.name = 'StepUpNoetig';
  }
}

/** Die Aktion verlangt eine ausdrueckliche zweite Bestaetigung. */
export class BestaetigungNoetig extends ApiFehler {
  constructor(message) {
    super(message, 'bestaetigung_erforderlich', 428);
    this.name = 'BestaetigungNoetig';
  }
}

/**
 * Die Rolle des Aufrufers braucht fuer diesen Schreibvorgang eine Freigabe (3.8).
 *
 * Kein Fehler im eigentlichen Sinn - der Vorschlag wurde angelegt, es hat nur
 * (noch) nicht gewirkt. Als eigene Klasse, damit Aufrufer das gezielt von
 * echten Fehlern unterscheiden koennen, genau wie bei StepUpNoetig.
 */
export class AenderungVorgeschlagen extends Error {
  constructor(changeRequestId) {
    super('Diese Rolle braucht für diese Änderung eine Freigabe - der Vorschlag wurde eingereicht.');
    this.name = 'AenderungVorgeschlagen';
    this.changeRequestId = changeRequestId;
  }
}

let sitzung = null;

function setzeSitzung(neu) {
  sitzung = neu;
  if (neu) {
    // sessionStorage statt localStorage: Der Token ueberlebt das Schliessen des
    // Fensters nicht. Auf einem geteilten Rechner ist das der Unterschied
    // zwischen "abgemeldet" und "immer noch drin".
    sessionStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(neu));
  } else {
    sessionStorage.removeItem(SPEICHER_SCHLUESSEL);
  }
}

export function aktuelleSitzung() {
  if (sitzung) return sitzung;
  const roh = sessionStorage.getItem(SPEICHER_SCHLUESSEL);
  if (!roh) return null;
  try {
    sitzung = JSON.parse(roh);
    return sitzung;
  } catch {
    sessionStorage.removeItem(SPEICHER_SCHLUESSEL);
    return null;
  }
}

async function auswerten(antwort) {
  const text = await antwort.text();
  const daten = text ? JSON.parse(text) : {};

  if (antwort.ok) return daten;

  const code = String(daten.error ?? 'fehlgeschlagen');
  const meldung = String(daten.message ?? `HTTP ${antwort.status}`);

  if (code === 'step_up_erforderlich') throw new StepUpNoetig(meldung);
  if (code === 'bestaetigung_erforderlich') throw new BestaetigungNoetig(meldung);
  throw new ApiFehler(meldung, code, antwort.status, daten);
}

async function roh(pfad, body, token) {
  const kopf = { 'Content-Type': 'application/json', 'X-Erzmark-Client': 'launcher' };
  if (token) kopf.Authorization = `Bearer ${token}`;

  const antwort = await fetch(BASIS + pfad, {
    method: 'POST',
    headers: kopf,
    body: JSON.stringify(body),
  });
  return auswerten(antwort);
}

// --- Anmeldung -------------------------------------------------------------

export async function anmelden(kennung, passwort) {
  const daten = await roh('/v1/auth/login', {
    identifier: kennung,
    password: passwort,
    deviceLabel: 'Erzmark Launcher',
  });

  return {
    challengeToken: String(daten.challengeToken),
    displayName: String(daten.displayName ?? kennung),
    rollen: daten.rollen ?? [],
    expiresInSeconds: Number(daten.expiresInSeconds ?? 300),
  };
}

export async function codeBestaetigen(challengeToken, code) {
  const daten = await roh('/v1/auth/totp', { challengeToken, code });

  const neu = {
    accessToken: String(daten.accessToken),
    refreshToken: String(daten.refreshToken),
    accessExpiresAt: String(daten.accessExpiresAt),
    displayName: String(daten.displayName ?? ''),
  };
  setzeSitzung(neu);

  return daten.recoveryCodes
    ? { sitzung: neu, recoveryCodes: daten.recoveryCodes }
    : { sitzung: neu };
}

export async function stepUp(code) {
  const s = aktuelleSitzung();
  if (!s) throw new ApiFehler('Nicht angemeldet.', 'nicht_angemeldet', 401);
  await roh('/v1/auth/stepup', { code }, s.accessToken);
}

export async function abmelden() {
  const s = aktuelleSitzung();
  if (s) await roh('/v1/auth/logout', {}, s.accessToken).catch(() => undefined);
  setzeSitzung(null);
}

async function erneuern() {
  const s = aktuelleSitzung();
  if (!s) return false;
  try {
    const daten = await roh('/v1/auth/refresh', { refreshToken: s.refreshToken });
    setzeSitzung({
      ...s,
      accessToken: String(daten.accessToken),
      refreshToken: String(daten.refreshToken),
      accessExpiresAt: String(daten.accessExpiresAt),
    });
    return true;
  } catch {
    setzeSitzung(null);
    return false;
  }
}

// --- Operationen -----------------------------------------------------------

/**
 * Eine Operation ausfuehren.
 *
 * Laeuft der Zugriffstoken ab, wird einmal erneuert und der Aufruf wiederholt.
 * Schlaegt auch das fehl, endet die Sitzung - stillschweigend weiterzumachen
 * waere schlimmer, als den Login zu verlangen.
 */
export async function ausfuehren(operation, params = {}, optionen = {}) {
  const s = aktuelleSitzung();
  if (!s) throw new ApiFehler('Nicht angemeldet.', 'nicht_angemeldet', 401);

  const rumpf = { operation, params };
  if (optionen.bestaetigt) rumpf.confirmed = true;

  const versuch = (token) =>
    fetch(BASIS + '/v1/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Erzmark-Client': 'launcher',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(rumpf),
    });

  let antwort = await versuch(s.accessToken);

  if (antwort.status === 401 && (await erneuern())) {
    antwort = await versuch(aktuelleSitzung().accessToken);
  }

  const daten = await auswerten(antwort);
  if (daten.pendingChangeRequestId !== undefined) {
    throw new AenderungVorgeschlagen(daten.pendingChangeRequestId);
  }
  return daten.result;
}

/** Erreichbarkeit pruefen, ohne eine Sitzung zu brauchen. */
export async function erreichbar() {
  try {
    const antwort = await fetch(BASIS + '/health', { method: 'GET' });
    return antwort.ok;
  } catch {
    return false;
  }
}
