import { useEffect, useRef } from "react";
import { SkinViewer, IdleAnimation, PlayerAnimation } from "skinview3d";

// Alle X Sekunden wird ein zufälliges Emote abgespielt (Dauer je nach Emote).
const EMOTE_INTERVAL_SECONDS = 9;

// Statt automatischer Dauer-Rotation steht der Skin fest, nur ganz leicht
// (ca. 20°) nach links gedreht, damit er nicht frontal/flach wirkt.
const STATIC_YAW_DEGREES = 20;

function lerp(a, b, t) {
  return a + (b - a) * t;
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

// Deterministisch-"zufällige" Auswahl pro Zyklus (kein Math.random() im
// Animations-Loop, sonst würde das Emote bei jedem Frame neu "gewürfelt").
function pseudoRandomIndex(seed, mod) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  const frac = x - Math.floor(x);
  return Math.floor(frac * mod);
}

/**
 * Idle-Animation (identisch zu skinview3d's eingebauter IdleAnimation) mit
 * zusätzlichen, periodisch wiederkehrenden und zufällig ausgewählten
 * Emotes (Winken, Nicken, Umschauen, Strecken, Salutieren, Verbeugen) –
 * ähnlich wie z.B. beim NoRisk Client. Wir bauen das selbst statt die
 * eingebaute skinview3d-`WaveAnimation` zu nutzen, weil deren `rotation.x =
 * 180` (Radiant statt Grad) zu einer unnatürlich verdrehten Armhaltung führt.
 */
class HeroIdleEmoteAnimation extends PlayerAnimation {
  animate(player) {
    // Multiply by animation's natural speed
    const t = this.progress * 2;

    // Basis-Idle-Bewegung (Armschwung + Umhang) – 1:1 wie IdleAnimation.
    const basicArmRotationZ = Math.PI * 0.02;
    const idleLeftArmZ = Math.cos(t) * 0.03 + basicArmRotationZ;
    const idleRightArmZ = Math.cos(t + Math.PI) * 0.03 - basicArmRotationZ;
    const basicCapeRotationX = Math.PI * 0.06;

    player.skin.leftArm.rotation.z = idleLeftArmZ;
    player.skin.rightArm.rotation.z = idleRightArmZ;
    player.skin.leftArm.rotation.x = 0;
    player.skin.rightArm.rotation.x = 0;
    player.skin.head.rotation.x = 0;
    player.skin.head.rotation.y = 0;
    player.skin.body.rotation.x = 0;
    player.cape.rotation.x = Math.sin(t) * 0.01 + basicCapeRotationX;

    // Periodisch ein zufällig gewähltes Emote abspielen, sanft ein-/ausgeblendet.
    const cycleIndex = Math.floor(this.progress / EMOTE_INTERVAL_SECONDS);
    const cycleTime = this.progress - cycleIndex * EMOTE_INTERVAL_SECONDS;
    const emote = EMOTES[pseudoRandomIndex(cycleIndex, EMOTES.length)];

    if (cycleTime < emote.duration) {
      const p = cycleTime / emote.duration;
      const lift = Math.sin(p * Math.PI); // Ease: 0 -> 1 -> 0
      emote.apply(player, p, lift, { leftArmZ: idleLeftArmZ, rightArmZ: idleRightArmZ });
    }
  }
}

/**
 * Drehbare 3D-Vorschau des aktuellen Skins ("Skin Mirror") mit sanfter
 * Idle-Animation (Arm-/Umhangschwung) – per Maus/Touch lässt sich die
 * Ansicht zusätzlich manuell drehen/zoomen (in skinview3d eingebaut).
 * textures.minecraft.net ist bereits in der CSP erlaubt (img-src), daher
 * ist keine weitere Konfiguration nötig.
 *
 * `emotes`: aktiviert zusätzlich zur Idle-Animation periodisch zufällig
 * wechselnde Emotes (z.B. für die große Hero-Ansicht im Hauptbildschirm).
 */
export default function SkinMirror({ skinUrl, width = 200, height = 260, emotes = false }) {
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!viewerRef.current || !skinUrl) return;
    Promise.resolve(viewerRef.current.loadSkin(skinUrl)).catch(() => {
      // Ungültige/nicht ladbare Skin-URL - Vorschau bleibt einfach leer.
    });
  }, [skinUrl]);

  return <canvas ref={canvasRef} className="erzmark-skin-mirror" />;
}
