import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../theme";
import NotificationBell from "./NotificationBell";

/**
 * Geschmiedete Kopfleiste ganz oben auf dem HomeScreen - Pendant zum
 * `.erzmark-header` im Desktop-Launcher (Logo/Wordmark links, Account +
 * Abmelden rechts). "Profil wechseln" lebt separat im Einstellungen-Tab
 * (siehe SettingsScreen.jsx) - vorher gab es dafür eine überlappende,
 * global schwebende AccountBar, die diesen Header verdeckt hat.
 */
export default function HomeHeader({ accountName, onLogout }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.sigil}>
          <Image source={require("../../assets/icon.png")} style={styles.logo} />
        </View>
        <Text style={styles.wordmark}>ERZMARK</Text>
      </View>

      <View style={styles.right}>
        <NotificationBell />
        <View style={styles.account}>
          {accountName && <Text style={styles.accountName}>{accountName}</Text>}
          <Pressable onPress={onLogout} hitSlop={8}>
            <Text style={styles.logout}>Abmelden</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.goldSoft,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sigil: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1.5,
    borderColor: colors.goldSoft,
    overflow: "hidden",
  },
  // icon.png ist eine volle quadratische Illustration (weisser Hintergrund,
  // "ERZMARK"-Schriftzug unten eingebrannt, kein freigestelltes Icon) - bei
  // "cover" wuerde nur ein zufaelliger Ausschnitt zu sehen sein, "contain"
  // zeigt die ganze Grafik. Vorher 24/38 = 63% Kreisfuellung wirkte winzig,
  // jetzt insgesamt groesser (56er Kreis, 50px Logo = 89% Fuellung).
  logo: { width: 50, height: 50, resizeMode: "contain" },
  wordmark: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: colors.gold,
  },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  account: { alignItems: "flex-end", gap: 2 },
  accountName: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.gold,
  },
  logout: {
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
});
