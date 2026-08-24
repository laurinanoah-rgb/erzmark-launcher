import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import logoUrl from "../assets/logo.png";

const RITUAL_STEPS = ["Siegel erkennen", "Weltenpfad binden", "Tor nach Erzmark öffnen"];
const RUNES = ["ᚨ", "ᚱ", "ᛉ", "ᛏ", "ᛖ", "ᛗ", "ᚲ", "ᛞ", "ᚾ", "ᛟ", "ᛇ", "ᛃ"];

/**
 * Kurzes, diegetisches Portalritual. Seine Geometrie kommt über `profile`
 * direkt aus derselben 16:9-/21:9-Erkennung wie der Launcher. Auf schwachen
 * Geräten und bei reduzierter Bewegung bleibt nur das ruhige Siegel-Fade.
 */
export default function BootAnimation({ tier, profile = "16:9", reduceMotion = false, onComplete }) {
  const overlayRef = useRef(null);
  const sigilRef = useRef(null);
  const gateRef = useRef(null);
  const lineRef = useRef(null);
  const copyRef = useRef(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) onComplete();
    };
    const quiet = tier !== "full" || reduceMotion;
    const context = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: finish });
      if (quiet) {
        tl.set(overlayRef.current, { opacity: 1 })
          .fromTo(sigilRef.current, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.28, ease: "power1.out" })
          .to({}, { duration: 0.25 })
          .to(overlayRef.current, { opacity: 0, duration: 0.3, ease: "power1.in" });
        return;
      }

      tl.set(overlayRef.current, { opacity: 1 })
        .fromTo(gateRef.current, { opacity: 0, scale: 0.72, rotate: -8 }, { opacity: 1, scale: 1, rotate: 0, duration: 0.65, ease: "back.out(1.35)" })
        .fromTo(sigilRef.current, { opacity: 0, scale: 0.72 }, { opacity: 1, scale: 1, duration: 0.48, ease: "back.out(1.5)" }, "-=0.36")
        .fromTo(copyRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35 }, "-=0.2")
        .call(() => setStep(1))
        .to(lineRef.current, { scaleX: 0.62, duration: 0.52, ease: "power2.inOut" })
        .call(() => setStep(2))
        .to(lineRef.current, { scaleX: 1, duration: 0.48, ease: "power2.inOut" })
        .to({}, { duration: 0.16 })
        .add("open")
        .to(gateRef.current, { scale: profile === "21:9" ? 4.8 : 4.2, opacity: 0, duration: 0.78, ease: "power3.in" }, "open")
        .to(sigilRef.current, { scale: 1.18, opacity: 0, duration: 0.48, ease: "power2.in" }, "open+=0.08")
        .to(copyRef.current, { y: -12, opacity: 0, duration: 0.3 }, "open")
        .to(overlayRef.current, { opacity: 0, duration: 0.56, ease: "power2.out" }, "open+=0.28");
    }, overlayRef);

    return () => {
      cancelled = true;
      context.revert();
    };
  }, [tier, profile, reduceMotion, onComplete]);

  return (
    <div ref={overlayRef} className={`erzmark-boot-overlay is-${profile.replace(":", "-")}`} data-quiet={tier !== "full" || reduceMotion ? "true" : "false"}>
      <div className="erzmark-boot-atmosphere" aria-hidden="true"><i /><i /><i /></div>
      <div ref={gateRef} className="erzmark-boot-gate" aria-hidden="true">
        <span className="erzmark-boot-gate-ring is-outer" />
        <span className="erzmark-boot-gate-ring is-inner" />
        <span className="erzmark-boot-runes">
          {RUNES.map((rune, index) => <i key={`${rune}-${index}`} style={{ "--boot-rune": index }}>{rune}</i>)}
        </span>
      </div>
      <div className="erzmark-boot-stage">
        <div ref={sigilRef} className="erzmark-boot-sigil">
          <span className="erzmark-boot-sigil-glow" aria-hidden="true" />
          <img src={logoUrl} alt="Erzmark" className="erzmark-boot-logo" />
        </div>
        <div ref={copyRef} className="erzmark-boot-copy" role="status" aria-live="polite">
          <small>{profile === "21:9" ? "Breitwand-Ritual · 21:9" : "Portal-Ritual · 16:9"}</small>
          <strong>Erzmark erwacht</strong>
          <span>{RITUAL_STEPS[step]}</span>
          <div className="erzmark-boot-progress" aria-hidden="true"><i ref={lineRef} /></div>
        </div>
      </div>
      <span className="erzmark-boot-oath" aria-hidden="true">Wo Wege enden, beginnt Erzmark.</span>
    </div>
  );
}
