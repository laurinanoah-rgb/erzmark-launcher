// Kleine Web-Audio-Synthese statt echter Sound-Dateien (keine Audio-Assets
// im Projekt vorhanden) - für Abschnitt 3 der Launcher-Update-TODO ("eigener
// Sound pro Tier", "animierte Zähler mit Sound"). Jeder Ton ist ein kurzer,
// prozedural erzeugter Oszillator-Sweep, kein Sample nötig.
let audioCtx = null;
let muted = false;

/** Von der Einstellungen-Seite aufgerufen (`mute_ui_sounds`, siehe
 * settings.rs) - stummgeschaltet werden nur diese synthetisierten UI-Töne,
 * keine echten Spiel-Sounds. */
export function setMuted(value) {
  muted = value;
}

function getContext() {
  if (muted) return null;
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

function playTone({ freq, glideTo, duration = 0.25, type = "sine", gain = 0.05 }) {
  const ctx = getContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (glideTo) {
    osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + duration);
  }
  gainNode.gain.setValueAtTime(gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  osc.connect(gainNode).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

// Ein Klang je Kategorie statt je Seltenheitsstufe (Abschnitt 3 wurde von
// Bronze/Silber/Gold/Legendär auf 4 thematische Kategorien umgestellt,
// siehe api/achievements.js) - jeder Ton spiegelt die Stimmung seiner
// Kategorie: Meilensteine kampfeslustig-perkussiv, Gaming warm/beständig,
// Sozial freundlich/hell, Entdeckung mysteriös mit einem zweiten Oberton.
const CATEGORY_TONES = {
  milestones: { freq: 349, glideTo: 587, type: "sawtooth", duration: 0.4, gain: 0.07 },
  gaming: { freq: 440, glideTo: 659, type: "sine", duration: 0.38, gain: 0.06 },
  social: { freq: 494, glideTo: 622, type: "triangle", duration: 0.3, gain: 0.06 },
  discovery: { freq: 392, glideTo: 880, type: "sine", duration: 0.5, gain: 0.06 },
};

/** Kurzer, kategorie-spezifischer Klang beim (erstmaligen) Ansehen eines
 * Achievements ("Frisch geschmiedet"). Bei "discovery" (Entdeckung &
 * Geheimnisse) ein zweiter, höherer Oberton kurz versetzt für einen
 * mystischeren, volleren Klang. */
export function playUnlockSound(category) {
  const tone = CATEGORY_TONES[category] ?? CATEGORY_TONES.milestones;
  playTone(tone);
  if (category === "discovery") {
    window.setTimeout(() => playTone({ freq: 1046, glideTo: 1568, duration: 0.35, type: "sine", gain: 0.03 }), 110);
  }
}

/** Dezenter Tick für die hochzählenden Statistik-Zahlen. */
export function playCounterTick() {
  playTone({ freq: 880, duration: 0.045, type: "square", gain: 0.02 });
}

/** Leises Rascheln beim Umblättern der Achievements/Stats-Seite. */
export function playPageTurn() {
  playTone({ freq: 220, glideTo: 140, duration: 0.18, type: "triangle", gain: 0.035 });
}
