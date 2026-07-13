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

function formatCoins(amount) {
  if (amount == null) return null;
  return Math.round(amount).toLocaleString("de-DE");
}

// Eigenes Badge-Design pro LuckPerms-Rang (siehe ProfileController.php auf
// dem Server): die echten Ingame-Prefixe sind Nexo-Glyphen/PlaceholderAPI-
// Platzhalter (z.B. "%nexo_ranksbuilder%"), die nur im Minecraft-Client mit
// Resourcepack darstellbar sind - hier deshalb eine eigene, zum Erzmark-
// Stil passende Gestaltung statt eines Nachbaus der Ingame-Grafik.
// "default" (ganz normaler Spieler, die große Mehrheit) bekommt bewusst
// KEIN Badge, um die Karte nicht mit einem bedeutungslosen Tag zu überladen.
const RANK_BADGES = {
  owner: { label: "Owner", color: "#ef4343" },
  dev: { label: "Dev", color: "#a855f7" },
  mod: { label: "Mod", color: "#42b7fa" },
  supp: { label: "Support", color: "#00bc7d" },
  builder: { label: "Builder", color: "#f59e0b" },
};

function getRankBadge(rankName) {
  if (!rankName || rankName === "default") return null;
  return RANK_BADGES[rankName] ?? { label: rankName, color: colors.textMuted };
}

/**
 * Profilkarte ganz oben auf dem HomeScreen (unter dem Banner) - zeigt
 * Rang-Badge (LuckPerms), Name, Klasse, Level, Kampf-Stats, Münzen und
 * letzten Spielzeitpunkt des gewählten Profils auf einen Blick. Alle
 * einzelnen Felder sind optional und werden nur angezeigt, wenn vorhanden
 * (robust gegen künftige Backend-Änderungen).
 */
export default function ProfileCard({ profile }) {
  if (!profile) return null;

  const className = prettifyClassName(profile.className);
  const lastPlayed = formatLastPlayed(profile.lastPlayedAt);
  const coins = formatCoins(profile.coins);
  const rank = getRankBadge(profile.rankName);
  const hasStats = profile.health != null || profile.mana != null || profile.stamina != null;
  const hasFooter = lastPlayed || coins;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.identity}>
          <View style={styles.nameLine}>
            {rank && (
              <View style={[styles.rankBadge, { backgroundColor: rank.color }]}>
                <Text style={styles.rankBadgeText}>{rank.label}</Text>
              </View>
            )}
            <Text style={styles.name}>{profile.name}</Text>
          </View>
          {profile.level != null && <Text style={styles.level}>Level {profile.level}</Text>}
        </View>
        {className && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{className}</Text>
          </View>
        )}
      </View>

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

      {hasFooter && (
        <View style={styles.footerRow}>
          <Text style={styles.lastPlayed}>{lastPlayed ? `Zuletzt gespielt: ${lastPlayed}` : ""}</Text>
          {coins && (
            <View style={styles.coinsPill}>
              <Text style={styles.coinsText}>🪙 {coins}</Text>
            </View>
          )}
        </View>
      )}
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
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  identity: { gap: 2 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: { fontSize: 19, fontWeight: "800", color: colors.text },
  rankBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  rankBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "#fff",
  },
  level: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  badge: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.bg,
  },
  statsRow: { flexDirection: "row", gap: spacing.md },
  statChip: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 13, fontWeight: "700", color: colors.text },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.goldSoft,
  },
  lastPlayed: { fontSize: 11, color: colors.textMuted },
  coinsPill: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  coinsText: { fontSize: 12, fontWeight: "800", color: colors.gold },
});
