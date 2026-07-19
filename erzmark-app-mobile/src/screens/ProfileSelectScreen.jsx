import { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Platform, Animated, Easing, Image } from "react-native";
import Constants from "expo-constants";
import { getMyProfiles, reportAppError } from "../api/profiles";
import { getStoredToken, storeActiveProfileUuid, logout } from "../api/auth";
import { colors, radius, spacing } from "../theme";

/** "WARRIOR" -> "Warrior", gleiche Formatierung wie ProfileCard.jsx/CharacterProfiles.jsx. */
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
  if (!totalSeconds) return null;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// Gleiche Rang-Textbadges wie ProfileCard.jsx - eigenes Badge statt der
// Nexo-Glyphen/PlaceholderAPI-Prefixe, die nur im Minecraft-Client mit
// Resourcepack darstellbar sind (siehe dortiger Kommentar).
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
 * Eine "Spielstand"-Karte (ein MMOProfiles-Charakterprofil). Fadet/rutscht
 * beim ersten Rendern einzeln nach oben ein (Stagger über `index`, siehe
 * `entranceDelay`), damit die Liste nicht abrupt erscheint. Beim Antippen
 * federt die Karte kurz ein ("Press-Feedback"), bevor `onSelect` feuert.
 */
function ProfileSlotCard({ profile, index, selecting, disabled, onSelect }) {
  const entrance = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      delay: index * 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePressIn() {
    Animated.spring(pressScale, { toValue: 0.97, friction: 6, tension: 120, useNativeDriver: true }).start();
  }
  function handlePressOut() {
    Animated.spring(pressScale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }).start();
  }

  const className = prettifyClassName(profile.className);
  const playTime = formatPlayTime(profile.playTime);
  const lastPlayed = formatLastPlayed(profile.lastPlayedAt);
  const rankBadge = profile.rankIconUrl ? null : getRankBadge(profile.rankName);
  const isSelecting = selecting === profile.uuid;

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          { scale: pressScale },
        ],
      }}
    >
      <Pressable
        style={styles.card}
        onPress={() => onSelect(profile)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.identity}>
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
            <Text style={styles.profileName} numberOfLines={1}>{profile.name}</Text>
          </View>
          {isSelecting ? (
            <ActivityIndicator color={colors.gold} />
          ) : (
            <Text style={styles.chevron}>›</Text>
          )}
        </View>

        {(className || profile.level != null) && (
          <Text style={styles.profileMeta}>
            {[className, profile.level != null ? `Level ${profile.level}` : null].filter(Boolean).join(" · ")}
          </Text>
        )}

        {(playTime || lastPlayed) && (
          <View style={styles.footerRow}>
            {playTime && <Text style={styles.footerText}>⏱ {playTime} gespielt</Text>}
            {lastPlayed && <Text style={styles.footerText}>Zuletzt: {lastPlayed}</Text>}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Erscheint im Start-Flow nach Update-Check und Login, bevor die
 * Hauptansicht geladen wird (nicht in den Einstellungen versteckt!) - siehe
 * AppNavigator.jsx. Erscheint bewusst bei JEDEM App-Start (nicht nur beim
 * ersten Login, siehe dortiger Kommentar), damit man sein Profil/seinen
 * Spielstand immer bewusst wählt statt automatisch im letzten zu landen.
 *
 * `onLogout` ist bewusst hier verfügbar (nicht nur im Einstellungen-Tab der
 * Haupt-Tabs) - falls das Laden der Profile fehlschlägt (z.B. falscher/
 * abgelaufener Token), gäbe es sonst keinen Weg zurück zum Login-Screen.
 */
export default function ProfileSelectScreen({ onProfileSelected, onLogout }) {
  const [profiles, setProfiles] = useState(undefined); // undefined = lädt
  const [error, setError] = useState(null);
  const [selecting, setSelecting] = useState(null);
  const [reportStatus, setReportStatus] = useState(null); // null | "sending" | "sent" | "failed"

  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFade, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    getStoredToken()
      .then(token => getMyProfiles(token))
      .then(setProfiles)
      .catch(err => {
        setError(err?.message ?? String(err));
        setProfiles([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSelect(profile) {
    setSelecting(profile.uuid);
    try {
      await storeActiveProfileUuid(profile.uuid);
      onProfileSelected(profile.uuid);
    } finally {
      setSelecting(null);
    }
  }

  async function handleLogout() {
    const remaining = await logout();
    onLogout(remaining);
  }

  async function handleReportError() {
    setReportStatus("sending");
    try {
      const token = await getStoredToken();
      await reportAppError(token, {
        message: error,
        context: "ProfileSelectScreen",
        appVersion: Constants.expoConfig?.version ?? "0.0.0",
        platform: Platform.OS,
      });
      setReportStatus("sent");
    } catch {
      setReportStatus("failed");
    }
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          opacity: headerFade,
          transform: [{ translateY: headerFade.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
        }}
      >
        <Text style={styles.title}>Spielstände</Text>
        <Text style={styles.subtitle}>Mit welchem Charakter möchtest du weitermachen?</Text>
      </Animated.View>

      {profiles === undefined && <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} />}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          {reportStatus === "sent" ? (
            <Text style={styles.reportSent}>✓ Fehler wurde ans Team gemeldet, danke!</Text>
          ) : (
            <Pressable
              style={styles.reportButton}
              onPress={handleReportError}
              disabled={reportStatus === "sending"}
            >
              {reportStatus === "sending" ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <Text style={styles.reportButtonText}>
                  {reportStatus === "failed" ? "Fehlgeschlagen, nochmal versuchen" : "Fehler melden"}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      <FlatList
        data={profiles ?? []}
        keyExtractor={item => item.uuid}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
        renderItem={({ item, index }) => (
          <ProfileSlotCard
            profile={item}
            index={index}
            selecting={selecting}
            disabled={selecting !== null}
            onSelect={handleSelect}
          />
        )}
        ListEmptyComponent={
          profiles !== undefined && !error ? (
            <View style={styles.emptyBox}>
              <Text style={styles.placeholder}>Kein Profil gefunden.</Text>
              <Text style={styles.placeholderHint}>
                So bekommst du eins: Starte Minecraft, verbinde dich mit dem Erzmark-Server, klicke dort
                auf „Play" und wähle im sich öffnenden Menü deinen Charakter aus (oder erstelle einen
                neuen). Danach erscheint er automatisch auch hier in der App.
              </Text>
            </View>
          ) : null
        }
      />

      <Pressable onPress={handleLogout} style={styles.logoutLink}>
        <Text style={styles.logoutText}>Abmelden</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, paddingTop: 70 },
  title: { fontSize: 28, fontWeight: "800", color: colors.gold, marginBottom: 6, letterSpacing: 0.3 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.xl },
  emptyBox: { marginTop: spacing.md, gap: spacing.sm },
  placeholder: { color: colors.text, fontSize: 15, fontWeight: "600" },
  placeholderHint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  errorBox: { marginBottom: spacing.xl, gap: spacing.sm },
  error: { color: colors.danger },
  reportButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  reportButtonText: { color: colors.bg, fontSize: 13, fontWeight: "700" },
  reportSent: { color: colors.success, fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 1 },
  profileName: { color: colors.text, fontSize: 18, fontWeight: "700", flexShrink: 1 },
  rankIconRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
  rankIcon: { width: 20, height: 20, resizeMode: "contain" },
  rankBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  rankBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase", color: "#fff" },
  chevron: { color: colors.goldSoft, fontSize: 24, fontWeight: "700" },
  profileMeta: { color: colors.textMuted, fontSize: 13 },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.goldSoft,
  },
  footerText: { color: colors.textMuted, fontSize: 11 },
  logoutLink: { alignSelf: "center", marginTop: spacing.lg, padding: spacing.sm },
  logoutText: { color: colors.textMuted, fontSize: 14, textDecorationLine: "underline" },
});
