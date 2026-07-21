import { useEffect, useRef, useState } from "react";
import { SkinViewer, IdleAnimation, PlayerAnimation } from "skinview3d";
import { getPerformanceTier } from "../utils/performanceTier.js";
import { drawSkinPaperDoll } from "../utils/skinPaperDoll.js";
import { subscribeTabHover } from "../state/skinMirrorMood.js";
import { getCharacterProfiles } from "../api/profiles.js";
import { getFriends, getFriendSkinUrl } from "../api/friends.js";

// Alle X Sekunden wird ein zufälliges Emote abgespielt (Dauer je nach Emote).
const EMOTE_INTERVAL_SECONDS = 9;

// Statt automatischer Dauer-Rotation steht der Skin fest, nur ganz leicht
// (ca. 20°) nach links gedreht, damit er nicht frontal/flach wirkt.
const STATIC_YAW_DEGREES = 20;

// Nach so viel Zeit ganz ohne Maus-/Tastatur-Aktivität irgendwo im Launcher
// wechselt die Hero-Ansicht von der normalen Emote-Rotation in die
// Inaktivitäts-Reaktion (Gähnen/kurzes Ausruhen).
const INACTIVITY_MS = 40_000;
const INACTIVITY_POSE_INTERVAL_SECONDS = 12;

// Reines Feintuning, wie stark der Kopf dem Mauszeiger folgt / wie schnell
// er sich einpendelt - keine Konfiguration von außen nötig.
const HEAD_TRACK_MAX_Y = 0.6;
const HEAD_TRACK_MAX_X = 0.4;
const HEAD_TRACK_SMOOTHING = 0.06;

// Kryptische R.U.D.O.L.F.-Kommentare für den seltenen Glitch (Abschnitt 5 der
// TODO nennt R.U.D.O.L.F.-Lore explizit) - reine Text-Platzhalter, kein Bezug
// zu echten Ingame-Ereignissen nötig.
const RUDOLF_GLITCH_LINES = [
  "das war nicht dein Gesicht.",
  "// FEHLER: Silhouette nicht in Datenbank",
  "ich habe dich schon einmal so gesehen.",
  "falsche Textur geladen. oder falsche Erinnerung.",
  "bleib stehen. nur kurz.",
];
const GLITCH_CHECK_INTERVAL_MS = 15_000;
const GLITCH_CHANCE = 0.06;
const GLITCH_DURATION_MS = 1300;

// Charakter-Level als grober Ersatz für "Reputationsstufe/Power-Score" aus
// der TODO - ein echtes Reputations-/Power-Score-System existiert im
// Backend (noch) nicht, das MMOCore-Klassenlevel ist der einzige reale,
// bereits verfügbare Fortschrittswert.
const POSE_TIER_TIMID_MAX_LEVEL = 9;
const POSE_TIER_CONFIDENT_MIN_LEVEL = 25;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Jedes Emote bekommt: player, p (0..1 Fortschritt innerhalb des Emotes),
// lift (0 -> 1 -> 0 Ease-Envelope über die Dauer) und die aktuellen
// Idle-Basiswerte der Arme, damit übergangslos rein-/rausgeblendet wird.

function applyWave(player, p, lift, idle) {
  const raise = -Math.PI * 0.62;
  const shake = Math.sin(p * Math.PI * 6) * 0.28 * lift;
  player.skin.rightArm.rotation.z = lerp(idle.rightArmZ, raise, lift);
  player.skin.rightArm.rotation.x = shake;
}

function applyNod(player, p, lift) {
  // Zwei sanfte Nick-Bewegungen, wie ein kurzes Grüßen.
  player.skin.head.rotation.x = Math.sin(p * Math.PI * 2) * 0.35 * lift;
}

function applyLookAround(player, p, lift) {
  // Neugieriges Umschauen nach links und rechts.
  player.skin.head.rotation.y = Math.sin(p * Math.PI * 2) * 0.5 * lift;
}

function applyStretch(player, p, lift, idle) {
  // Strecken: beide Arme heben sich seitlich nach oben, Kopf leicht in den Nacken.
  player.skin.leftArm.rotation.z = lerp(idle.leftArmZ, Math.PI * 0.7, lift);
  player.skin.rightArm.rotation.z = lerp(idle.rightArmZ, -Math.PI * 0.7, lift);
  player.skin.head.rotation.x = -0.15 * lift;
  player.skin.body.rotation.x = -0.05 * lift;
}

function applySalute(player, p, lift, idle) {
  // Rechter Arm hebt sich zackig zum Kopf, kurzes Halten statt Zittern.
  player.skin.rightArm.rotation.z = lerp(idle.rightArmZ, -Math.PI * 0.8, lift);
  player.skin.rightArm.rotation.x = -0.35 * lift;
  player.skin.head.rotation.x = 0.05 * lift;
}

function applyBow(player, p, lift) {
  // Kurze, respektvolle Verbeugung.
  const bend = 0.5 * lift;
  player.skin.body.rotation.x = bend;
  player.skin.head.rotation.x = bend * 0.6;
  player.skin.leftArm.rotation.x = bend * 0.3;
  player.skin.rightArm.rotation.x = bend * 0.3;
}

const EMOTES = [
  { duration: 2.0, apply: applyWave },
  { duration: 2.2, apply: applyNod },
  { duration: 2.6, apply: applyLookAround },
  { duration: 2.4, apply: applyStretch },
  { duration: 1.8, apply: applySalute },
  { duration: 2.2, apply: applyBow },
];

function applyYawn(player, p, lift, idle) {
  // Gähnen: beide Arme schwingen locker nach oben/vorn, Kopf kippt in den Nacken.
  player.skin.leftArm.rotation.z = lerp(idle.leftArmZ, Math.PI * 0.55, lift);
  player.skin.rightArm.rotation.z = lerp(idle.rightArmZ, -Math.PI * 0.55, lift);
  player.skin.leftArm.rotation.x = -0.3 * lift;
  player.skin.rightArm.rotation.x = -0.3 * lift;
  player.skin.head.rotation.x = -0.25 * lift;
  player.skin.body.rotation.x = -0.05 * lift;
}

function applyRest(player, p, lift) {
  // Kein echtes Hinsetzen möglich (das Modell kennt keine Sitzfläche/keine
  // Y-Verschiebung dafür) - stattdessen angedeutet über nach hinten
  // geklappte Beine, leicht zurückgelehnten Oberkörper und gesenkten Kopf,
  // wie ein kurzes Wegdösen im Stehen.
  const bend = 0.9 * lift;
  player.skin.leftLeg.rotation.x = -bend;
  player.skin.rightLeg.rotation.x = -bend;
  player.skin.body.rotation.x = -0.12 * lift;
  player.skin.head.rotation.x = 0.2 * lift;
  player.skin.leftArm.rotation.x = -0.15 * lift;
  player.skin.rightArm.rotation.x = -0.15 * lift;
}

const INACTIVITY_POSES = [
  { duration: 2.6, apply: applyYawn },
  { duration: 3.2, apply: applyRest },
];

// Deterministisch-"zufällige" Auswahl pro Zyklus (kein Math.random() im
// Animations-Loop, sonst würde das Emote bei jedem Frame neu "gewürfelt").
function pseudoRandomIndex(seed, mod) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  const frac = x - Math.floor(x);
  return Math.floor(frac * mod);
}

function poseTierForLevel(level) {
  if (level == null) return "normal";
  if (level <= POSE_TIER_TIMID_MAX_LEVEL) return "timid";
  if (level >= POSE_TIER_CONFIDENT_MIN_LEVEL) return "confident";
  return "normal";
}

/**
 * Idle-Animation (identisch zu skinview3d's eingebauter IdleAnimation) mit
 * zusätzlichen, periodisch wiederkehrenden und zufällig ausgewählten
 * Emotes (Winken, Nicken, Umschauen, Strecken, Salutieren, Verbeugen) –
 * ähnlich wie z.B. beim NoRisk Client. Wir bauen das selbst statt die
 * eingebaute skinview3d-`WaveAnimation` zu nutzen, weil deren `rotation.x =
 * 180` (Radiant statt Grad) zu einer unnatürlich verdrehten Armhaltung führt.
 *
 * Zusätzlich (Launcher-Update-TODO, Abschnitt 2 "Skin Mirror"): Atem-Idle,
 * Kopf-Tracking zum Mauszeiger, eine "Neugier"-Reaktion bei Tab-Hover, eine
 * Basis-Pose je nach Charakter-Level, ein seltener R.U.D.O.L.F.-Glitch, ein
 * erzwingbares Emote (Doppelklick) und eine Inaktivitäts-Reaktion. Alle
 * Felder unterhalb von `progress`/`speed` werden direkt von außen (React-
 * Effects in SkinMirror) auf der laufenden Instanz gesetzt/gelesen - kein
 * eigener State-Store nötig, da es exakt eine Instanz pro Viewer gibt.
 */
class HeroIdleEmoteAnimation extends PlayerAnimation {
  mouse = { x: 0, y: 0 };
  curiousUntil = 0;
  glitchUntil = 0;
  inactive = false;
  level = null;
  forcedIndex = null;
  forcedStart = 0;
  _headX = 0;
  _headY = 0;

  forceEmote(index) {
    this.forcedIndex = index;
    this.forcedStart = this.progress;
  }

  animate(player) {
    // Multiply by animation's natural speed
    const t = this.progress * 2;

    // Basis-Idle-Bewegung (Armschwung + Umhang) – 1:1 wie IdleAnimation,
    // plus einen kleinen Versatz je nach Pose-Stufe (Level-Proxy).
    const poseTier = poseTierForLevel(this.level);
    const armAmplitudeScale = poseTier === "timid" ? 1.4 : 1;
    const basicArmRotationZ = Math.PI * 0.02 * armAmplitudeScale;
    const idleLeftArmZ = Math.cos(t) * 0.03 + basicArmRotationZ;
    const idleRightArmZ = Math.cos(t + Math.PI) * 0.03 - basicArmRotationZ;
    const basicCapeRotationX = Math.PI * 0.06;

    player.skin.leftArm.rotation.z = idleLeftArmZ;
    player.skin.rightArm.rotation.z = idleRightArmZ;
    player.skin.leftArm.rotation.x = 0;
    player.skin.rightArm.rotation.x = 0;
    player.skin.head.rotation.x = 0;
    player.skin.head.rotation.y = 0;
    player.skin.head.rotation.z = 0;
    player.skin.leftLeg.rotation.x = 0;
    player.skin.rightLeg.rotation.x = 0;
    player.skin.leftLeg.rotation.z = poseTier === "confident" ? 0.05 : 0;
    player.skin.rightLeg.rotation.z = poseTier === "confident" ? -0.05 : 0;
    player.skin.body.rotation.x =
      poseTier === "timid" ? 0.04 : poseTier === "confident" ? -0.03 : 0;
    player.cape.rotation.x = Math.sin(t) * 0.01 + basicCapeRotationX;

    // Atmen: leichte, durchgehende Skalierung von Oberkörper/Kopf.
    const breath = 1 + Math.sin(t * 0.9) * 0.012;
    player.skin.body.scale.y = breath;
    player.skin.head.scale.y = 1 + Math.sin(t * 0.9 + 0.3) * 0.006;

    // Kopf-Tracking zum Mauszeiger als Ruhezustand zwischen Emotes/Posen -
    // wird von "wichtigeren" Kopf-Bewegungen (Emotes, Neugier) weiter unten
    // überschrieben.
    const isCurious = Date.now() < this.curiousUntil;
    const targetHeadY = isCurious ? 0.18 : clamp(this.mouse.x * HEAD_TRACK_MAX_Y, -HEAD_TRACK_MAX_Y, HEAD_TRACK_MAX_Y);
    const targetHeadX = isCurious ? -0.14 : clamp(-this.mouse.y * HEAD_TRACK_MAX_X, -HEAD_TRACK_MAX_X, HEAD_TRACK_MAX_X);
    this._headX = lerp(this._headX, targetHeadX, HEAD_TRACK_SMOOTHING);
    this._headY = lerp(this._headY, targetHeadY, HEAD_TRACK_SMOOTHING);
    player.skin.head.rotation.x = this._headX;
    player.skin.head.rotation.y = this._headY;
    if (isCurious) {
      // Leichte, neugierige Kopfschräglage obendrauf, damit sich "Neugier"
      // von reinem Hinschauen unterscheidet.
      player.skin.head.rotation.z = Math.sin(Date.now() * 0.006) * 0.08;
    }

    const idleForEmotes = { leftArmZ: idleLeftArmZ, rightArmZ: idleRightArmZ };

    if (this.forcedIndex != null) {
      // Erzwungenes Emote (Doppelklick) hat Vorrang vor allem anderen außer
      // dem Glitch weiter unten.
      const emote = EMOTES[this.forcedIndex];
      const elapsed = this.progress - this.forcedStart;
      if (elapsed < emote.duration) {
        const p = elapsed / emote.duration;
        const lift = Math.sin(p * Math.PI);
        emote.apply(player, p, lift, idleForEmotes);
      } else {
        this.forcedIndex = null;
      }
    } else if (this.inactive) {
      // Inaktivitäts-Reaktion statt der normalen Emote-Rotation.
      const cycleIndex = Math.floor(this.progress / INACTIVITY_POSE_INTERVAL_SECONDS);
      const cycleTime = this.progress - cycleIndex * INACTIVITY_POSE_INTERVAL_SECONDS;
      const pose = INACTIVITY_POSES[pseudoRandomIndex(cycleIndex, INACTIVITY_POSES.length)];
      if (cycleTime < pose.duration) {
        const p = cycleTime / pose.duration;
        const lift = Math.sin(p * Math.PI);
        pose.apply(player, p, lift, idleForEmotes);
      }
    } else {
      // Periodisch ein zufällig gewähltes Emote abspielen, sanft ein-/ausgeblendet.
      const cycleIndex = Math.floor(this.progress / EMOTE_INTERVAL_SECONDS);
      const cycleTime = this.progress - cycleIndex * EMOTE_INTERVAL_SECONDS;
      const emote = EMOTES[pseudoRandomIndex(cycleIndex, EMOTES.length)];
      if (cycleTime < emote.duration) {
        const p = cycleTime / emote.duration;
        const lift = Math.sin(p * Math.PI); // Ease: 0 -> 1 -> 0
        emote.apply(player, p, lift, idleForEmotes);
      }
    }

    // R.U.D.O.L.F.-Glitch: kurzer, deterministischer Jitter obendrauf -
    // die eigentliche visuelle "Störung" (CSS-Filter, Sprechblase) kommt
    // aus der React-Komponente, hier nur die Pose-Verzerrung.
    if (Date.now() < this.glitchUntil) {
      const jitterT = this.progress * 97;
      player.skin.head.rotation.z += Math.sin(jitterT) * 0.15;
      player.skin.head.rotation.y += Math.cos(jitterT * 1.7) * 0.2;
      player.rotation.y += Math.sin(jitterT * 3.1) * 0.05;
      player.skin.body.rotation.z = Math.sin(jitterT * 2.3) * 0.05;
    } else {
      player.skin.body.rotation.z = 0;
    }
  }
}

/**
 * Drehbare 3D-Vorschau des aktuellen Skins ("Skin Mirror") mit sanfter
 * Idle-Animation (Arm-/Umhangschwung) – per Maus/Touch lässt sich die
 * Ansicht zusätzlich manuell drehen/zoomen (in skinview3d eingebaut, siehe
 * `enableControls`, Default `true`). textures.minecraft.net ist bereits in
 * der CSP erlaubt (img-src), daher ist keine weitere Konfiguration nötig.
 *
 * `emotes`: aktiviert zusätzlich zur Idle-Animation periodisch zufällig
 * wechselnde Emotes, Kopf-Tracking, Level-Pose, Glitch, Doppelklick-Emote
 * und Inaktivitäts-Reaktion (für die große Hero-Ansicht im Hauptbildschirm).
 * `showFriends`: zeigt (nur zusammen mit `emotes`) bis zu drei online
 * Freunde als kleinere Vorschauen im selben "Raum" daneben (Sozialer Modus).
 *
 * Bei Performance-Stufe "reduced" (siehe utils/performanceTier.js) wird gar
 * keine WebGL-Szene gestartet - stattdessen ein einmalig gezeichnetes
 * 2D-Canvas-Abbild der Skin-Textur (siehe utils/skinPaperDoll.js).
 */
export default function SkinMirror({ skinUrl, width = 200, height = 260, emotes = false, showFriends = false }) {
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const tierRef = useRef(getPerformanceTier());
  const [glitchLine, setGlitchLine] = useState(null);
  const [glitching, setGlitching] = useState(false);
  const [friendsSkins, setFriendsSkins] = useState([]);
  const tier = tierRef.current;

  // --- Stufe "reduced": statisches Paperdoll-Bild statt 3D-Szene ---
  useEffect(() => {
    if (tier === "full") return;
    if (!canvasRef.current || !skinUrl) return;
    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => drawSkinPaperDoll(canvas, img);
    img.src = skinUrl;
  }, [tier, skinUrl, width, height]);

  // --- Stufe "full": vollständige 3D-Szene ---
  useEffect(() => {
    if (tier !== "full") return;
    if (!canvasRef.current) return;

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width,
      height,
      zoom: 0.75,
    });
    viewer.animation = emotes ? new HeroIdleEmoteAnimation() : new IdleAnimation();
    viewer.playerWrapper.rotation.y = (STATIC_YAW_DEGREES * Math.PI) / 180;
    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  useEffect(() => {
    if (tier !== "full") return;
    if (!viewerRef.current || !skinUrl) return;
    Promise.resolve(viewerRef.current.loadSkin(skinUrl)).catch(() => {
      // Ungültige/nicht ladbare Skin-URL - Vorschau bleibt einfach leer.
    });
  }, [tier, skinUrl]);

  // Kopf-Tracking zum Mauszeiger (Fensterweit, nicht nur über dem Canvas -
  // wirkt sonst nur an, wenn die Maus zufällig genau über der Vorschau ist).
  useEffect(() => {
    if (tier !== "full" || !emotes) return;

    let lastInteraction = Date.now();

    function onMouseMove(e) {
      lastInteraction = Date.now();
      const anim = viewerRef.current?.animation;
      if (!(anim instanceof HeroIdleEmoteAnimation) || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      anim.mouse = {
        x: clamp((e.clientX - cx) / (window.innerWidth * 0.5), -1, 1),
        y: clamp((e.clientY - cy) / (window.innerHeight * 0.5), -1, 1),
      };
    }
    function onKeyDown() {
      lastInteraction = Date.now();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);

    const inactivityTimer = window.setInterval(() => {
      const anim = viewerRef.current?.animation;
      if (anim instanceof HeroIdleEmoteAnimation) {
        anim.inactive = Date.now() - lastInteraction > INACTIVITY_MS;
      }
    }, 5000);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.clearInterval(inactivityTimer);
    };
  }, [tier, emotes]);

  // Tab-Hover in den Dock-Widgets löst eine kurze "Neugier"-Reaktion aus.
  useEffect(() => {
    if (tier !== "full" || !emotes) return;
    return subscribeTabHover(() => {
      const anim = viewerRef.current?.animation;
      if (anim instanceof HeroIdleEmoteAnimation) {
        anim.curiousUntil = Date.now() + 1600;
      }
    });
  }, [tier, emotes]);

  // Charakter-Level laden (Proxy für die Pose-Stufe, siehe poseTierForLevel).
  useEffect(() => {
    if (tier !== "full" || !emotes) return;
    let cancelled = false;
    getCharacterProfiles()
      .then((profiles) => {
        if (cancelled) return;
        const active = profiles.find((p) => p.active);
        const anim = viewerRef.current?.animation;
        if (anim instanceof HeroIdleEmoteAnimation) {
          anim.level = active?.level ?? null;
        }
      })
      .catch(() => {
        // Level ist nur eine dezente Pose-Feinheit, kein kritischer Pfad.
      });
    return () => {
      cancelled = true;
    };
  }, [tier, emotes]);

  // Seltener R.U.D.O.L.F.-Glitch.
  useEffect(() => {
    if (tier !== "full" || !emotes) return;
    const timer = window.setInterval(() => {
      if (Math.random() > GLITCH_CHANCE) return;
      const anim = viewerRef.current?.animation;
      if (!(anim instanceof HeroIdleEmoteAnimation)) return;
      anim.glitchUntil = Date.now() + GLITCH_DURATION_MS;
      setGlitchLine(RUDOLF_GLITCH_LINES[Math.floor(Math.random() * RUDOLF_GLITCH_LINES.length)]);
      setGlitching(true);
      window.setTimeout(() => setGlitching(false), GLITCH_DURATION_MS);
    }, GLITCH_CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [tier, emotes]);

  // Doppelklick erzwingt sofort ein zufälliges Emote.
  function handleDoubleClick() {
    const anim = viewerRef.current?.animation;
    if (anim instanceof HeroIdleEmoteAnimation) {
      anim.forceEmote(Math.floor(Math.random() * EMOTES.length));
    }
  }

  // Sozialer Modus: bis zu drei online Freunde daneben anzeigen.
  useEffect(() => {
    if (tier !== "full" || !emotes || !showFriends) {
      setFriendsSkins([]);
      return;
    }
    let cancelled = false;
    getFriends()
      .then(async (friends) => {
        const online = friends.filter((f) => f.online).slice(0, 3);
        const withSkins = await Promise.all(
          online.map(async (f) => {
            try {
              const url = await getFriendSkinUrl(f.uuid);
              return url ? { name: f.name, url } : null;
            } catch {
              return null;
            }
          })
        );
        if (!cancelled) setFriendsSkins(withSkins.filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) setFriendsSkins([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tier, emotes, showFriends]);

  const friendSize = Math.round(width * 0.55);

  return (
    <div className={`erzmark-skin-mirror-wrap${tier === "full" ? " erzmark-skin-mirror-wrap--shadow" : ""}`}>
      <canvas
        ref={canvasRef}
        className={`erzmark-skin-mirror${glitching ? " erzmark-skin-mirror--glitch" : ""}`}
        onDoubleClick={tier === "full" ? handleDoubleClick : undefined}
      />
      {glitching && glitchLine && <div className="erzmark-skin-mirror-glitch-quote">R.U.D.O.L.F.: „{glitchLine}“</div>}
      {friendsSkins.length > 0 && (
        <div className="erzmark-skin-mirror-room" aria-hidden="true">
          {friendsSkins.map((f) => (
            <div key={f.name} className="erzmark-skin-mirror-room-friend" title={f.name}>
              <SkinMirror skinUrl={f.url} width={friendSize} height={Math.round(friendSize * 1.3)} />
              <span className="erzmark-skin-mirror-room-friend-name">{f.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
