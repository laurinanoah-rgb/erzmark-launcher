// Leichter Ersatz fuer den vollen 3D-Skin-Mirror bei Performance-Stufe
// "reduced" (siehe performanceTier.js): statt eine komplette WebGL-Szene zu
// starten, wird nur die Skin-Textur selbst genommen und ihre Front-Ansicht
// (Kopf/Body/Arme/Beine) zu einer stehenden Figur zusammengesetzt - ein
// einzelnes 2D-Canvas-Bild, kein Rendering-Loop, keine zusaetzliche
// Bild-Quelle/CSP-Domain noetig (nutzt exakt dieselbe Skin-URL).
//
// UV-Layout nach dem modernen 64x64-Minecraft-Skinformat. Bei alten
// 64x32-Skins gibt es keine eigenen linken Arm/Bein-Faces - dort wird
// stattdessen (leicht ungenau, aber unauffaellig) die rechte Seite gespiegelt.
const HEAD = { x: 8, y: 8, w: 8, h: 8 };
const BODY = { x: 20, y: 20, w: 8, h: 12 };
const ARM_R = { x: 44, y: 20, w: 4, h: 12 };
const ARM_L_MODERN = { x: 36, y: 52, w: 4, h: 12 };
const LEG_R = { x: 4, y: 20, w: 4, h: 12 };
const LEG_L_MODERN = { x: 20, y: 52, w: 4, h: 12 };

function drawPart(ctx, image, part, dx, dy, dw, dh, mirror = false) {
  ctx.save();
  if (mirror) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(image, part.x, part.y, part.w, part.h, 0, 0, dw, dh);
  } else {
    ctx.drawImage(image, part.x, part.y, part.w, part.h, dx, dy, dw, dh);
  }
  ctx.restore();
}

/** Zeichnet die statische Paperdoll-Ansicht in ein bereits vorhandenes Canvas. */
export function drawSkinPaperDoll(canvas, image) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);

  const isModern = image.naturalHeight >= 64 || image.height >= 64;

  // Einheit "px" = wie viele Canvas-Pixel ein Skin-Pixel breit ist. Die
  // Figur ist 16 Skin-Pixel breit (Arm+Body+Arm) und 32 Skin-Pixel hoch
  // (Kopf 8 + Body/Beine je 12), mit etwas Rand.
  const unit = Math.floor(Math.min(width / 16, height / 32) * 0.85);
  if (unit < 1) return;

  const figureWidth = unit * 16;
  const figureHeight = unit * 32;
  const originX = Math.round((width - figureWidth) / 2);
  const originY = Math.round((height - figureHeight) / 2);

  const headSize = unit * 8;
  const bodyWidth = unit * 8;
  const bodyHeight = unit * 12;
  const limbWidth = unit * 4;

  const headX = originX + unit * 4;
  const headY = originY;
  drawPart(ctx, image, HEAD, headX, headY, headSize, headSize);

  const bodyX = originX + unit * 4;
  const bodyY = headY + headSize;
  drawPart(ctx, image, BODY, bodyX, bodyY, bodyWidth, bodyHeight);

  drawPart(ctx, image, ARM_R, bodyX - limbWidth, bodyY, limbWidth, bodyHeight);
  if (isModern) {
    drawPart(ctx, image, ARM_L_MODERN, bodyX + bodyWidth, bodyY, limbWidth, bodyHeight);
  } else {
    drawPart(ctx, image, ARM_R, bodyX + bodyWidth, bodyY, limbWidth, bodyHeight, true);
  }

  const legY = bodyY + bodyHeight;
  drawPart(ctx, image, LEG_R, bodyX, legY, limbWidth, bodyHeight);
  if (isModern) {
    drawPart(ctx, image, LEG_L_MODERN, bodyX + limbWidth, legY, limbWidth, bodyHeight);
  } else {
    drawPart(ctx, image, LEG_R, bodyX + limbWidth, legY, limbWidth, bodyHeight, true);
  }
}
