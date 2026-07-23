import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Image, Pressable, TextInput, StyleSheet, Animated, Easing, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  getMyProfiles,
  uploadProfilePhoto,
  removeProfilePhoto,
  uploadProfileCover,
  removeProfileCover,
  getProfileCustomization,
  saveProfileCustomization,
  getAchievementCatalog,
} from "../api/profiles";
import { getAchievements } from "../api/achievements";
import { getStoredToken, getActiveProfileUuid, getAccountUuid } from "../api/auth";
import CoinPouch from "../components/CoinPouch";
import { colors, radius, spacing } from "../theme";

const AUTO_REFRESH_MS = 60 * 1000;
const MAX_FEATURED = 3;

// Dieselben Presets/IDs wie der Desktop-Launcher (src/api/profileEditor.js,
// BANNER_PRESETS) - solide Farben statt CSS-Gradient (RN hat ohne
// expo-linear-gradient keine native Gradient-Unterstuetzung, bewusst keine
// neue Abhaengigkeit dafuer).
const BANNER_PRESETS = [
  { id: "forge", label: "Schmiede", color: "#8a5a12" },
  { id: "frost", label: "Frost", color: "#1c5a7a" },
  { id: "jade", label: "Jade", color: "#136b4c" },
  { id: "void", label: "Void", color: "#4a2a72" },
];

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
 *
 * Profilbild/Titelbild (19.07.2026, Nutzerwunsch): eigenes, hochladbares
 * Bild PRO Charakterprofil (nicht pro Account) - ersetzt/überlagert den
 * automatischen Minecraft-Skin-Avatar nur, wenn eines gesetzt ist, der
 * Skin bleibt sonst der Fallback. Titelbild liegt als Banner hinter dem
 * Hero-Bereich.
 */
export default function ProfileScreen() {
  const [token, setToken] = useState(null);
  const [accountUuid, setAccountUuid] = useState(null);
  const [activeProfile, setActiveProfile] = useState(undefined);
  const [uploadingField, setUploadingField] = useState(null); // "photo" | "cover" | null
  const [uploadError, setUploadError] = useState(null);

  const [customization, setCustomization] = useState(null);
  const [bioDraft, setBioDraft] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [unlockedIds, setUnlockedIds] = useState(new Set());
  const [customizationSaving, setCustomizationSaving] = useState(false);
  const [customizationError, setCustomizationError] = useState(null);

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const [t, activeUuid, realUuid] = await Promise.all([
        getStoredToken(),
        getActiveProfileUuid(),
        getAccountUuid(),
      ]);
      if (cancelled) return;
      setToken(t);
      setAccountUuid(realUuid);
      try {
        const profiles = await getMyProfiles(t);
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
    if (!token) return;
    let cancelled = false;

    Promise.all([getProfileCustomization(token), getAchievementCatalog(), getAchievements()])
      .then(([custom, catalogEntries, achievements]) => {
        if (cancelled) return;
        setCustomization(custom);
        setBioDraft(custom.bio ?? "");
        setCatalog(catalogEntries);
        setUnlockedIds(new Set(achievements.filter((a) => a.unlocked).map((a) => a.id)));
      })
      .catch((err) => {
        if (!cancelled) setCustomizationError(err?.message ?? String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function persistCustomization(next) {
    setCustomizationSaving(true);
    setCustomizationError(null);
    try {
      const saved = await saveProfileCustomization(token, next);
      setCustomization(saved);
    } catch (err) {
      setCustomizationError(err?.message ?? String(err));
    } finally {
      setCustomizationSaving(false);
    }
  }

  function handleSelectBanner(bannerId) {
    if (!customization) return;
    persistCustomization({ ...customization, bannerId });
  }

  function handleToggleFeatured(id) {
    if (!customization) return;
    const current = customization.featuredAchievementIds ?? [];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : current.length < MAX_FEATURED
        ? [...current, id]
        : current;
    if (next === current) return;
    persistCustomization({ ...customization, featuredAchievementIds: next });
  }

  function handleSaveBio() {
    if (!customization) return;
    persistCustomization({ ...customization, bio: bioDraft });
  }

  async function pickAndUpload(field) {
    setUploadError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploadError("Zugriff auf Fotos wurde nicht erlaubt.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: field === "cover" ? [16, 9] : [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingField(field);
    try {
      const response =
        field === "photo"
          ? await uploadProfilePhoto(token, result.assets[0])
          : await uploadProfileCover(token, result.assets[0]);
      setActiveProfile((prev) => ({
        ...prev,
        photoUrl: field === "photo" ? response.photoUrl : prev.photoUrl,
        coverUrl: field === "cover" ? response.coverUrl : prev.coverUrl,
      }));
    } catch (err) {
      setUploadError(err?.message ?? String(err));
    } finally {
      setUploadingField(null);
    }
  }

  async function removeImage(field) {
    setUploadError(null);
    setUploadingField(field);
    try {
      if (field === "photo") {
        await removeProfilePhoto(token);
        setActiveProfile((prev) => ({ ...prev, photoUrl: null }));
      } else {
        await removeProfileCover(token);
        setActiveProfile((prev) => ({ ...prev, coverUrl: null }));
      }
    } catch (err) {
      setUploadError(err?.message ?? String(err));
    } finally {
      setUploadingField(null);
    }
  }

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
        <View style={styles.coverWrap}>
          {activeProfile.coverUrl ? (
            <Image source={{ uri: activeProfile.coverUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}
          <View style={styles.coverActionsRow}>
            <Pressable
              style={styles.coverActionBtn}
              onPress={() => pickAndUpload("cover")}
              disabled={uploadingField === "cover"}
            >
              <Text style={styles.coverActionText}>
                {uploadingField === "cover" ? "Lädt…" : activeProfile.coverUrl ? "Titelbild ändern" : "Titelbild hinzufügen"}
              </Text>
            </Pressable>
            {activeProfile.coverUrl && uploadingField !== "cover" && (
              <Pressable style={styles.coverActionBtn} onPress={() => removeImage("cover")}>
                <Text style={styles.coverActionTextDanger}>Entfernen</Text>
              </Pressable>
            )}
          </View>
        </View>

        <Animated.View style={[styles.hero, { opacity: heroFade, transform: [{ scale: heroScale }] }]}>
          <Pressable style={styles.skinRing} onPress={() => pickAndUpload("photo")} disabled={uploadingField === "photo"}>
            <View style={styles.skinRingInner}>
              {activeProfile.photoUrl ? (
                <Image source={{ uri: activeProfile.photoUrl }} style={styles.skinImage} />
              ) : accountUuid ? (
                <Image
                  source={{ uri: `https://crafatar.com/avatars/${accountUuid}?size=128&overlay` }}
                  style={styles.skinImage}
                />
              ) : (
                <View style={styles.skinImage} />
              )}
              {uploadingField === "photo" && (
                <View style={styles.skinUploadOverlay}>
                  <ActivityIndicator color={colors.gold} />
                </View>
              )}
            </View>
            <View style={styles.editBadge}>
              <Text style={styles.editBadgeText}>✎</Text>
            </View>
          </Pressable>
          {activeProfile.photoUrl && (
            <Pressable onPress={() => removeImage("photo")} disabled={uploadingField === "photo"}>
              <Text style={styles.removePhotoLink}>Eigenes Profilbild entfernen</Text>
            </Pressable>
          )}
          {uploadError && <Text style={styles.error}>{uploadError}</Text>}

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

        {customization && (
          <View style={styles.customizationCard}>
            <Text style={styles.cardTitle}>Über mich</Text>
            <TextInput
              style={styles.bioInput}
              multiline
              maxLength={280}
              placeholder="Ein paar Worte über dich…"
              placeholderTextColor={colors.textMuted}
              value={bioDraft}
              onChangeText={setBioDraft}
              onBlur={() => {
                if (bioDraft !== (customization.bio ?? "")) handleSaveBio();
              }}
            />

            <Text style={styles.cardTitle}>Banner</Text>
            <View style={styles.bannerRow}>
              {BANNER_PRESETS.map((preset) => (
                <Pressable
                  key={preset.id}
                  style={[
                    styles.bannerSwatch,
                    { backgroundColor: preset.color },
                    customization.bannerId === preset.id && styles.bannerSwatchActive,
                  ]}
                  onPress={() => handleSelectBanner(preset.id)}
                />
              ))}
            </View>

            <Text style={styles.cardTitle}>
              Sichtbare Erfolge/Sticker ({(customization.featuredAchievementIds ?? []).length}/{MAX_FEATURED})
            </Text>
            <View style={styles.stickerRow}>
              {catalog
                .filter((entry) => unlockedIds.has(entry.id))
                .map((entry) => {
                  const selected = (customization.featuredAchievementIds ?? []).includes(entry.id);
                  return (
                    <Pressable
                      key={entry.id}
                      style={[styles.stickerChip, selected && styles.stickerChipActive]}
                      onPress={() => handleToggleFeatured(entry.id)}
                    >
                      <Text style={styles.stickerIcon}>{entry.icon}</Text>
                      <Text style={[styles.stickerLabel, selected && styles.stickerLabelActive]} numberOfLines={1}>
                        {entry.title}
                      </Text>
                    </Pressable>
                  );
                })}
              {catalog.filter((entry) => unlockedIds.has(entry.id)).length === 0 && (
                <Text style={styles.empty}>Noch keine freigeschalteten Erfolge zum Vorstellen.</Text>
              )}
            </View>

            {customizationSaving && <Text style={styles.customizationHint}>Speichert…</Text>}
            {customizationError && <Text style={styles.error}>{customizationError}</Text>}
          </View>
        )}

        <View style={styles.statsGrid}>
          <StatTile icon="📜" value={activeProfile.questsCompleted ?? 0} label="Quests" index={0} />
          <StatTile icon="⏱" value={formatPlayTime(activeProfile.playTime)} label="Spielzeit" index={1} />
        </View>

        <View style={styles.pouchCard}>
          <CoinPouch coins={activeProfile.coins} />
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
  coverWrap: {
    height: 120,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  coverImage: { width: "100%", height: "100%", resizeMode: "cover" },
  coverPlaceholder: { flex: 1, backgroundColor: colors.bgElevated },
  coverActionsRow: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm,
  },
  coverActionBtn: {
    backgroundColor: "rgba(15,19,26,0.75)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  coverActionText: { fontSize: 11, fontWeight: "700", color: colors.gold },
  coverActionTextDanger: { fontSize: 11, fontWeight: "700", color: colors.danger },
  skinUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,19,26,0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 56,
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.bg,
  },
  editBadgeText: { fontSize: 13, color: colors.bg, fontWeight: "800" },
  removePhotoLink: { fontSize: 11, color: colors.textMuted, textDecorationLine: "underline" },
  error: { fontSize: 12, color: colors.danger },
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
  },
  skinRingInner: {
    width: 108,
    height: 108,
    borderRadius: 54,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  skinImage: { width: 88, height: 88, resizeMode: "contain" },
  nameLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  name: { fontSize: 22, fontWeight: "800", color: colors.text },
  rankIcon: { width: 26, height: 26, resizeMode: "contain" },
  rankBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  rankBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase", color: "#fff" },
  subline: { fontSize: 14, color: colors.textMuted },
  pouchCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  customizationCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase", color: colors.textMuted, marginTop: spacing.sm },
  bioInput: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    color: colors.text,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: "top",
  },
  bannerRow: { flexDirection: "row", gap: spacing.sm },
  bannerSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "transparent" },
  bannerSwatchActive: { borderColor: colors.gold },
  stickerRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stickerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 150,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  stickerChipActive: { borderColor: colors.gold, backgroundColor: "rgba(255,185,0,0.12)" },
  stickerIcon: { fontSize: 14 },
  stickerLabel: { fontSize: 11, color: colors.textMuted },
  stickerLabelActive: { color: colors.gold, fontWeight: "700" },
  customizationHint: { fontSize: 11, color: colors.textMuted },
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
