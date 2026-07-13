import { useEffect, useRef } from "react";
import { View, Image, Text, Animated, StyleSheet, Easing } from "react-native";
import { colors, spacing } from "../theme";

/**
 * Start-Animation, die waehrend der Update-/Login-Checks in
 * AppNavigator.jsx laeuft (statt vorher `return null` - kurzes schwarzes
 * Aufblitzen beim Start). Logo skaliert/faded rein, Wortmarke folgt leicht
 * verzoegert, dazu eine dezente Lade-Anzeige unten. AppNavigator sorgt
 * zusaetzlich fuer eine Mindestanzeigedauer, damit die Animation nicht
 * abgeschnitten wird, falls die Checks sehr schnell durch sind.
 */
export default function SplashScreen() {
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkTranslate = useRef(new Animated.Value(10)).current;
  const dotPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require("../../assets/icon.png")}
        style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
      />
      <Animated.Text
        style={[styles.wordmark, { opacity: wordmarkOpacity, transform: [{ translateY: wordmarkTranslate }] }]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
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
