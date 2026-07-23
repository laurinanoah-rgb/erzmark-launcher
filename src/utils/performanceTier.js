// Mini-Vorstufe des vollen Performance-Stufensystems aus der Launcher-Update-TODO
// (Abschnitt 1). Liefert vorerst nur zwei Stufen anhand einer statischen
// Geräte-Einschätzung beim Start. Live-Frame-Monitoring und die dritte
// Zwischenstufe folgen, sobald Abschnitt 1 als eigenes Feature drankommt —
// Aufrufer sollten sich daher nur auf die beiden Werte "full" und "reduced"
// verlassen, nicht auf eine feste Stufenanzahl.
//
// Manuelles Override (23.07.2026): wird in den Settings gewählt und dort
// zusätzlich zur Rust-persistierten `settings.json` in localStorage
// gespiegelt, da `App.jsx` den Tier synchron beim ersten Render braucht
// (`useState(getPerformanceTier)`), Tauri-`invoke()` aber immer async ist.
// Ein geändertes Override greift daher erst ab dem nächsten Start – exakt wie
// FOV-Lock & Co. auch schon in den Settings kommuniziert wird.
const OVERRIDE_KEY = "erzmark_perf_tier_override";

export function getPerformanceTier() {
  if (typeof window === "undefined") return "reduced";

  const override = window.localStorage?.getItem(OVERRIDE_KEY);
  if (override === "full" || override === "reduced") return override;

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) return "reduced";

  const cores = window.navigator?.hardwareConcurrency ?? 4;
  return cores >= 4 ? "full" : "reduced";
}

/** `"auto" | "full" | "reduced"` – von der Settings-Seite aufgerufen, sobald
 * der Nutzer das Override ändert, damit der nächste Start sofort greift. */
export function setPerformanceTierOverride(value) {
  if (typeof window === "undefined") return;
  if (value === "full" || value === "reduced") {
    window.localStorage.setItem(OVERRIDE_KEY, value);
  } else {
    window.localStorage.removeItem(OVERRIDE_KEY);
  }
}

export function getPerformanceTierOverride() {
  if (typeof window === "undefined") return "auto";
  const override = window.localStorage?.getItem(OVERRIDE_KEY);
  return override === "full" || override === "reduced" ? override : "auto";
}
