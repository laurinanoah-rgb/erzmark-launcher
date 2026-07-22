import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { getFriendRequests, respondFriendRequest as respondFriendRequestApi } from "../api/notifications";
import { getStoredToken } from "../api/auth";

// Gleiches Prinzip wie im Desktop-Launcher (src/state/NotificationsContext.jsx
// im Projekt-Root): gemeinsamer State für Glocke + Freunde-Screen, alle 20s
// neu abgefragt, "gelesen"-Zustand ist reines App-UI-Konzept (der Server
// kennt nur pending/accepted/declined) und wird lokal gemerkt - hier per
// SecureStore statt localStorage, sonst identisches Muster.
const NotificationsContext = createContext(null);
const AUTO_REFRESH_MS = 20 * 1000;
const SEEN_IDS_KEY = "erzmark_seen_notification_ids";

async function loadSeenIds() {
  try {
    const raw = await SecureStore.getItemAsync(SEEN_IDS_KEY);
    return new Set(JSON.parse(raw ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveSeenIds(seenIds) {
  SecureStore.setItemAsync(SEEN_IDS_KEY, JSON.stringify([...seenIds])).catch(() => {});
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

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    const token = await getStoredToken();
    if (!token) {
      setNotifications([]);
      return;
    }
    try {
      const entries = await getFriendRequests(token);
      const seenIds = await loadSeenIds();
      setNotifications(entries.map((e) => toNotification(e, seenIds)));
    } catch {
      // Netzwerkfehler o.ä. - letzten bekannten Stand einfach behalten,
      // naechster 20s-Tick versucht es erneut.
    }
  }, []);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, AUTO_REFRESH_MS);
    return () => clearInterval(timerRef.current);
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const seenIds = await loadSeenIds();
    setNotifications((prev) => {
      const updated = prev.map((n) => {
        seenIds.add(n.id);
        return { ...n, read: true };
      });
      saveSeenIds(seenIds);
      return updated;
    });
  }, []);

  const respondFriendRequest = useCallback(
    async (id, accept) => {
      const token = await getStoredToken();
      if (!token) return;
      await respondFriendRequestApi(token, Number(id), accept);
      await refresh();
    },
    [refresh]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;
  const friendRequests = notifications.filter((n) => n.type === "friend_request" && n.data?.status === "pending");

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, friendRequests, markAllRead, respondFriendRequest }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications muss innerhalb von <NotificationsProvider> verwendet werden.");
  return ctx;
}
