import { apiRequest } from "./client";

/**
 * "Connect"-Feature (Bedrock-Konsolen via DNS-Redirect, siehe ConnectScreen.jsx):
 * der eigentliche DNS-Override + RakNet-Transfer-Stub läuft zentral auf dem
 * Erzmark-Server, dauerhaft für alle Spieler (nicht auf dem Telefon/im LAN -
 * Konsolen können jede erreichbare IP als DNS-Server eintragen; ein lokaler
 * Host auf dem Handy wäre auf Android nur mit Root und auf iOS praktisch gar
 * nicht möglich). `start`/`stop` schalten den gemeinsamen Dienst NICHT ein/aus
 * (ein einzelner Spieler darf ihn nicht für alle anderen abschalten) - beide
 * liefern denselben echten Health-Check wie `status`, damit der Button in
 * ConnectScreen.jsx trotzdem den tatsächlichen Dienststatus widerspiegelt
 * (fällt bei Nichterreichbarkeit zurück in den grünen Ruhezustand). Siehe
 * PLANNING.md ("Connect"-Feature) für den vollen Backend-Plan - Backend selbst
 * ist noch nicht deployed (offene Kaufentscheidung: zweite Server-IP, da Port
 * 19132 der ersten IP schon vom echten Bedrock-Server belegt ist).
 */

/** @returns {Promise<{active: boolean, dnsHost: string, expiresAt: string|null}>} */
export function getConnectStatus(token) {
  return apiRequest("/connect/status", { token });
}

/** @returns {Promise<{active: boolean, dnsHost: string, expiresAt: string|null}>} */
export function startConnect(token) {
  return apiRequest("/connect/start", { method: "POST", token });
}

/** @returns {Promise<{active: boolean, dnsHost: string, expiresAt: string|null}>} */
export function stopConnect(token) {
  return apiRequest("/connect/stop", { method: "POST", token });
}
