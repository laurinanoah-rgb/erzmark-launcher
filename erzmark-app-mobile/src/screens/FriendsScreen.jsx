import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFriends } from "../api/friends";
import { getAccountUuid, getActiveProfileUuid } from "../api/auth";
import { colors, radius, spacing } from "../theme";

// Freunde sind pro MMOProfiles-Charakter getrennt gespeichert (siehe
// PlayerController::friendsForProfile im MineTrax-Backend), deshalb hier -
// wie in FriendsPreview.jsx - die aktive Profil-UUID nutzen statt der
// festen Account-UUID.
const AUTO_REFRESH_MS = 60 * 1000;

function formatLastSeen(unixSeconds) {
  if (!unixSeconds) return "";
  const diffMs = Date.now() - unixSeconds * 1000;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days === 1 ? "" : "en"}`;
}

/** Volle Freundesliste (MMOCore) des aktiven Profils, mit Online-Status. */
export default function FriendsScreen() {
  const [friends, setFriends] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId;

    function refresh(uuid) {
      getFriends(uuid)
        .then((result) => {
          if (cancelled) return;
          const sorted = [...result].sort((a, b) => Number(b.online) - Number(a.online));
          setFriends(sorted);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err?.message ?? String(err));
          setFriends((prev) => prev ?? []);
        });
    }

    Promise.all([getActiveProfileUuid(), getAccountUuid()]).then(([activeUuid, accountUuid]) => {
      if (cancelled) return;
      const uuid = activeUuid ?? accountUuid;
      refresh(uuid);
      intervalId = setInterval(() => refresh(uuid), AUTO_REFRESH_MS);
    });

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  const onlineCount = friends?.filter((f) => f.online).length ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Freunde</Text>
        {friends && friends.length > 0 && (
          <Text style={styles.subtitle}>{onlineCount} von {friends.length} online</Text>
        )}
      </View>

      {friends === undefined && <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.lg }} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {friends && friends.length === 0 && !error && (
        <Text style={styles.empty}>Noch keine Freunde – füge welche im Spiel mit /friends hinzu.</Text>
      )}

      <FlatList
        data={friends ?? []}
        keyExtractor={(item) => item.uuid}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.dot, item.online ? styles.dotOnline : styles.dotOffline]} />
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.status}>
              {item.online ? "Online" : formatLastSeen(item.lastSeen)}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: 26, fontWeight: "700", color: colors.gold },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  error: { color: colors.danger, marginHorizontal: spacing.lg, marginTop: spacing.sm },
  empty: { color: colors.textMuted, marginHorizontal: spacing.lg, marginTop: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotOnline: { backgroundColor: "#3ddc84" },
  dotOffline: { backgroundColor: "rgba(255,255,255,0.2)" },
  name: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
  status: { fontSize: 12, color: colors.textMuted },
});
