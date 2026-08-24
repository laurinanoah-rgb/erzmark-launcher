import { useEffect, useMemo, useRef, useState } from "react";
import DockTabs from "./DockTabs.jsx";
import { FORGE_ZONES, useForgeLayout } from "../utils/forgeLayout.js";

const ZONE_LABELS = {
  left: "Links",
  right: "Rechts",
  top: "Oben",
  bottom: "Unten",
  floating: "Schwebend",
  hidden: "Ausgeblendet",
};

function LayoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 4v16M16 4v16M8 9h8" />
    </svg>
  );
}

function ZoneDock({ zone, ids, modules, editing, collapsed, dropTarget, onToggle, onMoveZone, onMoveModule, pointerDrag }) {
  const tabs = ids.map((id) => modules.get(id)).filter(Boolean);
  if (!editing && tabs.length === 0) return null;

  return (
    <section
      className={`erzmark-forge-zone erzmark-forge-zone-${zone}${collapsed ? " is-collapsed" : ""}${dropTarget === zone ? " is-drop-target" : ""}`}
      data-zone={zone}
      data-forge-drop-zone={zone}
      onDragOver={(event) => {
        if (editing) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!editing) return;
        event.preventDefault();
        const moduleId = event.dataTransfer.getData("application/x-erzmark-module");
        if (moduleId) onMoveModule(moduleId, zone);
      }}
    >
      <div className="erzmark-forge-zone-header">
        <span><i />{ZONE_LABELS[zone]}</span>
        <div>
          {editing && ids.length > 0 && (
            <select
              value={zone}
              onChange={(event) => onMoveZone(zone, event.target.value)}
              title="Gesamten Dock verschieben"
              aria-label={`${ZONE_LABELS[zone]}-Dock verschieben`}
            >
              {FORGE_ZONES.map((target) => <option key={target} value={target}>{ZONE_LABELS[target]}</option>)}
            </select>
          )}
          {ids.length > 0 && (
            <button
              type="button"
              onClick={() => onToggle(zone)}
              title={collapsed ? "Dock ausklappen" : "Dock einklappen"}
              aria-label={`${ZONE_LABELS[zone]}-Dock ${collapsed ? "ausklappen" : "einklappen"}`}
            >
              {collapsed ? "+" : "−"}
            </button>
          )}
        </div>
      </div>
      {!collapsed && tabs.length > 0 && (
        <DockTabs tabs={tabs} editing={editing} onMoveModule={onMoveModule} {...pointerDrag} />
      )}
      {!collapsed && tabs.length === 0 && editing && <div className="erzmark-forge-empty">Modul hier ablegen</div>}
    </section>
  );
}

function FloatingDock({ module, position, editing, onMoveModule, onPosition, pointerDrag }) {
  const draggingRef = useRef(false);
  const grabOffsetRef = useRef({ x: 18, y: 18 });

  function handlePointerMove(event) {
    if (!editing || !draggingRef.current) return;
    const layoutRect = event.currentTarget.closest(".erzmark-forge-layout")?.getBoundingClientRect();
    if (!layoutRect) return;
    onPosition(module.id, {
      x: Math.min(82, Math.max(0, ((event.clientX - layoutRect.left - grabOffsetRef.current.x) / layoutRect.width) * 100)),
      y: Math.min(76, Math.max(0, ((event.clientY - layoutRect.top - grabOffsetRef.current.y) / layoutRect.height) * 100)),
    });
  }

  return (
    <section
      className={`erzmark-forge-floating${editing ? " is-editing" : ""}`}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
    >
      <div
        className="erzmark-forge-floating-handle"
        onPointerDown={(event) => {
          if (!editing || event.target.closest("select, button")) return;
          const panelRect = event.currentTarget.parentElement.getBoundingClientRect();
          grabOffsetRef.current = { x: event.clientX - panelRect.left, y: event.clientY - panelRect.top };
          draggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => {
          draggingRef.current = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => { draggingRef.current = false; }}
      >
        <span>⠿ {module.label}</span>
        {editing && (
          <select value="floating" onChange={(event) => onMoveModule(module.id, event.target.value)}>
            {[...FORGE_ZONES, "floating", "hidden"].map((zone) => (
              <option key={zone} value={zone}>{ZONE_LABELS[zone]}</option>
            ))}
          </select>
        )}
      </div>
      <DockTabs tabs={[module]} editing={editing} onMoveModule={onMoveModule} {...pointerDrag} />
    </section>
  );
}

export default function ForgeLayout({ profile, modules: moduleList, stage, zoneRefs = {}, stageRef }) {
  const [layout, api] = useForgeLayout(profile);
  const [editing, setEditing] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const pointerDragRef = useRef(null);
  const dropTargetRef = useRef(null);
  const [pointerDragVisual, setPointerDragVisual] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const modules = useMemo(() => new Map(moduleList.map((module) => [module.id, module])), [moduleList]);

  useEffect(() => {
    setEditing(false);
    setSnapshot(null);
  }, [profile]);

  function startEditing() {
    setSnapshot(JSON.parse(JSON.stringify(layout)));
    setEditing(true);
  }

  function beginPointerDrag(moduleId, event) {
    if (event.button !== 0) return;
    pointerDragRef.current = {
      moduleId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePointerDrag(event) {
    const drag = pointerDragRef.current;
    if (!drag) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.moved && distance < 5) return;
    drag.moved = true;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const destination = hit?.closest?.("[data-forge-drop-zone]")?.dataset.forgeDropZone ?? null;
    dropTargetRef.current = destination;
    setDropTarget(destination);
    setPointerDragVisual({ moduleId: drag.moduleId, x: event.clientX, y: event.clientY });
  }

  function endPointerDrag(event, cancelled = false) {
    const drag = pointerDragRef.current;
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!cancelled && drag.moved && dropTargetRef.current) {
      api.moveModule(drag.moduleId, dropTargetRef.current);
    }
    pointerDragRef.current = null;
    dropTargetRef.current = null;
    setPointerDragVisual(null);
    setDropTarget(null);
  }

  const pointerDrag = {
    onPointerDragStart: beginPointerDrag,
    onPointerDragMove: movePointerDrag,
    onPointerDragEnd: endPointerDrag,
  };

  return (
    <div className={`erzmark-forge-layout${editing ? " is-editing" : ""}`}>
      <div className="erzmark-forge-toolbar">
        {!editing ? (
          <button
            type="button"
            className="erzmark-forge-edit-button"
            onClick={startEditing}
            aria-label="Layout bearbeiten"
          >
            <LayoutIcon /><span>Layout bearbeiten</span>
          </button>
        ) : (
          <div className="erzmark-forge-editor-bar">
            <span><LayoutIcon /><strong>ForgeLayout</strong><small>Module ziehen oder Position wählen</small></span>
            <label>
              Vorlage
              <select defaultValue="" onChange={(event) => { if (event.target.value) api.applyPreset(event.target.value); event.target.value = ""; }}>
                <option value="" disabled>Auswählen…</option>
                <option value="standard">Standard / automatisch</option>
                <option value="ultrawide">Ultrawide</option>
                <option value="minimal">Minimal</option>
                <option value="community">Gemeinschaft</option>
              </select>
            </label>
            <button type="button" onClick={() => snapshot && api.setLayout(snapshot)}>Rückgängig</button>
            <button type="button" onClick={api.reset}>Zurücksetzen</button>
            <button type="button" className="is-primary" onClick={() => setEditing(false)}>Fertig</button>
          </div>
        )}
      </div>

      {editing && (
        <div className="erzmark-forge-module-strip">
          {moduleList.map((module) => {
            const currentZone = FORGE_ZONES.find((zone) => layout.zones[zone].includes(module.id))
              ?? (layout.floating[module.id] ? "floating" : "hidden");
            return (
              <label key={module.id}>
                <span>{module.label}</span>
                <select value={currentZone} onChange={(event) => api.moveModule(module.id, event.target.value)}>
                  {[...FORGE_ZONES, "floating", "hidden"].map((zone) => (
                    <option key={zone} value={zone}>{ZONE_LABELS[zone]}</option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      )}

      <div ref={zoneRefs.top} className="erzmark-forge-zone-wrap is-top">
        <ZoneDock zone="top" ids={layout.zones.top} modules={modules} editing={editing} collapsed={layout.collapsed.includes("top")} dropTarget={dropTarget} onToggle={api.toggleCollapsed} onMoveZone={api.moveZone} onMoveModule={api.moveModule} pointerDrag={pointerDrag} />
      </div>

      <div className="erzmark-forge-middle">
        <div ref={zoneRefs.left} className="erzmark-forge-zone-wrap is-left">
          <ZoneDock zone="left" ids={layout.zones.left} modules={modules} editing={editing} collapsed={layout.collapsed.includes("left")} dropTarget={dropTarget} onToggle={api.toggleCollapsed} onMoveZone={api.moveZone} onMoveModule={api.moveModule} pointerDrag={pointerDrag} />
        </div>

        <main
          ref={stageRef}
          className="erzmark-main-content erzmark-forge-stage"
          data-forge-drop-zone="floating"
          onDragOver={(event) => { if (editing) event.preventDefault(); }}
          onDrop={(event) => {
            if (!editing) return;
            event.preventDefault();
            const moduleId = event.dataTransfer.getData("application/x-erzmark-module");
            if (moduleId) api.moveModule(moduleId, "floating");
          }}
        >
          {stage}
          {editing && <div className={`erzmark-forge-float-target${dropTarget === "floating" ? " is-drop-target" : ""}`}><LayoutIcon /><span>Hier ablegen: schwebender Dock</span></div>}
        </main>

        <div ref={zoneRefs.right} className="erzmark-forge-zone-wrap is-right">
          <ZoneDock zone="right" ids={layout.zones.right} modules={modules} editing={editing} collapsed={layout.collapsed.includes("right")} dropTarget={dropTarget} onToggle={api.toggleCollapsed} onMoveZone={api.moveZone} onMoveModule={api.moveModule} pointerDrag={pointerDrag} />
        </div>
      </div>

      <div ref={zoneRefs.bottom} className="erzmark-forge-zone-wrap is-bottom">
        <ZoneDock zone="bottom" ids={layout.zones.bottom} modules={modules} editing={editing} collapsed={layout.collapsed.includes("bottom")} dropTarget={dropTarget} onToggle={api.toggleCollapsed} onMoveZone={api.moveZone} onMoveModule={api.moveModule} pointerDrag={pointerDrag} />
      </div>

      {Object.entries(layout.floating).map(([id, position]) => {
        const module = modules.get(id);
        return module ? <FloatingDock key={id} module={module} position={position} editing={editing} onMoveModule={api.moveModule} onPosition={api.setFloatingPosition} pointerDrag={pointerDrag} /> : null;
      })}

      {pointerDragVisual && (
        <div className="erzmark-forge-drag-ghost" style={{ left: pointerDragVisual.x, top: pointerDragVisual.y }}>
          <span>⠿</span>{modules.get(pointerDragVisual.moduleId)?.label ?? "Modul"}
        </div>
      )}
    </div>
  );
}
