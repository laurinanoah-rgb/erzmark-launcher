import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { getAchievements, getStats, subscribeNewUnlock, acknowledgeJustUnlocked } from "../api/achievements";
import { colors, radius, spacing } from "../theme";

// Vereinfachte RN-Version des Launcher-"Schmiede"-Achievements-Screens
// (src/components/AchievementsScreen.jsx im Projekt-Root). Der Launcher nutzt
// eine pan-/zoombare Canvas-Baumdarstellung mit GSAP-Seiten-Curl - das ist in
// RN ohne eine neue native Abhängigkeit (react-native-skia) nicht
// verhältnismäßig nachbaubar. Stattdessen: nach Kategorie gruppierte
// Akkordeon-Liste mit denselben inhaltlichen Elementen (Tier-Rahmen,
// Freischalt-Glow, Prozent-Anzeige, Kontext-Satz) plus ein Statistik-Tab mit
// Fortschritts-Ringen, umgeschaltet über eine einfache Segmented Control
// statt des Buch-Seiten-Konzepts.

const CATEGORY_META = {
  milestones: { label: "Meilensteine", icon: "🐉" },
  social: { label: "Sozial", icon: "🤝" },
  gaming: { label: "Spielzeit & Fortschritt", icon: "⏳" },
  discovery: { label: "Entdeckung", icon: "🧭" },
};
const CATEGORY_ORDER = ["milestones", "social", "gaming", "discovery"];

// Tier grob aus `step` abgeleitet (1-2 Bronze, 3-4 Silber, 5 Gold, 6
// Legendär) - dieselbe Staffelung wie im Launcher.
function tierForStep(step) {
  if (step >= 6) return "legendary";
  if (step >= 5) return "gold";
  if (step >= 3) return "silver";
  return "bronze";
}

const TIER_COLORS = {
  bronze: "#c17a45",
  silver: "#b8c0cc",
  gold: "#ffb900",
  legendary: "#c774ff",
};

function formatUnlockedAt(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "heute";
  if (days === 1) return "vor 1 Tag";
  return `vor ${days} Tagen`;
}

function AchievementRow({ achievement, index, justUnlocked }) {
  const entrance = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(justUnlocked ? 1 : 0)).current;
  const tier = tierForStep(achievement.step);
  const tierColor = TIER_COLORS[tier];

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 280,
      delay: Math.min(index, 10) * 35,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!justUnlocked) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0.3, duration: 700, useNativeDriver: false }),
      ]),
      { iterations: 4 }
    ).start();
  }, [justUnlocked]);

  const isRecentlyUnlocked =
    achievement.unlocked &&
    achievement.unlockedAt &&
    Date.now() - new Date(achievement.unlockedAt).getTime() < 3 * 86_400_000;

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      <View
        style={[
          styles.achRow,
          { borderColor: achievement.unlocked ? tierColor : colors.border },
          !achievement.unlocked && styles.achRowLocked,
          (isRecentlyUnlocked || justUnlocked) && { shadowColor: tierColor, shadowOpacity: 0.6, shadowRadius: 10 },
        ]}
      >
        <View style={[styles.achIconWrap, { borderColor: tierColor }]}>
          <Text style={styles.achIcon}>{achievement.unlocked ? achievement.icon : "🔒"}</Text>
        </View>
        <View style={styles.achBody}>
          <Text style={styles.achTitle}>{achievement.title}</Text>
          <Text style={styles.achDesc} numberOfLines={2}>
            {achievement.description}
          </Text>
          {achievement.unlocked ? (
            <Text style={styles.achMeta}>
              {formatUnlockedAt(achievement.unlockedAt)} · {achievement.percentUnlocked}% der Spieler haben das auch
            </Text>
          ) : (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${achievement.progressPercent}%`, backgroundColor: tierColor },
                ]}
              />
            </View>
          )}
          {achievement.contextSentence && (
            <Text style={styles.achContext}>{achievement.contextSentence}</Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

function ProgressRing({ percent, label, color }) {
  const size = 74;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const animated = useRef(new Animated.Value(0)).current;
  const [dashOffset, setDashOffset] = useState(circumference);

  useEffect(() => {
    const id = animated.addListener(({ value }) => {
      setDashOffset(circumference - (circumference * value) / 100);
    });
    Animated.timing(animated, {
      toValue: percent,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animated.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percent]);

  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          fill="none"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={styles.ringPercent}>{Math.round(percent)}%</Text>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

function AnimatedPlayTime({ seconds }) {
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const animated = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = animated.addListener(({ value }) => setDisplaySeconds(value));
    Animated.timing(animated, {
      toValue: seconds,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animated.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  const hours = Math.floor(displaySeconds / 3600);
  const minutes = Math.floor((displaySeconds % 3600) / 60);
  return (
    <Text style={styles.playTimeValue}>
      {hours}h {minutes}m
    </Text>
  );
}

function categoryProgress(achievements, category) {
  const items = achievements.filter((a) => a.category === category);
  if (items.length === 0) return 0;
  const unlocked = items.filter((a) => a.unlocked).length;
  return (unlocked / items.length) * 100;
}

export default function AchievementsScreen() {
  const [achievements, setAchievements] = useState(null);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState("achievements");
  const [expandedCategory, setExpandedCategory] = useState("milestones");
  const [justUnlockedId, setJustUnlockedId] = useState(null);

  useEffect(() => {
    Promise.all([getAchievements(), getStats()]).then(([a, s]) => {
      setAchievements(a);
      setStats(s);
    });

    const unsubscribe = subscribeNewUnlock((updated) => {
      setAchievements((prev) => (prev ? prev.map((a) => (a.id === updated.id ? updated : a)) : prev));
      setJustUnlockedId(updated.id);
      setTimeout(() => {
        acknowledgeJustUnlocked(updated.id);
        setJustUnlockedId((current) => (current === updated.id ? null : current));
      }, 4000);
    });
    return unsubscribe;
  }, []);

  const unlockedCount = achievements?.filter((a) => a.unlocked).length ?? 0;
  const totalCount = achievements?.length ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Erfolge</Text>
        {achievements && (
          <Text style={styles.subtitle}>
            {unlockedCount} von {totalCount} freigeschaltet
          </Text>
        )}
      </View>

      <View style={styles.segmented}>
        <Pressable
          style={[styles.segmentBtn, tab === "achievements" && styles.segmentBtnActive]}
          onPress={() => setTab("achievements")}
        >
          <Text style={[styles.segmentText, tab === "achievements" && styles.segmentTextActive]}>Erfolge</Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, tab === "stats" && styles.segmentBtnActive]}
          onPress={() => setTab("stats")}
        >
          <Text style={[styles.segmentText, tab === "stats" && styles.segmentTextActive]}>Statistiken</Text>
        </Pressable>
      </View>

      {!achievements && <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />}

      {achievements && tab === "achievements" && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {CATEGORY_ORDER.map((category) => {
            const meta = CATEGORY_META[category];
            const items = achievements
              .filter((a) => a.category === category)
              .sort((a, b) => a.step - b.step);
            const expanded = expandedCategory === category;
            return (
              <View key={category} style={styles.categoryBlock}>
                <Pressable
                  style={styles.categoryHeader}
                  onPress={() => setExpandedCategory(expanded ? null : category)}
                >
                  <Text style={styles.categoryIcon}>{meta.icon}</Text>
                  <Text style={styles.categoryTitle}>{meta.label}</Text>
                  <Text style={styles.categoryPercent}>{Math.round(categoryProgress(achievements, category))}%</Text>
                  <Text style={styles.categoryChevron}>{expanded ? "▾" : "▸"}</Text>
                </Pressable>
                {expanded && (
                  <View style={styles.categoryItems}>
                    {items.map((a, i) => (
                      <AchievementRow key={a.id} achievement={a} index={i} justUnlocked={a.id === justUnlockedId} />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {achievements && stats && tab === "stats" && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.playTimeCard}>
            <Text style={styles.playTimeLabel}>Spielzeit gesamt</Text>
            <AnimatedPlayTime seconds={stats.playTimeSeconds} />
          </View>
          <View style={styles.ringsRow}>
            {CATEGORY_ORDER.map((category) => (
              <ProgressRing
                key={category}
                percent={categoryProgress(achievements, category)}
                label={CATEGORY_META[category].label}
                color={colors.gold}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: 26, fontWeight: "700", color: colors.gold },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  segmented: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.sm,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: "center" },
  segmentBtnActive: { backgroundColor: colors.goldSoft },
  segmentText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  segmentTextActive: { color: colors.gold },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  categoryBlock: {
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
  },
  categoryIcon: { fontSize: 18 },
  categoryTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
  categoryPercent: { fontSize: 12, color: colors.textMuted, marginRight: spacing.xs },
  categoryChevron: { fontSize: 12, color: colors.textMuted },
  categoryItems: { padding: spacing.sm, gap: spacing.sm },
  achRow: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  achRowLocked: { opacity: 0.55 },
  achIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  achIcon: { fontSize: 18 },
  achBody: { flex: 1, minWidth: 0 },
  achTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  achDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  achMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  achContext: { fontSize: 11, color: colors.gold, marginTop: 4, fontStyle: "italic" },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 6,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  playTimeCard: {
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playTimeLabel: { fontSize: 12, color: colors.textMuted },
  playTimeValue: { fontSize: 28, fontWeight: "800", color: colors.gold, marginTop: 4 },
  ringsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", gap: spacing.md },
  ringWrap: { alignItems: "center", width: 90, marginTop: spacing.md },
  ringPercent: { position: "absolute", top: 27, fontSize: 14, fontWeight: "800", color: colors.text },
  ringLabel: { fontSize: 10, color: colors.textMuted, marginTop: 4, textAlign: "center" },
});
