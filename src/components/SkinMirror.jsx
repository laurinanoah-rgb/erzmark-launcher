import { useEffect, useRef } from "react";
import { SkinViewer, IdleAnimation } from "skinview3d";

/**
 * Drehbare 3D-Vorschau des aktuellen Skins ("Skin Mirror") mit sanfter
 * Idle-Animation (Arm-/Umhangschwung) und automatischer Drehung – per
 * Maus/Touch lässt sich die Ansicht zusätzlich manuell drehen/zoomen
 * (in skinview3d eingebaut). textures.minecraft.net ist bereits in der CSP
 * erlaubt (img-src), daher ist keine weitere Konfiguration nötig.
 */
export default function SkinMirror({ skinUrl, width = 200, height = 260 }) {
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
    viewer.animation = new IdleAnimation();
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.6;
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
