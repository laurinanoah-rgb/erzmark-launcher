import { useEffect, useRef } from "react";
import gsap from "gsap";
import logoUrl from "../assets/logo.png";

// Diegetische Boot-Sequenz (Launcher-Update-TODO, Abschnitt 1): ein
// Terminal-Boot-Log tippt sich zeilenweise (mit Jitter, betont langsam für
// den Kino-Terminal-Look), die getippten Buchstaben lösen sich anschließend
// aus dem Text und fliegen zu einer aus dem Logo-Alphakanal abgetasteten
// Silhouette — das Bild entsteht sichtbar "aus Wörtern". Danach löst sich
// die Buchstaben-Silhouette zum scharfen Logo auf, gefolgt von einem
// Schockwellen-Glow und einer wachsenden Masken-Iris, die den eigentlichen
// Screen dahinter freigibt. Läuft nur bei tier === "full" (siehe
// src/utils/performanceTier.js); bei "reduced" gibt es nur ein kurzes
// Logo-Fade ohne Bewegungseffekte (Stufe 1 aus der Ideensammlung).
const BOOT_LINES = [
  "> erzmark://core initialisieren…",
  "> Dateisystem einhängen…",
  "> Kartendaten laden…",
  "> Verbindung schmieden…",
  "> Authentifizierung: R.U.D.O.L.F.",
  "> Systeme online.",
];

const STAGE_SIZE = 560;
const SILHOUETTE_STEP = 4;
const ALPHA_THRESHOLD = 60;
const FONT_SIZE = 17;
const LINE_HEIGHT = 25;
const CHAR_MIN_DURATION = 0.014;
const CHAR_MAX_DURATION = 0.036;
const LINE_PAUSE = 0.09;

function sampleAlphaPoints(ctx, width, height, step, alphaThreshold) {
  const { data } = ctx.getImageData(0, 0, width, height);
  const points = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > alphaThreshold) points.push({ x, y });
    }
  }
  return points;
}

function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Feste x/y-Position jedes einzelnen Zeichens im Terminal-Textblock (Layout
// ändert sich während des Tippens nicht, nur die sichtbare Zeichenzahl) —
// dient sowohl dem Zeichnen als auch später als Startpunkt fürs Wegfliegen.
function computeCharPositions(ctx) {
  ctx.font = `${FONT_SIZE}px "Consolas", "Courier New", monospace`;
  const maxLineWidth = Math.max(...BOOT_LINES.map((l) => ctx.measureText(l).width));
  const blockLeft = STAGE_SIZE / 2 - maxLineWidth / 2;
  const startY = STAGE_SIZE / 2 - (BOOT_LINES.length * LINE_HEIGHT) / 2;

  const positions = [];
  BOOT_LINES.forEach((line, li) => {
    let x = blockLeft;
    const y = startY + li * LINE_HEIGHT;
    for (const char of line) {
      positions.push({ char, x, y, line: li });
      x += ctx.measureText(char).width;
    }
  });
  return positions;
}

export default function BootAnimation({ tier, onComplete }) {
  const canvasRef = useRef(null);
  const logoImgRef = useRef(null);
  const overlayRef = useRef(null);
  const shockwaveRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    // paused: true ist hier Pflicht, nicht Kosmetik: die Tweens kommen erst
    // asynchron dazu (Bild-Load bzw. weiter unten), eine autoplaying leere
    // Timeline hat Dauer 0 und feuert onComplete schon beim allerersten
    // GSAP-Tick — bevor überhaupt etwas angehängt wurde. tl.play() erst
    // nach dem vollständigen Aufbau aufrufen.
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        if (!cancelled) onComplete();
      },
    });

    if (tier !== "full") {
      // Stufe 1: nur ein kurzes Fade, keine Partikel/Canvas-Arbeit.
      tl.set(overlayRef.current, { opacity: 1 })
        .fromTo(logoImgRef.current, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.35, ease: "power1.out" })
        .to({}, { duration: 0.4 })
        .to(overlayRef.current, { opacity: 0, duration: 0.35, ease: "power1.in" });
      tl.play();
      return () => {
        cancelled = true;
        tl.kill();
      };
    }

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = STAGE_SIZE * dpr;
    canvas.height = STAGE_SIZE * dpr;
    canvas.style.width = `${STAGE_SIZE}px`;
    canvas.style.height = `${STAGE_SIZE}px`;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const logo = new Image();
    let loadHandled = false;

    const handleLogoLoad = () => {
      if (cancelled || loadHandled) return;
      loadHandled = true;

      // Ziel-Silhouette: Alpha-Kanal des Logos (logo3, mit echter
      // Transparenz) abtasten und auf die Stage-Größe zentriert einpassen.
      const off = document.createElement("canvas");
      off.width = STAGE_SIZE;
      off.height = STAGE_SIZE;
      const offCtx = off.getContext("2d");
      const logoScale = (STAGE_SIZE * 0.82) / Math.max(logo.width, logo.height);
      const w = logo.width * logoScale;
      const h = logo.height * logoScale;
      offCtx.drawImage(logo, (STAGE_SIZE - w) / 2, (STAGE_SIZE - h) / 2, w, h);
      const silhouettePoints = shuffle(sampleAlphaPoints(offCtx, STAGE_SIZE, STAGE_SIZE, SILHOUETTE_STEP, ALPHA_THRESHOLD));

      const charPositions = computeCharPositions(ctx);
      const totalChars = charPositions.length;
      const typeDriver = { visible: 0 };

      function drawText() {
        ctx.clearRect(0, 0, STAGE_SIZE, STAGE_SIZE);
        ctx.font = `${FONT_SIZE}px "Consolas", "Courier New", monospace`;
        ctx.textBaseline = "top";
        const visibleCount = Math.round(typeDriver.visible);
        for (let i = 0; i < visibleCount; i++) {
          const c = charPositions[i];
          ctx.fillStyle = c.line === BOOT_LINES.length - 1 ? "#ffb900" : "#42b7fa";
          ctx.fillText(c.char, c.x, c.y);
        }
        // Blinkender Cursor am Ende des zuletzt getippten Zeichens.
        if (visibleCount < totalChars && Math.floor(performance.now() / 350) % 2 === 0) {
          const cursorAt = charPositions[Math.max(0, visibleCount - 1)];
          const cx = visibleCount > 0 ? cursorAt.x + ctx.measureText(cursorAt.char).width : charPositions[0]?.x ?? STAGE_SIZE / 2;
          const cy = visibleCount > 0 ? cursorAt.y : STAGE_SIZE / 2;
          ctx.fillStyle = "#ffb900";
          ctx.fillRect(cx + 1, cy + 2, 8, FONT_SIZE - 2);
        }
      }

      // Tippen mit Jitter statt gleichförmigem Tempo: jedes Zeichen bekommt
      // eine eigene, leicht zufällige Dauer, an Zeilenenden eine kleine
      // Atempause — fühlt sich an wie echtes Terminal-Tippen, nicht wie ein
      // linearer Balken.
      tl.set(overlayRef.current, { opacity: 1 });
      BOOT_LINES.forEach((line, li) => {
        for (let i = 0; i < line.length; i++) {
          tl.to(typeDriver, {
            visible: "+=1",
            duration: gsap.utils.random(CHAR_MIN_DURATION, CHAR_MAX_DURATION),
            ease: "none",
            onUpdate: drawText,
          });
        }
        if (li < BOOT_LINES.length - 1) tl.to({}, { duration: LINE_PAUSE });
      });

      let flyers = null;
      function drawFlyers(progress) {
        ctx.clearRect(0, 0, STAGE_SIZE, STAGE_SIZE);
        ctx.font = `${FONT_SIZE}px "Consolas", "Courier New", monospace`;
        ctx.textBaseline = "top";
        flyers.forEach((f) => {
          const x = f.sx + (f.tx - f.sx) * progress;
          const y = f.sy + (f.ty - f.sy) * progress;
          ctx.fillStyle = progress < 0.5 ? "#42b7fa" : "#ffb900";
          ctx.fillText(f.char, x, y);
        });
      }

      tl.to({}, { duration: 0.35 }) // letzter Cursor-Blink, bevor die Wörter losfliegen
        .call(() => {
          const flyable = charPositions.filter((c) => c.char !== " ");
          flyers = flyable.map((c, i) => {
            const t = silhouettePoints[i % silhouettePoints.length];
            return { char: c.char, sx: c.x, sy: c.y, tx: t.x, ty: t.y };
          });
        })
        .to(
          {},
          {
            duration: 1.3,
            ease: "power2.inOut",
            onUpdate: function () {
              drawFlyers(this.progress());
            },
          }
        )
        .to({}, { duration: 0.15 }) // kurzer Moment: Bild steht komplett aus Buchstaben da
        .to(canvasRef.current, { opacity: 0, duration: 0.45, ease: "power1.in" }, "resolve")
        .fromTo(
          logoImgRef.current,
          { opacity: 0, scale: 0.93 },
          { opacity: 1, scale: 1, duration: 0.5, ease: "power1.out" },
          "resolve"
        )
        .to({}, { duration: 0.3 });

      // Episches Finale: Schockwellen-Glow vom Logo aus + wachsende
      // Masken-Iris, die den dahinterliegenden Screen (Login/Start, schon
      // fertig gerendert) freigibt. Kein einfaches Fade mehr.
      tl.add("reveal")
        .set(shockwaveRef.current, { opacity: 1, scale: 0.2 })
        .to(shockwaveRef.current, { scale: 7, opacity: 0, duration: 0.8, ease: "power2.out" }, "reveal")
        .to(logoImgRef.current, { scale: 1.18, opacity: 0, duration: 0.6, ease: "power1.in" }, "reveal+=0.1")
        .to(
          { r: 190 },
          {
            r: () => {
              const rect = overlayRef.current.getBoundingClientRect();
              return Math.hypot(rect.width, rect.height) / 2 + 40;
            },
            duration: 0.85,
            ease: "power2.in",
            onUpdate: function () {
              const r = this.targets()[0].r;
              const mask = `radial-gradient(circle at 50% 50%, transparent ${r}px, black ${r + 50}px)`;
              overlayRef.current.style.maskImage = mask;
              overlayRef.current.style.webkitMaskImage = mask;
            },
          },
          "reveal+=0.05"
        );

      tl.play();
    };

    // .onload muss vor .src gesetzt werden — sonst kann bei einem bereits
    // gecachten Bild das load-Event feuern, bevor der Handler registriert
    // ist, und die Timeline bleibt leer (schließt sofort, ohne je etwas
    // anzuzeigen). logo.complete deckt den Fall zusätzlich ab, in dem das
    // Bild schon vor der Zuweisung von .onload synchron fertig ist.
    logo.onload = handleLogoLoad;
    logo.src = logoUrl;
    if (logo.complete) handleLogoLoad();

    return () => {
      cancelled = true;
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  return (
    <div ref={overlayRef} className="erzmark-boot-overlay" style={{ opacity: 0 }}>
      <div className="erzmark-boot-stage">
        {tier === "full" && <canvas ref={canvasRef} className="erzmark-boot-canvas" />}
        {tier === "full" && <div ref={shockwaveRef} className="erzmark-boot-shockwave" style={{ opacity: 0 }} />}
        <img ref={logoImgRef} src={logoUrl} alt="Erzmark" className="erzmark-boot-logo" style={{ opacity: 0 }} />
      </div>
    </div>
  );
}
