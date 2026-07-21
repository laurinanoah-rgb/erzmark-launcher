import { useState } from "react";
import FriendsList from "./FriendsList.jsx";
import ComingSoonPanel from "./ComingSoonPanel.jsx";
import DockTabs from "./DockTabs.jsx";

function FriendsTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="8" r="2.6" />
      <path d="M3.5 19c0-3.3 2.5-5 5.5-5s5.5 1.7 5.5 5" />
      <circle cx="17" cy="7.5" r="2" opacity="0.85" />
      <path d="M15.3 12c2.4.2 4.2 1.7 4.2 4.6" opacity="0.85" />
    </svg>
  );
}

function GuildTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
      <path d="M3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
    </svg>
  );
}

function MapTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

/**
 * "Soziales"-Dock am linken Rand: Freunde, Gilde und Karte. Gegenstück zum
 * "Infos"-Dock rechts (SidebarDock.jsx: Neuigkeiten/Spielstände/Galerie).
 * Gilde/Karte sind aktuell Platzhalter (siehe ComingSoonPanel) – Gilden-Daten
 * existieren zwar bereits über MMOCore, der Lese-Endpunkt dafür ist aber noch
 * nicht gebaut; die Karte existiert serverseitig bislang gar nicht.
 */
export default function SocialDock() {
  const [friendsOnline, setFriendsOnline] = useState(0);

  const tabs = [
    {
      id: "friends",
      label: "Freunde",
      Icon: FriendsTabIcon,
      color: "blue",
      badge: friendsOnline > 0 ? friendsOnline : null,
      content: <FriendsList onOnlineCountChange={setFriendsOnline} />,
    },
    {
      id: "guild",
      label: "Gilde",
      Icon: GuildTabIcon,
      color: "gold",
      content: (
        <ComingSoonPanel
          icon={<GuildTabIcon />}
          title="Gilden-Ansicht"
          description="Deine MMOCore-Gilde wird hier bald mit Mitgliedern und Rang angezeigt."
        />
      ),
    },
    {
      id: "map",
      label: "Karte",
      Icon: MapTabIcon,
      color: "green",
      content: (
        <ComingSoonPanel
          icon={<MapTabIcon />}
          title="Interaktive Karte"
          description="Eine Live-Karte der Erzmark-Welt ist in Planung."
        />
      ),
    },
  ];

  return <DockTabs tabs={tabs} />;
}
