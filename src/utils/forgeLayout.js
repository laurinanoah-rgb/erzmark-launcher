import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const FORGE_MODULE_IDS = [
  "friends",
  "guild",
  "map",
  "news",
  "profiles",
  "gallery",
  "actions",
];

export const FORGE_ZONES = ["left", "right", "top", "bottom"];

// v2 migriert bewusst weg vom ersten 21:9-Entwurf, der die Karte automatisch
// als sehr hohen oberen Dock platzierte. Alte v1-Daten bleiben unangetastet.
const STORAGE_PREFIX = "erzmark_forge_layout_v2";

const PRESETS = {
  standard: {
    zones: {
      left: ["friends", "guild", "map"],
      right: ["news", "profiles", "gallery"],
      top: [],
      bottom: ["actions"],
    },
    floating: {},
    hidden: [],
    collapsed: [],
  },
  ultrawide: {
    zones: {
      left: ["friends", "guild", "map"],
      right: ["news", "profiles", "gallery"],
      top: [],
      bottom: ["actions"],
    },
    floating: {},
    hidden: [],
    collapsed: [],
  },
  minimal: {
    zones: { left: ["friends"], right: ["news"], top: [], bottom: ["actions"] },
    floating: {},
    hidden: ["guild", "map", "profiles", "gallery"],
    collapsed: [],
  },
  community: {
    zones: {
      left: ["friends", "guild", "map"],
      right: ["news"],
      top: [],
      bottom: ["actions"],
    },
    floating: {
      profiles: { x: 58, y: 10 },
      gallery: { x: 70, y: 38 },
    },
    hidden: [],
    collapsed: [],
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getForgePreset(name, profile = "16:9") {
  const requested = PRESETS[name] ?? PRESETS.standard;
  if (name === "standard" && profile === "21:9") return clone(PRESETS.ultrawide);
  return clone(requested);
}

export function normalizeForgeLayout(value, profile = "16:9") {
  const fallback = getForgePreset("standard", profile);
  if (!value || typeof value !== "object") return fallback;

  const seen = new Set();
  const zones = {};
  for (const zone of FORGE_ZONES) {
    zones[zone] = (Array.isArray(value.zones?.[zone]) ? value.zones[zone] : [])
      .filter((id) => FORGE_MODULE_IDS.includes(id) && !seen.has(id))
      .map((id) => {
        seen.add(id);
        return id;
      });
  }

  const floating = {};
  for (const [id, position] of Object.entries(value.floating ?? {})) {
    if (!FORGE_MODULE_IDS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    const x = Number(position?.x);
    const y = Number(position?.y);
    floating[id] = {
      x: Math.min(82, Math.max(0, Number.isFinite(x) ? x : 12)),
      y: Math.min(76, Math.max(0, Number.isFinite(y) ? y : 12)),
    };
  }

  const hidden = (Array.isArray(value.hidden) ? value.hidden : []).filter(
    (id) => FORGE_MODULE_IDS.includes(id) && !seen.has(id)
  );
  hidden.forEach((id) => seen.add(id));

  // Neue Module aus spaeteren Launcher-Versionen nie verlieren: Sie landen
  // sicher im passenden Standard-Dock.
  for (const id of FORGE_MODULE_IDS) {
    if (seen.has(id)) continue;
    const defaultZone = Object.entries(fallback.zones).find(([, ids]) => ids.includes(id))?.[0] ?? "right";
    zones[defaultZone].push(id);
  }

  return {
    zones,
    floating,
    hidden,
    collapsed: [...new Set((Array.isArray(value.collapsed) ? value.collapsed : []).filter((zone) =>
      FORGE_ZONES.includes(zone)
    ))],
  };
}

function removeModule(layout, moduleId) {
  const next = clone(layout);
  for (const zone of FORGE_ZONES) {
    next.zones[zone] = next.zones[zone].filter((id) => id !== moduleId);
  }
  delete next.floating[moduleId];
  next.hidden = next.hidden.filter((id) => id !== moduleId);
  return next;
}

export function useForgeLayout(profile) {
  const storageKey = `${STORAGE_PREFIX}_${profile}`;
  const profileRef = useRef(profile);
  const [layout, setLayoutState] = useState(() => {
    try {
      return normalizeForgeLayout(JSON.parse(localStorage.getItem(storageKey)), profile);
    } catch {
      return getForgePreset("standard", profile);
    }
  });

  useEffect(() => {
    profileRef.current = profile;
    try {
      setLayoutState(normalizeForgeLayout(JSON.parse(localStorage.getItem(storageKey)), profile));
    } catch {
      setLayoutState(getForgePreset("standard", profile));
    }
  }, [profile, storageKey]);

  const setLayout = useCallback((nextOrUpdater) => {
    setLayoutState((current) => {
      const next = normalizeForgeLayout(
        typeof nextOrUpdater === "function" ? nextOrUpdater(current) : nextOrUpdater,
        profileRef.current
      );
      try {
        localStorage.setItem(`${STORAGE_PREFIX}_${profileRef.current}`, JSON.stringify(next));
      } catch {
        // Ein blockierter/gefüllter WebStorage darf den Editor nicht brechen;
        // das Layout bleibt für die laufende Sitzung trotzdem aktiv.
      }
      return next;
    });
  }, []);

  const moveModule = useCallback(
    (moduleId, destination) => {
      if (!FORGE_MODULE_IDS.includes(moduleId)) return;
      setLayout((current) => {
        const next = removeModule(current, moduleId);
        if (destination === "hidden") next.hidden.push(moduleId);
        else if (destination === "floating") {
          const offset = Object.keys(next.floating).length * 4;
          next.floating[moduleId] = { x: Math.min(70, 18 + offset), y: Math.min(60, 12 + offset) };
        } else if (FORGE_ZONES.includes(destination)) next.zones[destination].push(moduleId);
        return next;
      });
    },
    [setLayout]
  );

  const moveZone = useCallback(
    (source, destination) => {
      if (!FORGE_ZONES.includes(source) || !FORGE_ZONES.includes(destination) || source === destination) return;
      setLayout((current) => {
        const next = clone(current);
        next.zones[destination].push(...next.zones[source]);
        next.zones[source] = [];
        next.collapsed = next.collapsed.filter((zone) => zone !== source);
        return next;
      });
    },
    [setLayout]
  );

  const setFloatingPosition = useCallback(
    (moduleId, position) => {
      setLayout((current) => ({
        ...current,
        floating: { ...current.floating, [moduleId]: position },
      }));
    },
    [setLayout]
  );

  const toggleCollapsed = useCallback(
    (zone) => {
      setLayout((current) => ({
        ...current,
        collapsed: current.collapsed.includes(zone)
          ? current.collapsed.filter((item) => item !== zone)
          : [...current.collapsed, zone],
      }));
    },
    [setLayout]
  );

  const api = useMemo(
    () => ({
      setLayout,
      moveModule,
      moveZone,
      setFloatingPosition,
      toggleCollapsed,
      applyPreset: (name) => setLayout(getForgePreset(name, profileRef.current)),
      reset: () => setLayout(getForgePreset("standard", profileRef.current)),
    }),
    [moveModule, moveZone, setFloatingPosition, setLayout, toggleCollapsed]
  );

  return [layout, api];
}
