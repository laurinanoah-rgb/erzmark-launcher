// Kleiner Pub-Sub (gleiches Muster wie skinMirrorMood.js), damit Komponenten
// abseits der Einstellungen-Seite (Glocke im Header, Skin Mirror, Zähler-
// Sounds) sofort auf gespeicherte Einstellungsänderungen reagieren können,
// ohne die Seite selbst neu laden zu müssen.
const listeners = new Set();

export function broadcastSettingsChanged(settings) {
  listeners.forEach((fn) => fn(settings));
}

export function subscribeSettingsChanged(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
