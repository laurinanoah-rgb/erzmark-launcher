// Profil-Editor (Launcher-Update-TODO, Abschnitt 6) - Bio/Banner-Auswahl/
// vorgestellte Erfolge. War bis 22.07.2026 rein lokal (localStorage), seit
// 23.07.2026 echter Server-Endpunkt (ProfileController::getCustomization/
// updateCustomization, Tabelle player_profiles, Account-Ebene), damit
// Launcher, Mobile App und die MineTrax-Website (erzmark.de) denselben Stand
// zeigen. Rückgabeform bewusst unverändert gegenüber der alten Mock-API,
// damit ProfileScreen.jsx unangetastet bleibt.
import { invoke } from "@tauri-apps/api/core";

// `accent` = erster Gradient-Stop, dient als Live-Akzentfarbe (Avatar-
// Rahmen etc.) - es gibt bewusst kein eigenes Farbfeld im Backend
// (ProfileCustomization kennt nur bio/bannerId/featuredAchievementIds,
// siehe social.rs), deshalb wird die ohnehin persistierte `bannerId` als
// einzige "echte" Farbwahl wiederverwendet statt eine neue vorzutäuschen.
export const BANNER_PRESETS = [
  { id: "forge", label: "Schmiede", gradient: "linear-gradient(135deg, #ffb900, #6b3f00)", accent: "#ffb900" },
  { id: "frost", label: "Frost", gradient: "linear-gradient(135deg, #7fd9ff, #0f3a52)", accent: "#7fd9ff" },
  { id: "jade", label: "Jade", gradient: "linear-gradient(135deg, #4ee6a3, #0d3b2c)", accent: "#4ee6a3" },
  { id: "void", label: "Void", gradient: "linear-gradient(135deg, #b17dff, #241236)", accent: "#b17dff" },
];

export const DEFAULT_PROFILE = {
  bio: "",
  bannerId: BANNER_PRESETS[0].id,
  featuredAchievementIds: [],
};

const PROFILE_CACHE_KEY = "erzmark_profile_customization_cache_v1";
let profileRequest = null;
let lastServerProfile = null;
let lastFetchAt = 0;

function normalizeProfile(result = {}) {
  return {
    bio: result.bio ?? DEFAULT_PROFILE.bio,
    bannerId: result.bannerId ?? DEFAULT_PROFILE.bannerId,
    featuredAchievementIds: result.featuredAchievementIds ?? [],
  };
}

function cacheProfile(profile) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // Cache ist nur eine Beschleunigung; Serverdaten bleiben maßgeblich.
  }
  return profile;
}

export function getCachedProfile() {
  if (lastServerProfile) return lastServerProfile;
  try {
    return normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY)) ?? DEFAULT_PROFILE);
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function getProfile() {
  if (lastServerProfile && Date.now() - lastFetchAt < 60_000) return lastServerProfile;
  if (!profileRequest) {
    profileRequest = invoke("get_profile_customization")
      .then((result) => {
        lastServerProfile = cacheProfile(normalizeProfile(result));
        lastFetchAt = Date.now();
        return lastServerProfile;
      })
      .finally(() => {
        profileRequest = null;
      });
  }
  return profileRequest;
}

export async function saveProfile(profile) {
  const result = await invoke("save_profile_customization", {
    customization: {
      bio: profile.bio || null,
      bannerId: profile.bannerId || null,
      featuredAchievementIds: profile.featuredAchievementIds ?? [],
    },
  });
  lastServerProfile = cacheProfile(normalizeProfile(result));
  lastFetchAt = Date.now();
  return lastServerProfile;
}
