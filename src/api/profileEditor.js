// Profil-Editor (Launcher-Update-TODO, Abschnitt 6) - Bio/Banner-Auswahl/
// vorgestellte Erfolge. War bis 22.07.2026 rein lokal (localStorage), seit
// 23.07.2026 echter Server-Endpunkt (ProfileController::getCustomization/
// updateCustomization, Tabelle player_profiles, Account-Ebene), damit
// Launcher, Mobile App und die MineTrax-Website (erzmark.de) denselben Stand
// zeigen. Rückgabeform bewusst unverändert gegenüber der alten Mock-API,
// damit ProfileScreen.jsx unangetastet bleibt.
import { invoke } from "@tauri-apps/api/core";

export const BANNER_PRESETS = [
  { id: "forge", label: "Schmiede", gradient: "linear-gradient(135deg, #ffb900, #6b3f00)" },
  { id: "frost", label: "Frost", gradient: "linear-gradient(135deg, #7fd9ff, #0f3a52)" },
  { id: "jade", label: "Jade", gradient: "linear-gradient(135deg, #4ee6a3, #0d3b2c)" },
  { id: "void", label: "Void", gradient: "linear-gradient(135deg, #b17dff, #241236)" },
];

const DEFAULT_PROFILE = {
  bio: "",
  bannerId: BANNER_PRESETS[0].id,
  featuredAchievementIds: [],
};

export async function getProfile() {
  const result = await invoke("get_profile_customization");
  return {
    bio: result.bio ?? DEFAULT_PROFILE.bio,
    bannerId: result.bannerId ?? DEFAULT_PROFILE.bannerId,
    featuredAchievementIds: result.featuredAchievementIds ?? [],
  };
}

export async function saveProfile(profile) {
  const result = await invoke("save_profile_customization", {
    customization: {
      bio: profile.bio || null,
      bannerId: profile.bannerId || null,
      featuredAchievementIds: profile.featuredAchievementIds ?? [],
    },
  });
  return {
    bio: result.bio ?? DEFAULT_PROFILE.bio,
    bannerId: result.bannerId ?? DEFAULT_PROFILE.bannerId,
    featuredAchievementIds: result.featuredAchievementIds ?? [],
  };
}
