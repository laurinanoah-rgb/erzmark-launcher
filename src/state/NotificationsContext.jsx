import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { fetchNotifications, markAllNotificationsRead, respondToFriendRequest } from "../api/notifications.js";

const NotificationsContext = createContext(null);

// Nutzerwunsch (21.07.2026): Freundschaftsanfragen sollen auch ankommen,
// waehrend der Launcher schon offen ist, nicht erst nach einem Neustart -
// daher regelmaessig neu abrufen, waehrend der Launcher laeuft (gleiches
// Muster wie FriendsList.jsx).
const AUTO_REFRESH_MS = 20 * 1000;

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchNotifications().then(setNotifications);
    timerRef.current = window.setInterval(() => {
      fetchNotifications().then(setNotifications);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timerRef.current);
  }, []);

  const markAllRead = useCallback(() => {
    markAllNotificationsRead().then(setNotifications);
  }, []);

  const respondFriendRequest = useCallback((id, accept) => {
    respondToFriendRequest(id, accept).then(setNotifications);
  }, []);

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
