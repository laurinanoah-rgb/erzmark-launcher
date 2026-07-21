import { invoke } from "@tauri-apps/api/core";

// Ersetzt die fruehere Mock-Version (siehe Launcher-Update-TODO, Abschnitt 4,
// Teil 3) durch echte Calls gegen die neuen app-api/friend-requests-
// Endpunkte (social_commands.rs -> social.rs -> Laravel). Format ist
// bewusst 1:1 kompatibel zur alten Mock-API geblieben, daher brauchen
// NotificationsContext.jsx/NotificationBell.jsx/FriendsList.jsx keine
// Aenderungen.
//
// Der Server kennt nur pending/accepted/declined fuer eine Anfrage, keinen
// "gelesen"-Zustand (das ist rein ein Launcher-UI-Konzept fuer die Glocke) -
// welche IDs schon "gesehen" wurden, wird daher lokal in localStorage
// gemerkt, gleiches Muster wie App.jsx (SEEN_VIDEO_KEY).
const SEEN_IDS_KEY = "erzmark_seen_notification_ids";

function loadSeenIds() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SEEN_IDS_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveSeenIds(seenIds) {
  window.localStorage.setItem(SEEN_IDS_KEY, JSON.stringify([...seenIds]));
}

function toNotification(entry, seenIds) {
  const id = String(entry.id);
  return {
    id,
    type: "friend_request",
    createdAt: entry.requestedAt ? new Date(entry.requestedAt).getTime() : Date.now(),
    read: seenIds.has(id),
    title: "Neue Freundschaftsanfrage",
    body: "möchte mit dir befreundet sein.",
    data: {
      requesterUuid: entry.requesterUuid,
      requesterName: entry.requesterName,
      status: entry.status,
    },
  };
}

async function loadNotifications(seenIds) {
  const entries = await invoke("get_friend_requests");
  return entries.map((e) => toNotification(e, seenIds));
}

export async function fetchNotifications() {
  return loadNotifications(loadSeenIds());
}

export async function markAllNotificationsRead() {
  const seenIds = loadSeenIds();
  const notifications = await loadNotifications(seenIds);
  notifications.forEach((n) => seenIds.add(n.id));
  saveSeenIds(seenIds);
  return notifications.map((n) => ({ ...n, read: true }));
}

export async function respondToFriendRequest(id, accept) {
  await invoke("respond_friend_request", { id: Number(id), accept });
  return loadNotifications(loadSeenIds());
}
