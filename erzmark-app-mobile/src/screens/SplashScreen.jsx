import { useEffect, useRef, useState } from "react";
import { View, Image, Text, Animated, StyleSheet, Easing } from "react-native";
import { colors, spacing } from "../theme";

// Dieselben Boot-Zeilen wie im Desktop-Launcher (src/components/BootAnimation.jsx,
// BOOT_LINES), damit beide Start-Animationen thematisch zusammengehören. Der
// Launcher tippt sie per Canvas+GSAP zeichenweise und lässt die Buchstaben zum
// Logo fliegen - das hat keine sinnvolle RN-Entsprechung ohne eine neue native
// Abhängigkeit (z.B. react-native-skia). Hier daher bewusst vereinfacht: die
// Zeilen faden/tippen sich per RN `Animated` gestaffelt ein, dann Crossfade zu
// Logo+Wortmarke mit einem weichen Glow-Puls als Annäherung an den
// "Schockwellen"-Moment des Launchers.
const BOOT_LINES = [
  "> erzmark://core initialisieren…",
  "> Dateisystem einhängen…",
  "> Kartendaten laden…",
  "> Verbindung schmieden…",
  "> Authentifizierung: R.U.D.O.L.F.",
  "> Systeme online.",
];

const LINE_STAGGER_MS = 160;
const LINES_HOLD_MS = 350;
const CROSSFADE_MS = 400;

export default function SplashScreen() {
  const [showLog, setShowLog] = useState(true);
  const lineOpacities = useRef(BOOT_LINES.map(() => new Animated.Value(0))).current;
  const logOpacity = useRef(new Animated.Value(1)).current;
  const cursorBlink = useRef(new Animated.Value(1)).current;

  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkTranslate = useRef(new Animated.Value(10)).current;
  const dotPulse = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.6)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(cursorBlink, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.timing(cursorBlink, { toValue: 1, duration: 350, useNativeDriver: true }),
      ])
    ).start();

    Animated.stagger(
      LINE_STAGGER_MS,
      lineOpacities.map((v) => Animated.timing(v, { toValue: 1, duration: 220, useNativeDriver: true }))
    ).start();

    const logToLogoTimer = setTimeout(() => {
      Animated.timing(logOpacity, {
        toValue: 0,
        duration: CROSSFADE_MS,
        useNativeDriver: true,
      }).start(() => setShowLog(false));

      // Weicher Schockwellen-Glow hinterm Logo (Annäherung an den
      // Iris-/Mask-Reveal des Launchers, ohne CSS-Mask-Äquivalent in RN).
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.55, duration: 260, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
      Animated.timing(glowScale, {
        toValue: 1.6,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      ]).start();

      Animated.timing(wordmarkOpacity, {
        toValue: 1,
        duration: 450,
        delay: 250,
        useNativeDriver: true,
      }).start();
      Animated.timing(wordmarkTranslate, {
        toValue: 0,
        duration: 450,
        delay: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(dotPulse, { toValue: 1, duration: 650, useNativeDriver: true }),
          Animated.timing(dotPulse, { toValue: 0, duration: 650, useNativeDriver: true }),
        ])
      ).start();
    }, BOOT_LINES.length * LINE_STAGGER_MS + LINES_HOLD_MS);

    return () => clearTimeout(logToLogoTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      {showLog && (
        <Animated.View style={[styles.bootLog, { opacity: logOpacity }]}>
          {BOOT_LINES.map((line, i) => (
            <Animated.View key={line} style={{ opacity: lineOpacities[i], flexDirection: "row" }}>
              <Text style={[styles.bootLine, i === BOOT_LINES.length - 1 && styles.bootLineLast]}>
                {line}
              </Text>
              {i === BOOT_LINES.length - 1 && (
                <Animated.Text style={[styles.cursor, { opacity: cursorBlink }]}>▌</Animated.Text>
              )}
            </Animated.View>
          ))}
        </Animated.View>
      )}

      {!showLog && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
          />
          <Animated.Image
            source={require("../../assets/icon.png")}
            style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
          />
          <Animated.Text
            style={[
              styles.wordmark,
              { opacity: wordmarkOpacity, transform: [{ translateY: wordmarkTranslate }] },
            ]}
          >
            ERZMARK
          </Animated.Text>

          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    opacity: dotPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: i === 1 ? [0.3, 1] : [1, 0.3],
                    }),
                  },
                ]}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  bootLog: { alignItems: "flex-start" },
  bootLine: {
    fontFamily: "Courier",
    fontSize: 13,
    color: colors.primary,
    marginBottom: 6,
  },
  bootLineLast: { color: colors.gold },
  cursor: { fontFamily: "Courier", fontSize: 13, color: colors.gold, marginLeft: 2 },
  glow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.gold,
  },
  logo: { width: 140, height: 140, resizeMode: "contain", borderRadius: 20 },
  wordmark: {
    marginTop: spacing.lg,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 3,
    color: colors.gold,
    textShadowColor: "rgba(255, 185, 0, 0.5)",
    textShadowRadius: 12,
  },
  dots: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
});
