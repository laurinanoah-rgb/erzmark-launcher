import { View, Text, Image, StyleSheet } from "react-native";
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

function formatPlayTime(totalSeconds) {
  if (!totalSeconds) return "0h";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// Fallback-Textbadge, falls kein rankIconUrl vom Backend mitkommt (z.B. bei
// einem Rang ohne hinterlegtes Bild) - die echten Ingame-Prefixe sind
// Nexo-Glyphen/PlaceholderAPI-Platzhalter, die nur im Minecraft-Client mit
// Resourcepack darstellbar sind, deshalb bevorzugt das echte MineTrax-
// Rang-Icon (siehe ProfileController.php), sonst dieses eigene Text-Badge.
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
 * Rang-Icon (LuckPerms/MineTrax), Name, Klasse, Level, Quests/Spielzeit/
 * Münzen dieses Profils und letzten Spielzeitpunkt auf einen Blick. Jedes
 * MMOProfiles-Charakterprofil hat seine eigene, unabhängige Kasse und
 * Spielzeit (siehe ProfileController::mine() im Backend) - deshalb hier
 * Quests/Spielzeit/Münzen statt der Kampfwerte (Leben/Mana/Ausdauer), die
 * ohne Maximalwert kaum Aussagekraft hatten. Alle einzelnen Felder sind
 * optional und werden nur angezeigt, wenn vorhanden (robust gegen künftige
 * Backend-Änderungen).
 */
export default function ProfileCard({ profile }) {
  if (!profile) return null;

  const className = prettifyClassName(profile.className);
  const lastPlayed = formatLastPlayed(profile.lastPlayedAt);
  const coins = formatCoins(profile.coins);
  const rankBadge = profile.rankIconUrl ? null : getRankBadge(profile.rankName);
  const hasStats = profile.questsCompleted != null || profile.playTime != null || profile.coins != null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.identity}>
          <View style={styles.nameLine}>
            {profile.rankIconUrl && (
              <View style={styles.rankIconRing}>
                <Image source={{ uri: profile.rankIconUrl }} style={styles.rankIcon} />
              </View>
            )}
            {rankBadge && (
              <View style={[styles.rankBadge, { backgroundColor: rankBadge.color }]}>
                <Text style={styles.rankBadgeText}>{rankBadge.label}</Text>
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
          <View style={styles.statChip}>
            <Text style={styles.statValue}>📜 {profile.questsCompleted ?? 0}</Text>
            <Text style={styles.statLabel}>Quests</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>⏱ {formatPlayTime(profile.playTime)}</Text>
            <Text style={styles.statLabel}>Spielzeit</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>🪙 {coins ?? 0}</Text>
            <Text style={styles.statLabel}>Münzen</Text>
          </View>
        </View>
      )}

      {lastPlayed && (
        <View style={styles.footerRow}>
          <Text style={styles.lastPlayed}>{`Zuletzt gespielt: ${lastPlayed}`}</Text>
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
  rankIconRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
    borderWidth: 1.5,
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 4,
  },
  rankIcon: { width: 24, height: 24, resizeMode: "contain" },
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
});
