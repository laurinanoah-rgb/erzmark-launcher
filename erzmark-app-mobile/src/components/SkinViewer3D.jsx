import { useMemo } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { colors, radius } from "../theme";

/**
 * 3D-Skin-Viewer (26.07.2026, HANDOFF TODO #9) - eingebettetes skinview3d
 * (https://github.com/bs-community/skinview3d) in einer WebView, da es RN
 * kein natives WebGL/Three.js gibt. Skin-Textur kommt von Crafatar
 * (`https://crafatar.com/skins/{uuid}`, das volle PNG, NICHT der gerenderte
 * Avatar-Ausschnitt wie beim 2D-Ring in ProfileScreen.jsx).
 *
 * Bewusst eine eigene, isolierte Komponente statt Teil des Hero-Bereichs -
 * WebGL-Content lässt sich mit react-native-view-shot auf Android teils nicht
 * zuverlässig als Bild einfangen, deshalb nutzt der "Karte teilen"-Export
 * (CharacterCard.jsx) den flachen Crafatar-Body-Render statt eines
 * Screenshots dieser WebView.
 */
export default function SkinViewer3D({ skinUuid, height = 260 }) {
  const html = useMemo(() => buildHtml(skinUuid), [skinUuid]);

  if (!skinUuid) return null;

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        overScrollMode="never"
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.gold} />
          </View>
        )}
        startInLoadingState
        originWhitelist={["*"]}
      />
    </View>
  );
}

function buildHtml(skinUuid) {
  const skinUrl = `https://crafatar.com/skins/${skinUuid}`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; height: 100%; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script src="https://unpkg.com/skinview3d/bundles/skinview3d.bundle.js"></script>
  <script>
    window.onload = function () {
      var viewer = new skinview3d.SkinViewer({
        canvas: document.createElement("canvas"),
        width: window.innerWidth,
        height: window.innerHeight,
        skin: "${skinUrl}",
      });
      document.body.appendChild(viewer.canvas);
      viewer.autoRotate = true;
      viewer.autoRotateSpeed = 0.6;
      viewer.zoom = 0.85;
      viewer.controls.enableZoom = false;
    };
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  webview: { backgroundColor: "transparent" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
