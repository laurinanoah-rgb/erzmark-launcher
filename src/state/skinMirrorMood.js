// Kleiner Pub-Sub, damit weit entfernte Komponenten (z.B. die Dock-Tabs in
// den Sidebars) dem Skin Mirror im Hauptbildschirm ein "das interessiert
// mich"-Signal schicken koennen, ohne Props durch den ganzen Baum zu
// reichen (SidebarDock/SocialDock sind Geschwister der Hero-Stage, kein
// gemeinsamer naher Parent ausser MainScreen selbst).
const listeners = new Set();

export function signalTabHover() {
  listeners.forEach((fn) => fn());
}

export function subscribeTabHover(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
