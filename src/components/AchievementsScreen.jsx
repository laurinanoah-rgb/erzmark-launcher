import { Component, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { getStats, getAchievements, subscribeNewUnlock, acknowledgeJustUnlocked } from "../api/achievements.js";
import { getPerformanceTier } from "../utils/performanceTier.js";
import { playUnlockSound, playCounterTick } from "../utils/achievementSounds.js";

// Kategorien statt Bronze/Silber/Gold/Legendär (Nutzer-Feedback): jede
// Kategorie ist eine eigene, radial vom Zentrum abzweigende Fortschritts-
// Kette mit eigener Akzentfarbe + Hub-Icon.
const CATEGORY_META = {
  milestones: { label: "Meilensteine", color: "#ff9a3c", icon: "⚔️", angle: -135 },
  gaming: { label: "Gaming", color: "#ffb900", icon: "⏳", angle: -45 },
  social: { label: "Sozial", color: "#42b7fa", icon: "🤝", angle: 45 },
  discovery: { label: "Entdeckung & Geheimnisse", color: "#b96bff", icon: "🧭", angle: 135 },
};
const CATEGORY_ORDER = ["milestones", "gaming", "social", "discovery"];

const HUB_RADIUS = 190;
const LEAF_STEP = 130;
const LEAF_SPREAD_DEG = 34;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.7;

const COOLING_THRESHOLD_DAYS = 3;
const COUNT_UP_DURATION_MS = 1200;

const ARROW_DIRECTIONS = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
};

function formatPlayTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatUnlockDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

function daysSince(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function polarToXY(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
}

/** Zählt beim Erscheinen von 0 auf `target` hoch, mit gelegentlichem
 * Tick-Callback (für den Sound) statt bei jedem Frame. */
function useCountUp(target, active) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active || target == null) {
      return;
    }
    let raf;
    let lastTick = 0;
    const start = performance.now();
    function step(now) {
      const p = Math.min(1, (now - start) / COUNT_UP_DURATION_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (now - lastTick > 140 && p < 1) {
        lastTick = now;
        playCounterTick();
      }
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, target]);
  return value;
}

/** Baut das radiale Baum-Layout: ein Zentrum ("Gesamtfortschritt"), 4
 * Kategorie-Hubs im Kreis darum, und je Kategorie eine nach außen
 * verzweigende Fortschritts-Kette (Punkt 1 -> 2 -> 3 -> ...). */
function useForgeLayout(achievements) {
  return useMemo(() => {
    const byCategory = new Map(CATEGORY_ORDER.map((k) => [k, []]));
    for (const a of achievements ?? []) {
      if (!byCategory.has(a.category)) byCategory.set(a.category, []);
      byCategory.get(a.category).push(a);
    }
    for (const list of byCategory.values()) list.sort((a, b) => a.step - b.step);

    const hubs = [];
    const nodes = [];
    const edges = [];
    const trunkEdges = [];

    for (const key of CATEGORY_ORDER) {
      const meta = CATEGORY_META[key];
      const hubPos = polarToXY(meta.angle, HUB_RADIUS);
      const list = byCategory.get(key) ?? [];
      const n = list.length;
      const spreadStep = n > 1 ? LEAF_SPREAD_DEG / (n - 1) : 0;

      let prev = hubPos;
      list.forEach((a, i) => {
        const jitter = (i - (n - 1) / 2) * spreadStep;
        const angle = meta.angle + jitter;
        const radius = HUB_RADIUS + (i + 1) * LEAF_STEP;
        const pos = polarToXY(angle, radius);
        nodes.push({ ...a, x: pos.x, y: pos.y, color: meta.color });
        edges.push({
          id: `${a.id}-edge`,
          x1: prev.x,
          y1: prev.y,
          x2: pos.x,
          y2: pos.y,
          bend: i % 2 === 0 ? 24 : -24,
          color: meta.color,
          percent: a.unlocked ? 100 : a.progressPercent ?? 0,
        });
        prev = pos;
      });

      const avg = n ? Math.round(list.reduce((sum, a) => sum + (a.unlocked ? 100 : a.progressPercent ?? 0), 0) / n) : 0;
      hubs.push({ key, ...meta, x: hubPos.x, y: hubPos.y });
      trunkEdges.push({ id: `trunk-${key}`, x1: 0, y1: 0, x2: hubPos.x, y2: hubPos.y, bend: 0, color: meta.color, percent: avg });
    }

    const total = achievements?.length ?? 0;
    const overallPercent = total
      ? Math.round(achievements.reduce((sum, a) => sum + (a.unlocked ? 100 : a.progressPercent ?? 0), 0) / total)
      : 0;

    return { hubs, nodes, edges: [...trunkEdges, ...edges], overallPercent };
  }, [achievements]);
}

/** Gesamtspielzeit, zentriert am unteren Rand der Seite. */
function ForgeFooterStats({ stats }) {
  const playTime = useCountUp(stats?.playTimeSeconds ?? null, stats != null);
  if (!stats) return null;

  return (
    <div className="erzmark-forge-footer">
      <div className="erzmark-ach-playtime">
        <span className="erzmark-ach-playtime-value">{formatPlayTime(playTime)}</span>
        <span className="erzmark-ach-playtime-label">Gesamtspielzeit</span>
      </div>
    </div>
  );
}

/** Schwebendes Inspector-Panel oben links über dem Canvas: das ausgewählte
 * Achievement als greifbares, geglühtes Objekt statt eines abgehakten
 * Listenpunkts. */
function ForgeSpotlight({ achievement, forging, onView }) {
  useEffect(() => {
    if (!achievement?.justUnlocked) return;
    onView(achievement.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievement?.id, achievement?.justUnlocked]);

  if (!achievement) {
    return (
      <div className="erzmark-forge-spotlight erzmark-forge-spotlight-empty">
        <p className="erzmark-hint">Wähle einen Erfolg im Baum.</p>
      </div>
    );
  }

  const isSecret = !achievement.unlocked && achievement.description.startsWith("???");
  const cooling = achievement.unlocked && daysSince(achievement.unlockedAt) < COOLING_THRESHOLD_DAYS;

  return (
    <div
      className={["erzmark-forge-spotlight", achievement.unlocked ? "is-unlocked" : "is-locked", cooling ? "is-cooling" : "", forging ? "is-forging" : ""]
        .filter(Boolean)
        .join(" ")}
      style={{ "--cat": CATEGORY_META[achievement.category]?.color }}
    >
      <div className="erzmark-forge-medallion">
        {forging && (
          <div className="erzmark-ach-forge-sparks" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} style={{ "--i": i }} />
            ))}
          </div>
        )}
        <span className="erzmark-forge-medallion-icon">{achievement.unlocked ? achievement.icon : isSecret ? "🔒" : achievement.icon}</span>
      </div>

      <span className="erzmark-forge-flag">{forging ? "Neu geschmiedet!" : achievement.unlocked ? CATEGORY_META[achievement.category]?.label : "Noch nicht geschmiedet"}</span>
      <h3 className="erzmark-forge-title">{isSecret ? "???" : achievement.title}</h3>
      {!isSecret && <p className="erzmark-forge-desc">{achievement.description}</p>}

      {achievement.unlocked ? (
        <div className="erzmark-forge-meta">
          <span className="erzmark-forge-meta-date">Freigeschaltet am {formatUnlockDate(achievement.unlockedAt)}</span>
          {achievement.contextSentence && <span className="erzmark-forge-meta-context">„{achievement.contextSentence}“</span>}
          <span className="erzmark-forge-meta-percent">🌍 {achievement.percentUnlocked}% der Spieler haben das auch erreicht</span>
        </div>
      ) : (
        <div className="erzmark-forge-meta">
          <span className="erzmark-forge-meta-percent">🌍 {achievement.percentUnlocked}% der Spieler haben das schon erreicht</span>
          {!isSecret && <span className="erzmark-forge-meta-progress">🔥 {achievement.progressPercent}% auf dem Weg zur Freischaltung</span>}
        </div>
      )}
    </div>
  );
}

function edgePathD(edge) {
  const { x1, y1, x2, y2 } = edge;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cpx = mx + nx * edge.bend;
  const cpy = my + ny * edge.bend;
  return { d: `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`, len: len * 1.08 };
}

/** Ast-Verbindung: glüht stufenweise (1/4 bis ganz) je nach Fortschritt zum
 * nächsten Erfolg, statt einer immer gleich hellen Linie. */
function ForgeEdgePath({ edge }) {
  const { d, len } = edgePathD(edge);
  const quantized = Math.max(0, Math.min(100, Math.floor((edge.percent ?? 0) / 25) * 25));
  const fillLen = (len * quantized) / 100;
  return (
    <g>
      <path d={d} className="erzmark-forge-edge-base" />
      {quantized > 0 && (
        <path d={d} className="erzmark-forge-edge-fill-path" style={{ stroke: edge.color, strokeDasharray: `${fillLen} ${len}` }} />
      )}
    </g>
  );
}

function ForgeCanvasNode({ achievement, selectedId, onSelect }) {
  const isSecret = !achievement.unlocked && achievement.description.startsWith("???");
  const cooling = achievement.unlocked && daysSince(achievement.unlockedAt) < COOLING_THRESHOLD_DAYS;

  return (
    <button
      type="button"
      className={[
        "erzmark-forge-node",
        achievement.unlocked ? "is-unlocked" : "is-locked",
        cooling ? "is-cooling" : "",
        achievement.id === selectedId ? "is-selected" : "",
        achievement.justUnlocked ? "is-fresh" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ left: `${achievement.x}px`, top: `${achievement.y}px`, "--cat": achievement.color }}
      onClick={() => onSelect(achievement.id)}
      onFocus={() => onSelect(achievement.id)}
      title={isSecret ? "???" : achievement.title}
      data-node-id={achievement.id}
    >
      <span className="erzmark-forge-node-icon">{achievement.unlocked ? achievement.icon : isSecret ? "🔒" : achievement.icon}</span>
      {achievement.justUnlocked && <span className="erzmark-forge-node-ping" aria-hidden="true" />}
    </button>
  );
}

function ForgeCategoryHub({ hub }) {
  return (
    <div className="erzmark-forge-hub" style={{ left: `${hub.x}px`, top: `${hub.y}px`, "--cat": hub.color }}>
      <span className="erzmark-forge-hub-icon">{hub.icon}</span>
      <span className="erzmark-forge-hub-label">{hub.label}</span>
    </div>
  );
}

function ForgeCenterHub({ percent }) {
  const r = 44;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="erzmark-forge-center-hub">
      <svg width="100" height="100" viewBox="0 0 100 100" className="erzmark-forge-center-ring">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--erzmark-color-gold)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="erzmark-forge-center-hub-text">
        <span className="erzmark-forge-center-hub-value">{percent}%</span>
        <span className="erzmark-forge-center-hub-label">Gesamtfortschritt</span>
      </div>
    </div>
  );
}

const MINIMAP_SIZE = 160;
const MINIMAP_PADDING = 16;

/** Übersicht-Ecke: zeigt den ganzen Baum verkleinert + ein Rahmen, welcher
 * Ausschnitt gerade sichtbar ist - hilfreich, wenn man sich beim Pannen/
 * Zoomen verirrt hat. Klick springt direkt an die entsprechende Stelle. */
function ForgeMinimap({ nodes, hubs, view, viewportW, viewportH, onJump }) {
  const maxRadius = Math.max(50, ...nodes.map((n) => Math.hypot(n.x, n.y)), ...hubs.map((h) => Math.hypot(h.x, h.y)));
  const scale = (MINIMAP_SIZE / 2 - MINIMAP_PADDING) / maxRadius;
  const half = MINIMAP_SIZE / 2;

  // Die Baum-Mitte fließt beim Rendern des Canvas mit in den Transform ein
  // (siehe ForgeCanvas: `translate(center.cx + view.x, ...)`), muss hier
  // also mit eingerechnet werden, sonst driftet der Sichtfeld-Rahmen vom
  // tatsächlich sichtbaren Ausschnitt weg (Nutzer-Feedback: "Mini-Map passt
  // nicht überein").
  const worldLeft = -(viewportW / 2 + view.x) / view.scale;
  const worldTop = -(viewportH / 2 + view.y) / view.scale;
  const rectLeft = half + worldLeft * scale;
  const rectTop = half + worldTop * scale;
  const rectW = (viewportW / view.scale) * scale;
  const rectH = (viewportH / view.scale) * scale;

  function handleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - half) / scale;
    const worldY = (e.clientY - rect.top - half) / scale;
    onJump(worldX, worldY);
  }

  return (
    <div className="erzmark-forge-minimap" style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }} onClick={handleClick}>
      {hubs.map((h) => (
        <span key={h.key} className="erzmark-forge-minimap-hub" style={{ left: half + h.x * scale, top: half + h.y * scale, "--cat": h.color }} />
      ))}
      {nodes.map((n) => (
        <span
          key={n.id}
          className={`erzmark-forge-minimap-node${n.unlocked ? " is-unlocked" : ""}`}
          style={{ left: half + n.x * scale, top: half + n.y * scale, "--cat": n.color }}
        />
      ))}
      <div
        className="erzmark-forge-minimap-viewport"
        style={{
          left: `${Math.max(0, rectLeft)}px`,
          top: `${Math.max(0, rectTop)}px`,
          width: `${Math.min(MINIMAP_SIZE, rectLeft + rectW) - Math.max(0, rectLeft)}px`,
          height: `${Math.min(MINIMAP_SIZE, rectTop + rectH) - Math.max(0, rectTop)}px`,
        }}
      />
    </div>
  );
}

/** Pannbares/zoombares Canvas mit dem radialen Schmiede-Baum - per
 * gedrückter linker Maustaste verschieben, Mausrad zum Zoomen (Nutzer-
 * Feedback: "wie im Referenzbild", zu groß für eine feste Seite). Startet
 * eingepasst auf den ganzen Baum, damit man erst den Überblick hat. */
function ForgeCanvas({ achievements, selectedId, onSelect }) {
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const didFit = useRef(false);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [center, setCenter] = useState({ cx: 0, cy: 0 });
  const [dragging, setDragging] = useState(false);

  const { hubs, nodes, edges, overallPercent } = useForgeLayout(achievements);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function measure() {
      const rect = el.getBoundingClientRect();
      setCenter({ cx: rect.width / 2, cy: rect.height / 2 });
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function fitToView() {
    if (!center.cx || nodes.length === 0) return;
    const maxRadius = Math.max(50, ...nodes.map((n) => Math.hypot(n.x, n.y)), ...hubs.map((h) => Math.hypot(h.x, h.y)));
    const fit = Math.min(center.cx, center.cy) / (maxRadius + 70);
    setView({ x: 0, y: 0, scale: Math.min(1, fit) });
  }

  // Springt aus der Mini-Map an eine bestimmte Welt-Koordinate - der
  // Klickpunkt landet dabei in der Mitte des sichtbaren Bereichs (die
  // Zentrierung selbst passiert im Transform, siehe unten - hier reicht der
  // reine Zoom-Anteil).
  function jumpTo(worldX, worldY) {
    setView((prev) => ({ ...prev, x: -prev.scale * worldX, y: -prev.scale * worldY }));
  }

  useEffect(() => {
    if (didFit.current || !center.cx || nodes.length === 0) return;
    fitToView();
    didFit.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center, nodes, hubs]);

  function onPointerDown(e) {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: view.x, originY: view.y, moved: false };
    setDragging(true);
  }

  useEffect(() => {
    function onMove(e) {
      // Lokale Kopie statt `dragRef.current` innerhalb des setState-Updaters
      // zu lesen: React kann den Updater verzögert ausführen (z. B. bei
      // gebündelten Events), und wenn `onUp` den Ref zwischenzeitlich auf
      // null setzt, crasht sonst "Cannot read properties of null" - genau
      // der gemeldete Absturz beim schnellen Ziehen/Loslassen.
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      setView((prev) => ({ ...prev, x: drag.originX + dx, y: drag.originY + dy }));
    }
    function onUp() {
      dragRef.current = null;
      setDragging(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // React registriert JSX-`onWheel`-Handler als passiven Listener - ein
  // `e.preventDefault()` darin ist ein bekannter React-Fallstrick (löst je
  // nach Engine einen Fehler/Absturz aus, siehe Nutzer-Feedback "nach ca 10
  // Sekunden alles weg"). Deshalb hier ein echter, nicht-passiver
  // `addEventListener` statt der JSX-Prop.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function handleWheel(e) {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      // Cursor-Position relativ zur Baum-Mitte (nicht zur Fenster-Ecke) - die
      // Mitte wird beim Rendern in den Transform eingerechnet (siehe unten),
      // die Zoom-Mathematik muss das hier genauso berücksichtigen, sonst
      // "springt" der Zoom-Punkt (siehe Nutzer-Feedback zur Mini-Map, gleiche
      // Ursache: Baum-Mitte und Transform-Ursprung liefen auseinander).
      const ux = e.clientX - rect.left - center.cx;
      const uy = e.clientY - rect.top - center.cy;
      setView((prev) => {
        const factor = Math.exp(-e.deltaY * 0.0012);
        const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.scale * factor));
        const ratio = nextScale / prev.scale;
        return { scale: nextScale, x: ux - (ux - prev.x) * ratio, y: uy - (uy - prev.y) * ratio };
      });
    }
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [center.cx, center.cy]);

  // Pfeiltasten springen zum nächstgelegenen Knoten in die gedrückte
  // Richtung (Tab/Enter funktionieren bereits nativ, da Knoten echte
  // <button>-Elemente sind). Als globaler `window`-Listener statt als
  // React-`onKeyDown`-Prop auf dem Canvas-Div: keydown bubbelt nur vom
  // aktuell fokussierten Element - ohne vorheriges Klicken/Tabben in den
  // Baum hätte das Div nie den Fokus und die Pfeiltasten hätten nie
  // ausgelöst (Nutzer-Feedback: "Tastatur-Funktion klappt nicht"). Fällt
  // auf den ausgewählten Knoten zurück, falls (noch) nichts fokussiert ist.
  useEffect(() => {
    function onKeyDown(e) {
      const dir = ARROW_DIRECTIONS[e.key];
      if (!dir) return;
      const activeId = document.activeElement?.dataset?.nodeId;
      const current = nodes.find((n) => n.id === (activeId ?? selectedId));
      if (!current) return;
      e.preventDefault();

      let best = null;
      let bestScore = Infinity;
      for (const n of nodes) {
        if (n.id === current.id) continue;
        const dx = n.x - current.x;
        const dy = n.y - current.y;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) continue;
        const dot = (dx * dir.dx + dy * dir.dy) / dist;
        if (dot <= 0.3) continue;
        const score = dist / dot;
        if (score < bestScore) {
          bestScore = score;
          best = n;
        }
      }
      if (!best) return;
      onSelect(best.id);
      viewportRef.current?.querySelector(`[data-node-id="${best.id}"]`)?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nodes, selectedId, onSelect]);

  return (
    <div ref={viewportRef} className={`erzmark-forge-canvas-viewport${dragging ? " is-dragging" : ""}`} onMouseDown={onPointerDown}>
      <div
        className="erzmark-forge-canvas-world"
        style={{ transform: `translate(${center.cx + view.x}px, ${center.cy + view.y}px) scale(${view.scale})` }}
      >
        <svg className="erzmark-forge-canvas-svg">
          {edges.map((e) => (
            <ForgeEdgePath key={e.id} edge={e} />
          ))}
        </svg>
        <ForgeCenterHub percent={overallPercent} />
        {hubs.map((h) => (
          <ForgeCategoryHub key={h.key} hub={h} />
        ))}
        {nodes.map((n) => (
          <ForgeCanvasNode key={n.id} achievement={n} selectedId={selectedId} onSelect={onSelect} />
        ))}
      </div>

      <button
        type="button"
        className="erzmark-forge-recenter"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={fitToView}
        title="Ansicht zurücksetzen"
        aria-label="Baum wieder ganz anzeigen"
      >
        ⟲
      </button>

      {center.cx > 0 && (
        <div className="erzmark-forge-minimap-wrap" onMouseDown={(e) => e.stopPropagation()}>
          <ForgeMinimap nodes={nodes} hubs={hubs} view={view} viewportW={center.cx * 2} viewportH={center.cy * 2} onJump={jumpTo} />
        </div>
      )}
    </div>
  );
}

/** Fängt Abstürze im Baum/Canvas ab, statt dass ein unbehandelter Fehler
 * die komplette App entfernt (React entfernt ohne Boundary den gesamten
 * Baum bis zur Wurzel - siehe Nutzer-Feedback "alles weg, kann nicht mehr
 * zurück"). Die Titelzeile mit dem Schließen-Kreuz liegt bewusst außerhalb
 * dieser Boundary, damit man immer zurück zum Launcher kommt. */
class ForgeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    console.error("Die Schmiede ist abgestürzt:", error, info);
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="erzmark-forge-crash">
          <p>Die Schmiede ist gerade abgestürzt.</p>
          <p className="erzmark-hint">Über das ✕ oben rechts kommst du zurück zum Launcher.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function ForgePage({ stats, achievements, selectedId, onSelect, onView, playerName, forgingId }) {
  if (!achievements) return <p className="erzmark-hint">Lädt…</p>;
  const selected = achievements.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="erzmark-forge-page">
      <div className="erzmark-forge-embers" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ "--i": i }} />
        ))}
      </div>

      <div className="erzmark-forge-header">
        <h3>Deine geschmiedeten Pfade der Erfolge</h3>
        {playerName && <span className="erzmark-forge-player">{playerName}</span>}
      </div>

      <div className="erzmark-forge-canvas-area">
        <ForgeSpotlight achievement={selected} forging={selected?.id === forgingId} onView={onView} />
        <ForgeCanvas achievements={achievements} selectedId={selectedId} onSelect={onSelect} />
      </div>

      <ForgeFooterStats stats={stats} />

      <span className="erzmark-forge-sparkle" aria-hidden="true">
        ✦
      </span>
    </div>
  );
}

/** Freischalt-Feier: Pop-up mit Glückwunsch-Text und "Belohnung" (ein
 * größeres, geglühtes Medaillon des Achievement-Icons als Abzeichen -
 * kein eigenes Sticker-Bild-Asset nötig, nutzt dieselbe Schmiede-Optik wie
 * das Spotlight-Medaillon). */
function ForgeUnlockPopup({ achievement, onDismiss }) {
  useEffect(() => {
    playUnlockSound(achievement.category);
    const t = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievement.id]);

  return (
    <div className="erzmark-unlock-backdrop" onClick={onDismiss}>
      <div
        className="erzmark-unlock-popup erzmark-forge-spotlight is-unlocked is-forging"
        style={{ "--cat": CATEGORY_META[achievement.category]?.color }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="erzmark-unlock-kicker">Glückwunsch, ein neuer Erfolg wurde geschmiedet!</span>
        <div className="erzmark-forge-medallion">
          <div className="erzmark-ach-forge-sparks" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} style={{ "--i": i }} />
            ))}
          </div>
          <span className="erzmark-forge-medallion-icon">{achievement.icon}</span>
        </div>
        <h3 className="erzmark-forge-title">{achievement.title}</h3>
        <p className="erzmark-forge-desc">{achievement.description}</p>
        <span className="erzmark-unlock-reward">🏅 Abzeichen „{achievement.title}“ erhalten</span>
        <button type="button" className="erzmark-unlock-dismiss" onClick={onDismiss}>
          Weiter
        </button>
      </div>
    </div>
  );
}

/**
 * "Die Schmiede" - eine einzige Seite mit radialem Skilltree (4 Kategorien
 * als Fortschritts-Ketten statt Bronze/Silber/Gold/Legendär) + Spielzeit-
 * Fußzeile (Launcher-Update-TODO, Abschnitt 3). Datenquelle ist bewusst
 * noch die Mock-API (siehe api/achievements.js) - ein echter Endpunkt kann
 * später 1:1 eingesetzt werden.
 *
 * Aufruf ausschließlich über den ausgeblendeten Buch-Tab am rechten
 * Fensterrand (siehe erzmark-edge-book-tab in MainScreen.jsx). Das Panel
 * füllt das komplette Launcher-Fenster (kein Pop-up).
 *
 * Der Baum ist ein pannbares/zoombares Canvas (linke Maustaste gedrückt
 * halten zum Verschieben, Mausrad zum Zoomen) statt fester Zeilen - bei
 * vielen Erfolgen zu groß für eine statische Seite. Startet eingepasst auf
 * den gesamten Baum (Nutzer-Feedback: erst Überblick, dann gezielt zoomen).
 *
 * "Schmiede-Riss": Öffnen/Schließen des ganzen Fensters lief anfangs über
 * einen 3D-`rotateY`-Hinge über die volle Fensterfläche - das hat bei so
 * einer großen Fläche perspektivisch verzerrt und wirkte "komisch" (Nutzer-
 * Feedback). Stattdessen jetzt ein Riss aus glühendem Licht, der vom
 * Kanten-Tab aus über den Bildschirm bricht. Bei Performance-Stufe
 * "reduced": einfacher Opacity-Crossfade ohne Riss.
 */
export default function AchievementsScreen({ onClose, playerName }) {
  const tierRef = useRef(getPerformanceTier());
  const tier = tierRef.current;
  const [stats, setStats] = useState(null);
  const [achievements, setAchievements] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [forgingId, setForgingId] = useState(null);
  const [celebrating, setCelebrating] = useState(null);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef(null);
  const crackRef = useRef(null);
  const crackLineRef = useRef(null);

  useEffect(() => {
    Promise.all([getStats(), getAchievements()])
      .then(([s, a]) => {
        setStats(s);
        setAchievements(a);
        const fresh = a.find((x) => x.justUnlocked);
        const lastUnlocked = [...a].filter((x) => x.unlocked).sort((x, y) => new Date(y.unlockedAt) - new Date(x.unlockedAt))[0];
        const initial = fresh ?? lastUnlocked ?? a[0];
        if (initial) setSelectedId(initial.id);
        if (fresh) {
          setForgingId(fresh.id);
          setCelebrating(fresh);
          window.setTimeout(() => setForgingId(null), 1400);
        }
      })
      .catch(() => {
        // Mock-API, sollte praktisch nie fehlschlagen - Seite bleibt dann leer.
      });

    return subscribeNewUnlock((updated) => {
      setAchievements((prev) => (prev ? prev.map((a) => (a.id === updated.id ? updated : a)) : prev));
      setSelectedId(updated.id);
      setForgingId(updated.id);
      setCelebrating(updated);
      window.setTimeout(() => setForgingId(null), 1400);
    });
  }, []);

  // "Schmiede-Riss": ein Riss aus glühendem Licht bricht vom Kanten-Tab aus
  // über den Bildschirm, statt das ganze Fenster per 3D-Hinge zu drehen (das
  // wirkte auf der vollen Fensterfläche verzerrt). Während der Flash-Spitze
  // wird der Panel-Inhalt sichtbar/unsichtbar geschaltet.
  useEffect(() => {
    if (!panelRef.current) return;
    if (tier !== "full" || !crackRef.current) {
      gsap.fromTo(panelRef.current, { opacity: 0 }, { opacity: 1, duration: 0.22 });
      return;
    }
    gsap.set(panelRef.current, { opacity: 0 });
    gsap.set(crackRef.current, { opacity: 0 });
    gsap.set(crackLineRef.current, { scaleX: 0, transformOrigin: "right center" });
    gsap
      .timeline()
      .to(crackRef.current, { opacity: 1, duration: 0.1 })
      .to(crackLineRef.current, { scaleX: 1, duration: 0.22, ease: "power4.out" }, "<")
      .set(panelRef.current, { opacity: 1 })
      .to(crackRef.current, { opacity: 0, duration: 0.5, ease: "power2.in" }, "+=0.03");
  }, [tier]);

  function handleClose() {
    if (closing) return;
    if (tier !== "full" || !panelRef.current || !crackRef.current) {
      onClose();
      return;
    }
    setClosing(true);
    gsap.set(crackRef.current, { opacity: 0 });
    gsap.set(crackLineRef.current, { scaleX: 0, transformOrigin: "right center" });
    gsap
      .timeline({ onComplete: onClose })
      .to(crackRef.current, { opacity: 1, duration: 0.1 })
      .to(crackLineRef.current, { scaleX: 1, duration: 0.22, ease: "power4.out" }, "<")
      .set(panelRef.current, { opacity: 0 })
      .to(crackRef.current, { opacity: 0, duration: 0.32, ease: "power2.in" }, "+=0.02");
  }

  function handleView(id) {
    acknowledgeJustUnlocked(id);
  }

  return (
    <div className="erzmark-book-backdrop">
      <div ref={crackRef} className="erzmark-forge-crack" aria-hidden="true">
        <span ref={crackLineRef} className="erzmark-forge-crack-line" />
        <div className="erzmark-forge-crack-sparks">
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} style={{ "--i": i }} />
          ))}
        </div>
      </div>
      <div ref={panelRef} className="erzmark-book-panel">
        <div className="erzmark-book-titlebar">
          <span className="erzmark-book-title">Die Schmiede</span>
          <button className="erzmark-book-close" onClick={handleClose} aria-label="Zurück zum Launcher">
            ✕
          </button>
        </div>

        <div className="erzmark-book-viewport">
          <ForgeErrorBoundary>
            <ForgePage
              stats={stats}
              achievements={achievements}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onView={handleView}
              playerName={playerName}
              forgingId={forgingId}
            />
          </ForgeErrorBoundary>
        </div>
      </div>

      {celebrating && <ForgeUnlockPopup achievement={celebrating} onDismiss={() => setCelebrating(null)} />}
    </div>
  );
}
