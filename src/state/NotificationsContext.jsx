import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchNotifications, markAllNotificationsRead, respondToFriendRequest } from "../api/notifications.js";

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchNotifications().then(setNotifications);
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
