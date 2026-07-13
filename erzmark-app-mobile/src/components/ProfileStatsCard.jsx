import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../theme";

/** "WARRIOR" -> "Warrior", gleiche Formatierung wie CharacterProfiles.jsx im Launcher. */
function prettifyClassName(rawClass) {
  if (!rawClass) return null;
  return rawClass
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatLastPlayed(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

/**
 * Statistik-Karte für das aktuell gewählte MMOProfiles-Profil. Level/HP/
 * Mana/Ausdauer sind optional, da `/app-api/profiles/mine` sie aktuell noch
 * nicht liefert (siehe HANDOFF.md, TODO Backend-Erweiterung) - die Karte
 * zeigt einfach nur die vorhandenen Felder an und wächst automatisch mit,
 * sobald das Backend mehr liefert.
 */
export default function ProfileStatsCard({ profile }) {
  if (!profile) return null;

  const className = prettifyClassName(profile.className);
  const lastPlayed = formatLastPlayed(profile.lastPlayedAt);
  const hasStats = profile.level != null || profile.health != null || profile.mana != null || profile.stamina != null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{profile.name}</Text>
        {className && <Text style={styles.badge}>{className}</Text>}
      </View>

      {profile.level != null && <Text style={styles.level}>Level {profile.level}</Text>}

      {hasStats && (
        <View style={styles.statsRow}>
          {profile.health != null && (
            <View style={styles.statChip}>
              <Text style={styles.statValue}>❤️ {Math.round(profile.health)}</Text>
              <Text style={styles.statLabel}>Leben</Text>
            </View>
          )}
          {profile.mana != null && (
            <View style={styles.statChip}>
              <Text style={styles.statValue}>🔷 {Math.round(profile.mana)}</Text>
              <Text style={styles.statLabel}>Mana</Text>
            </View>
          )}
          {profile.stamina != null && (
            <View style={styles.statChip}>
              <Text style={styles.statValue}>⚡ {Math.round(profile.stamina)}</Text>
              <Text style={styles.statLabel}>Ausdauer</Text>
            </View>
          )}
        </View>
      )}

      {lastPlayed && <Text style={styles.lastPlayed}>Zuletzt gespielt: {lastPlayed}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { fontSize: 18, fontWeight: "800", color: colors.text },
  badge: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.bg,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  level: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  statChip: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 13, fontWeight: "700", color: colors.text },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  lastPlayed: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
});
