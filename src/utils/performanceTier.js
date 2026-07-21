// Mini-Vorstufe des vollen Performance-Stufensystems aus der Launcher-Update-TODO
// (Abschnitt 1). Liefert vorerst nur zwei Stufen anhand einer statischen
// Geräte-Einschätzung beim Start. Live-Frame-Monitoring, manuelles Override in
// den Settings und die dritte Zwischenstufe folgen, sobald Abschnitt 1 als
// eigenes Feature drankommt — Aufrufer sollten sich daher nur auf die beiden
// Werte "full" und "reduced" verlassen, nicht auf eine feste Stufenanzahl.
export function getPerformanceTier() {
  if (typeof window === "undefined") return "reduced";

  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduced) return "reduced";

  const cores = window.navigator?.hardwareConcurrency ?? 4;
  return cores >= 4 ? "full" : "reduced";
}
