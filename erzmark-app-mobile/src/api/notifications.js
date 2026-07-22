import { apiRequest } from "./client";

// Freundschaftsanfragen-Endpunkte - dieselben wie im Desktop-Launcher (siehe
// src-tauri/src/social.rs im Projekt-Root), hier per apiRequest() (Sanctum-
// Bearer-Token, den die App beim Login schon holt, siehe auth.js).

export function getFriendRequests(token) {
  return apiRequest("/friend-requests", { token });
}

export function respondFriendRequest(token, id, accept) {
  return apiRequest(`/friend-requests/${id}/respond`, {
    method: "POST",
    token,
    body: { action: accept ? "accept" : "decline" },
  });
}
