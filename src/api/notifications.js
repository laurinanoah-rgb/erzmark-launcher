// Noch ohne echtes Backend (siehe Launcher-Update-TODO, Abschnitt 4 –
// MMOCore-Integration ist ein eigener, separater Schritt: MMOCore hält
// offene Freundschaftsanfragen nur ephemer im Chat, nicht persistent, daher
// braucht es dafür ein kleines Server-Plugin + einen neuen Laravel-Endpunkt.
// Diese Datei simuliert die künftige API 1:1 im selben Format, damit nur
// die Implementierung hier ersetzt werden muss, sobald Teil 2 steht.
//
// Format je Notification: { id, type: "friend_request" | "info", createdAt
// (unix ms), read, title, body, data? }. Bei "friend_request" enthält
// `data` { requesterUuid, requesterName, status: "pending"|"accepted"|"declined" }.

let mockNotifications = [
  {
    id: "n1",
    type: "friend_request",
    createdAt: Date.now() - 4 * 60 * 1000,
    read: false,
    title: "Neue Freundschaftsanfrage",
    body: "möchte mit dir befreundet sein.",
    data: { requesterUuid: "mock-uuid-1", requesterName: "Steelbrand", status: "pending" },
  },
  {
    id: "n2",
    type: "info",
    createdAt: Date.now() - 3 * 60 * 60 * 1000,
    read: false,
    title: "Boss-Event heute Abend",
    body: "Um 20:00 Uhr erscheint der Weltboss in Sektor 7 – sei dabei!",
  },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchNotifications() {
  await delay(150);
  return mockNotifications.map((n) => ({ ...n }));
}

export async function markAllNotificationsRead() {
  await delay(80);
  mockNotifications = mockNotifications.map((n) => ({ ...n, read: true }));
  return mockNotifications.map((n) => ({ ...n }));
}

export async function respondToFriendRequest(id, accept) {
  await delay(200);
  mockNotifications = mockNotifications.map((n) =>
    n.id === id && n.type === "friend_request"
      ? { ...n, data: { ...n.data, status: accept ? "accepted" : "declined" } }
      : n
  );
  return mockNotifications.map((n) => ({ ...n }));
}
