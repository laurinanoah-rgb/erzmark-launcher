import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Image, StyleSheet, Animated, Easing, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMyProfiles } from "../api/profiles";
import { getStoredToken, getActiveProfileUuid, getAccountUuid } from "../api/auth";
import { colors, radius, spacing } from "../theme";

const AUTO_REFRESH_MS = 60 * 1000;

/** "WARRIOR" -> "Warrior", gleiche Formatierung wie ProfileCard.jsx. */
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

function formatPlayTime(totalSeconds) {
  if (!totalSeconds) return "0h";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatCoins(amount) {
  if (amount == null) return "0";
  return Math.round(amount).toLocaleString("de-DE");
}

// Gleiche Rang-Textbadges wie ProfileCard.jsx/ProfileSelectScreen.jsx.
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

/** Eine Stat-Kachel, fadet/rutscht gestaffelt (per `index`) beim Erscheinen ein. */
function StatTile({ icon, value, label, index }) {
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 380,
      delay: 150 + index * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        styles.statTile,
        {
          opacity: entrance,
          transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
    >
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

/**
 * Profil-Tab: große Charakteransicht des aktiven MMOProfiles-Profils (2D-
 * Minecraft-Skin via Crafatar, echte Account-UUID von getAccountUuid() -
 * NICHT die synthetische Profil-UUID, die Skin-Dienste nicht kennen würden).
 * Lädt dieselben Felder wie ProfileCard.jsx/HomeScreen.jsx, nur größer und
 * vollständiger dargestellt statt als kompakte Dashboard-Karte.
 *
 * Bewusst NOCH KEIN 3D-Skin-Viewer und KEIN "Karte teilen"-Export - beides
 * bräuchte eine neue native Abhängigkeit (z.B. react-native-webview für
 * skinview3d, react-native-view-shot fürs Teilen), die noch nicht im Projekt
 * installiert ist und einen neuen EAS-Build nötig macht. Siehe HANDOFF.md.
 */
export default function ProfileScreen() {
  const [accountUuid, setAccountUuid] = useState(null);
  const [activeProfile, setActiveProfile] = useState(undefined);

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const [token, activeUuid, realUuid] = await Promise.all([
        getStoredToken(),
        getActiveProfileUuid(),
        getAccountUuid(),
      ]);
      if (cancelled) return;
      setAccountUuid(realUuid);
      try {
        const profiles = await getMyProfiles(token);
        if (cancelled) return;
        const match = profiles.find((p) => p.uuid === activeUuid) ?? profiles[0] ?? null;
        setActiveProfile(match);
      } catch {
        if (!cancelled) setActiveProfile((prev) => (prev === undefined ? null : prev));
      }
    }

    refresh();
    const id = setInterval(refresh, AUTO_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (activeProfile === undefined) return;
    Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(heroScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile === undefined]);

  if (activeProfile === undefined) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={["top"]}>
        <ActivityIndicator color={colors.gold} />
      </SafeAreaView>
    );
  }

  if (!activeProfile) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={["top"]}>
        <Text style={styles.empty}>Kein Profil geladen.</Text>
      </SafeAreaView>
    );
  }

  const className = prettifyClassName(activeProfile.className);
  const lastPlayed = formatLastPlayed(activeProfile.lastPlayedAt);
  const rankBadge = activeProfile.rankIconUrl ? null : getRankBadge(activeProfile.rankName);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={[styles.hero, { opacity: heroFade, transform: [{ scale: heroScale }] }]}>
          <View style={styles.skinRing}>
            {accountUuid ? (
              <Image
                source={{ uri: `https://crafatar.com/avatars/${accountUuid}?size=128&overlay` }}
                style={styles.skinImage}
              />
            ) : (
              <View style={styles.skinImage} />
            )}
          </View>

          <View style={styles.nameLine}>
            {activeProfile.rankIconUrl && (
              <Image source={{ uri: activeProfile.rankIconUrl }} style={styles.rankIcon} />
            )}
            {rankBadge && (
              <View style={[styles.rankBadge, { backgroundColor: rankBadge.color }]}>
                <Text style={styles.rankBadgeText}>{rankBadge.label}</Text>
              </View>
            )}
            <Text style={styles.name}>{activeProfile.name}</Text>
          </View>

          <Text style={styles.subline}>
            {[className, activeProfile.level != null ? `Level ${activeProfile.level}` : null]
              .filter(Boolean)
              .join(" · ") || "Kein Klassenprofil aktiv"}
          </Text>
        </Animated.View>

        <View style={styles.statsGrid}>
          <StatTile icon="📜" value={activeProfile.questsCompleted ?? 0} label="Quests" index={0} />
          <StatTile icon="⏱" value={formatPlayTime(activeProfile.playTime)} label="Spielzeit" index={1} />
          <StatTile icon="🪙" value={formatCoins(activeProfile.coins)} label="Münzen" index={2} />
        </View>

        {lastPlayed && (
          <View style={styles.footerCard}>
            <Text style={styles.footerText}>Zuletzt gespielt: {lastPlayed}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: "center", justifyContent: "center" },
  empty: { color: colors.textMuted },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  hero: { alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  skinRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
    borderWidth: 2,
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 6,
    overflow: "hidden",
  },
  skinImage: { width: 88, height: 88, resizeMode: "contain" },
  nameLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  name: { fontSize: 22, fontWeight: "800", color: colors.text },
  rankIcon: { width: 26, height: 26, resizeMode: "contain" },
  rankBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  rankBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase", color: "#fff" },
  subline: { fontSize: 14, color: colors.textMuted },
  statsGrid: { flexDirection: "row", gap: spacing.md },
  statTile: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    paddingVertical: spacing.md,
  },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: 15, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted },
  footerCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    padding: spacing.md,
    alignItems: "center",
  },
  footerText: { fontSize: 12, color: colors.textMuted },
});
