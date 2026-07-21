// Profil-Editor (Launcher-Update-TODO, Abschnitt 6) - reine Präferenz-Daten
// (Banner-Auswahl/Bio/vorgestellte Erfolge), deshalb genügt lokale Persistenz
// über localStorage statt eines eigenen Server-Endpunkts (gleiches Muster wie
// der "gelesen"-Zustand in App.jsx). Ein künftiger echter Profil-Endpunkt
// (Teil von "Erzmark Pass", siehe TODO) könnte dasselbe Format übernehmen.
const STORAGE_KEY = "erzmark-profile-editor";

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

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function getProfile() {
  await delay(120);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveProfile(profile) {
  await delay(120);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}
