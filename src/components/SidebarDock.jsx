import NewsFeed from "./NewsFeed.jsx";
import ScreenshotGallery from "./ScreenshotGallery.jsx";
import CharacterProfiles from "./CharacterProfiles.jsx";
import DockTabs from "./DockTabs.jsx";

function NewsTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 10.5v4a1 1 0 0 0 1 1h1.4l3.4 3.1c.6.55 1.6.13 1.6-.7v-9.1c0-.83-1-1.25-1.6-.7L6.4 10.5H5a1 1 0 0 0-1 1v-1z" />
      <path d="M14.5 8.5c1.6 1 1.6 6 0 7M17.3 6.3c2.9 2 2.9 9.4 0 11.4" />
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

/**
 * "Infos"-Dock am rechten Rand: Neuigkeiten, Spielstände (MMOProfiles) und
 * Screenshot-Galerie – immer nur ein Panel sichtbar, dafür groß und klar
 * lesbar. Das Gegenstück "Soziales" (Freunde/Gilde/Karte) sitzt links, siehe
 * SocialDock.jsx.
 */
export default function SidebarDock() {
  const tabs = [
    { id: "news", label: "Neuigkeiten", Icon: NewsTabIcon, color: "blue", content: <NewsFeed /> },
    { id: "profiles", label: "Spielstände", Icon: ProfilesTabIcon, color: "gold", content: <CharacterProfiles /> },
    { id: "gallery", label: "Galerie", Icon: GalleryTabIcon, color: "green", content: <ScreenshotGallery /> },
  ];

  return <DockTabs tabs={tabs} />;
}
