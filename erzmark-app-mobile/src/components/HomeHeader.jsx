import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../theme";

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

      <View style={styles.account}>
        {accountName && <Text style={styles.accountName}>{accountName}</Text>}
        <Pressable onPress={onLogout} hitSlop={8}>
          <Text style={styles.logout}>Abmelden</Text>
        </Pressable>
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
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1.5,
    borderColor: colors.goldSoft,
  },
  logo: { width: 24, height: 24, resizeMode: "contain" },
  wordmark: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: colors.gold,
  },
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
