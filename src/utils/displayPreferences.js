export const DEFAULT_DISPLAY_PREFERENCES = {
  display_preset: "auto",
  ui_scale: "normal",
  text_scale: "normal",
  high_contrast: false,
  reduce_motion: false,
};

const UI_ZOOM = {
  compact: 0.9,
  normal: 1,
  large: 1.14,
  extra_large: 1.28,
};

const TEXT_ADJUST = {
  normal: "100%",
  large: "115%",
  extra_large: "130%",
};

const TEXT_ZOOM = {
  normal: 1,
  large: 1.08,
  extra_large: 1.16,
};

export function normalizeDisplayPreferences(settings = {}) {
  const merged = { ...DEFAULT_DISPLAY_PREFERENCES, ...settings };
  if (!["auto", "16:9", "21:9"].includes(merged.display_preset)) {
    merged.display_preset = "auto";
  }
  if (!Object.hasOwn(UI_ZOOM, merged.ui_scale)) merged.ui_scale = "normal";
  if (!Object.hasOwn(TEXT_ADJUST, merged.text_scale)) merged.text_scale = "normal";
  return merged;
}

export function detectDisplayProfile() {
  if (typeof window === "undefined") return "16:9";

  const viewportRatio = window.innerWidth / Math.max(window.innerHeight, 1);
  const screenWidth = window.screen?.availWidth || window.screen?.width || window.innerWidth;
  const screenHeight = window.screen?.availHeight || window.screen?.height || window.innerHeight;
  const screenRatio = screenWidth / Math.max(screenHeight, 1);
  const nearlyFullscreen =
    Boolean(document.fullscreenElement) ||
    (window.outerWidth >= screenWidth * 0.9 && window.outerHeight >= screenHeight * 0.84);

  // 2.05 trennt 16:9 (1.78) sauber von gaengigen 21:9-/Ultrawide-Formaten.
  return viewportRatio >= 2.05 || (nearlyFullscreen && screenRatio >= 2.05) ? "21:9" : "16:9";
}

export function resolveDisplayPreferences(settings) {
  const preferences = normalizeDisplayPreferences(settings);
  const profile =
    preferences.display_preset === "auto"
      ? detectDisplayProfile()
      : preferences.display_preset;

  // Ein Ultrawide braucht bereits ohne Barrierefreiheits-Zoom groessere
  // Bedienelemente. Beide Skalierungen werden kombiniert, aber bewusst
  // begrenzt, damit auch kleine Hoehen bedienbar bleiben.
  // Das Seitenverhaeltnis wird ueber ein echtes responsives Layout geloest.
  // Root-Zoom fuer 21:9 wuerde in WebView2 die nutzbare Breite verkleinern
  // und rechts eine schwarze Flaeche erzeugen. Zoom bleibt deshalb allein
  // den expliziten Barrierefreiheitsstufen vorbehalten.
  const profileZoom = 1;
  const zoom = Math.min(
    1.56,
    Math.max(
      0.88,
      profileZoom * UI_ZOOM[preferences.ui_scale] * TEXT_ZOOM[preferences.text_scale]
    )
  );

  return {
    ...preferences,
    profile,
    zoom,
    inverseZoom: `${100 / zoom}%`,
    textAdjust: TEXT_ADJUST[preferences.text_scale],
  };
}
