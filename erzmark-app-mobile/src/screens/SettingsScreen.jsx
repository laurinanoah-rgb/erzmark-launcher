import { View, Text, Pressable, StyleSheet } from "react-native";
import Constants from "expo-constants";
import { colors, radius, spacing } from "../theme";

/**
 * Einstellungen-Tab: Account-Aktionen (Profil wechseln/Abmelden - vorher in
 * der überlappenden AccountBar, die den HomeHeader verdeckt hat) sowie
 * Platz für künftige Personalisierung (Benachrichtigungen, Darstellung,
 * etc.).
 */
export default function SettingsScreen({ onSwitchProfile, onLogout }) {
  const version = Constants.expoConfig?.version;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚙️ Einstellungen</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Pressable style={styles.row} onPress={onSwitchProfile}>
          <Text style={styles.rowLabel}>Profil wechseln</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={onLogout}>
          <Text style={[styles.rowLabel, styles.rowDanger]}>Abmelden</Text>
          <Text style={[styles.rowChevron, styles.rowDanger]}>›</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personalisierung</Text>
        <Text style={styles.placeholder}>
          Benachrichtigungen, Darstellung u.a. folgen hier in einer künftigen Version.
        </Text>
      </View>

      {version && <Text style={styles.version}>Erzmark App v{version}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: 60, gap: spacing.lg },
  title: { fontSize: 20, fontWeight: "800", color: colors.gold, letterSpacing: 0.5 },
  section: { gap: spacing.xs },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  rowLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  rowChevron: { fontSize: 16, color: colors.textMuted },
  rowDanger: { color: colors.danger },
  placeholder: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  version: { fontSize: 11, color: colors.textMuted, textAlign: "center", marginTop: "auto" },
});
