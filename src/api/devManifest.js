// Temporärer Platzhalter, bis das echte Manifest-/Update-System von
// erzmark.de angebunden ist (nächster Schritt laut Planung). Simuliert genau
// die Felder, die später aus https://erzmark.de/launcher/manifest.json
// kommen, damit sich der Update-Video-Ablauf schon jetzt testen lässt.
//
// updateVideoUrl zeigt auf eine lokale Datei unter public/media/ (siehe
// README für den Kopier-Schritt). Sobald das echte Manifest da ist, wird
// diese Datei durch einen fetch() auf die Server-URL ersetzt.
export const DEV_MANIFEST = {
  clientVersion: "0.0.1-test",
  updateVideoUrl: "/media/update-video.mp4",
};
