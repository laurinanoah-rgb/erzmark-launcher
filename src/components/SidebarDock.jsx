import { useState } from "react";
import NewsFeed from "./NewsFeed.jsx";
import FriendsList from "./FriendsList.jsx";
import ScreenshotGallery from "./ScreenshotGallery.jsx";
import CharacterProfiles from "./CharacterProfiles.jsx";

function NewsTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 10.5v4a1 1 0 0 0 1 1h1.4l3.4 3.1c.6.55 1.6.13 1.6-.7v-9.1c0-.83-1-1.25-1.6-.7L6.4 10.5H5a1 1 0 0 0-1 1v-1z" />
      <path d="M14.5 8.5c1.6 1 1.6 6 0 7M17.3 6.3c2.9 2 2.9 9.4 0 11.4" />
    </svg>
  );
}

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

function GalleryTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M4 16.5 8.5 12l3 3 3.5-4L20 16" />
    </svg>
  );
}

function ProfilesTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2 L19 8 L12 22 L5 8 Z" />
      <path d="M9 8h6" />
    </svg>
  );
}

const TABS = [
  { id: "news", label: "Neuigkeiten", Icon: NewsTabIcon },
  { id: "friends", label: "Freunde", Icon: FriendsTabIcon },
  { id: "profiles", label: "Spielstände", Icon: ProfilesTabIcon },
  { id: "gallery", label: "Galerie", Icon: GalleryTabIcon },
];

/**
 * Modernes "Dock" statt einer starr gestapelten Sidebar: eine schmale
 * Icon-Leiste am rechten Rand schaltet zwischen Neuigkeiten, Freunden und
 * Screenshot-Galerie um – immer nur ein Panel sichtbar, dafür groß und klar
 * lesbar. Die Freunde-Kachel zeigt zusätzlich einen Live-Badge mit der
 * Anzahl online befindlicher Freunde (dezenter Discord-artiger Touch).
 */
export default function SidebarDock() {
  const [active, setActive] = useState("news");
  const [friendsOnline, setFriendsOnline] = useState(0);

  return (
    <div className="erzmark-dock">
      <nav className="erzmark-dock-rail" aria-label="Widget-Auswahl">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`erzmark-dock-tab${active === id ? " is-active" : ""}`}
            onClick={() => setActive(id)}
            title={label}
            aria-label={label}
            aria-pressed={active === id}
          >
            <Icon />
            <span className="erzmark-dock-tab-label">{label}</span>
            {id === "friends" && friendsOnline > 0 && (
              <span className="erzmark-dock-tab-badge">{friendsOnline}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="erzmark-dock-panel" key={active}>
        {active === "news" && <NewsFeed />}
        {active === "friends" && <FriendsList onOnlineCountChange={setFriendsOnline} />}
        {active === "profiles" && <CharacterProfiles />}
        {active === "gallery" && <ScreenshotGallery />}
      </div>
    </div>
  );
}
