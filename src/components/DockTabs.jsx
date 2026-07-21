import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { getPerformanceTier } from "../utils/performanceTier.js";
import { signalTabHover } from "../state/skinMirrorMood.js";

/**
 * Gemeinsame Tab-Chrome für die Dock-Widgets (Freunde/Gilde/Karte links,
 * Neuigkeiten/Spielstände/Galerie rechts, siehe SocialDock.jsx/SidebarDock.jsx)
 * – Launcher-Update-TODO, Abschnitt 1, "Tab-Wechsel": ein gleitender
 * Indikator statt hartem Aktiv-Zustand, ein dezenter Content-Crossfade beim
 * Wechsel statt hartem Remount, und eine leichte Farbverschiebung im Panel
 * je nach Tab-Thema (tabs[].color: "blue" | "gold" | "green"). Bei Stufe
 * "reduced" nur ein direkter Zustandswechsel ohne Bewegung, siehe
 * src/utils/performanceTier.js.
 */
export default function DockTabs({ tabs }) {
  const [active, setActive] = useState(tabs[0].id);
  const [displayed, setDisplayed] = useState(tabs[0].id);
  const railRef = useRef(null);
  const indicatorRef = useRef(null);
  const panelRef = useRef(null);
  const tierRef = useRef(getPerformanceTier());
  const indicatorMounted = useRef(false);
  const panelMounted = useRef(false);

  // Indikator zur aktiven Tab-Position gleiten lassen.
  useEffect(() => {
    const btn = railRef.current?.querySelector(`[data-tab-id="${active}"]`);
    if (!btn || !indicatorRef.current) return;
    const { offsetLeft, offsetWidth } = btn;

    if (!indicatorMounted.current || tierRef.current !== "full") {
      indicatorMounted.current = true;
      gsap.set(indicatorRef.current, { x: offsetLeft, width: offsetWidth });
      return;
    }
    gsap.to(indicatorRef.current, {
      x: offsetLeft,
      width: offsetWidth,
      duration: 0.5,
      ease: "elastic.out(1, 0.75)",
    });
  }, [active]);

  // Altes Panel ausblenden, dann erst den Inhalt wechseln (kein hartes Cut).
  useEffect(() => {
    if (!panelMounted.current) {
      panelMounted.current = true;
      setDisplayed(active);
      return;
    }
    if (tierRef.current !== "full") {
      setDisplayed(active);
      return;
    }
    const tl = gsap.timeline();
    tl.to(panelRef.current, { opacity: 0, y: 6, duration: 0.12, ease: "power1.in" }).call(() => setDisplayed(active));
    return () => tl.kill();
  }, [active]);

  // Neuen Inhalt einblenden, sobald er gerendert ist.
  useEffect(() => {
    if (tierRef.current !== "full") {
      gsap.set(panelRef.current, { opacity: 1, y: 0 });
      return;
    }
    gsap.fromTo(panelRef.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" });
  }, [displayed]);

  const shownTab = tabs.find((t) => t.id === displayed) ?? tabs[0];

  return (
    <div className={`erzmark-dock erzmark-dock-tint-${shownTab.color ?? "gold"}`}>
      <nav className="erzmark-dock-rail" ref={railRef} aria-label="Widget-Auswahl">
        <div ref={indicatorRef} className="erzmark-dock-indicator" aria-hidden="true" />
        {tabs.map(({ id, label, Icon, badge }) => (
          <button
            key={id}
            type="button"
            data-tab-id={id}
            className={`erzmark-dock-tab${active === id ? " is-active" : ""}`}
            onClick={() => setActive(id)}
            onMouseEnter={signalTabHover}
            title={label}
            aria-label={label}
            aria-pressed={active === id}
          >
            <Icon />
            <span className="erzmark-dock-tab-label">{label}</span>
            {badge ? <span className="erzmark-dock-tab-badge">{badge}</span> : null}
          </button>
        ))}
      </nav>

      <div className="erzmark-dock-panel" ref={panelRef}>
        {shownTab.content}
      </div>
    </div>
  );
}
