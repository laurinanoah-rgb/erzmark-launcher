import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "../theme";

// Vollstaendige URL zum CloudNet-Webinterface (Servers, Team/Rollen,
// Wartungsmodus, Audit-Log, ...). Baut absichtlich NICHT die komplette
// Verwaltung nativ nach - das Webinterface ist bereits fertig und getestet,
// hier oeffnet nur ein Portal-Button den System-Browser dorthin. Login
// laeuft separat ueber den normalen MineTrax-Website-Account (eigenes
// Auth-System, unabhaengig vom Minecraft/Xbox-Login dieser App).
const CLOUDNET_URL = "https://erzmark.de/admin/cloudnet";

/**
 * Team-Tab, nur sichtbar fuer Profile mit Team-Rang (siehe STAFF_RANKS in
 * AppNavigator.jsx). Der eigentliche Zugriffsschutz passiert serverseitig
 * ueber die "access cloudnet webinterface"-Permission - dieser Tab ist nur
 * eine bequeme Abkuerzung, kein Sicherheitsmechanismus.
 */
export default function TeamScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.content}>
        <Text style={styles.icon}>🛠️</Text>
        <Text style={styles.title}>Team-Bereich</Text>
        <Text style={styles.subtitle}>
          Server verwalten, Wartungsmodus, Team & Rollen, Audit-Log - alles im CloudNet-Webinterface.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => Linking.openURL(CLOUDNET_URL)}>
          <Text style={styles.buttonText}>CloudNet-Webinterface öffnen</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>Öffnet im Browser - melde dich dort mit deinem MineTrax-Website-Account an.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  icon: { fontSize: 48 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginBottom: spacing.md },
  button: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { fontSize: 15, fontWeight: "800", color: colors.bg },
  hint: { fontSize: 11, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
});
