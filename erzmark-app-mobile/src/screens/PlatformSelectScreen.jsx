import { useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing } from "react-native";
import { logout } from "../api/auth";
import { colors, radius, spacing } from "../theme";

/**
 * Plattform-Weiche (26.07.2026, Nutzerwunsch "Denkdatei Onboarding") -
 * erscheint nach dem Login, vor der Java-Profilauswahl. Bewusst v1-Scope
 * (siehe Absprache mit dem Nutzer): KEIN eigener Xbox-Live/XUID-Login-Pfad -
 * "Bedrock" nutzt technisch denselben Java-/Sanctum-Login wie "Java", zeigt
 * aber direkt den Connect-Setup-Screen statt der Java-Spielstand-Auswahl.
 * Ein echter Bedrock-eigener Account (fuer Konsolenspieler ohne Java-Edition-
 * Lizenz) bräuchte einen komplett neuen Auth-Flow - siehe PLANNING.md.
 *
 * Erscheint wie ProfileSelectScreen bei JEDEM App-Start (kein gespeicherter
 * Zustand) - konsistent mit der dortigen Design-Entscheidung, dass die
 * Start-Auswahl-Screens nie automatisch übersprungen werden.
 */
export default function PlatformSelectScreen({ onSelectPlatform, onLogout }) {
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFade, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [headerFade]);

  async function handleLogout() {
    const remaining = await logout();
    onLogout(remaining);
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          opacity: headerFade,
          transform: [{ translateY: headerFade.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
        }}
      >
        <Text style={styles.title}>Wie spielst du?</Text>
        <Text style={styles.subtitle}>Das entscheidet, was du als Nächstes siehst.</Text>
      </Animated.View>

      <Pressable style={styles.card} onPress={() => onSelectPlatform("java")}>
        <Text style={styles.cardIcon}>⛏️</Text>
        <Text style={styles.cardTitle}>Java Edition</Text>
        <Text style={styles.cardText}>PC/Mac, wie gewohnt - Spielstände, Gilde, Freunde, Profil.</Text>
      </Pressable>

      <Pressable style={styles.card} onPress={() => onSelectPlatform("bedrock")}>
        <Text style={styles.cardIcon}>🎮</Text>
        <Text style={styles.cardTitle}>Bedrock Edition</Text>
        <Text style={styles.cardText}>Xbox, PlayStation, Nintendo Switch oder Mobile - Verbindung zu Erzmark einrichten.</Text>
      </Pressable>

      <Pressable onPress={handleLogout} style={styles.logoutLink}>
        <Text style={styles.logoutText}>Abmelden</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, paddingTop: 70, gap: spacing.lg },
  title: { fontSize: 28, fontWeight: "800", color: colors.gold, marginBottom: 6, letterSpacing: 0.3 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  cardIcon: { fontSize: 28 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  cardText: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  logoutLink: { alignSelf: "center", marginTop: "auto", padding: spacing.sm },
  logoutText: { color: colors.textMuted, fontSize: 14, textDecorationLine: "underline" },
});
