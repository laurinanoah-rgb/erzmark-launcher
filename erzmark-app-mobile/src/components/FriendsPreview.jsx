import { useEffect, useState } from "react";
import { View, Text, Image, ActivityIndicator, StyleSheet } from "react-native";
import { getFriends } from "../api/friends";
import { getAccountUuid, getActiveProfileUuid } from "../api/auth";
import { colors, radius, spacing } from "../theme";

// Online-Status kann sich jederzeit aendern, analog zu FriendsList.jsx im
// Launcher - regelmaessig neu laden, waehrend der Screen offen bleibt.
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

/** Kompakte Freundesliste (MMOCore), Pendant zu FriendsList.jsx im Launcher. */
export default function FriendsPreview() {
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

    // Freunde sind pro MMOProfiles-Charakter getrennt gespeichert (siehe
    // PlayerController::friendsForProfile im MineTrax-Backend) - deshalb hier
    // die aktive Profil-UUID nutzen, nicht die feste Account-UUID. Fallback
    // auf die Account-UUID falls (noch) kein Profil aktiv gewaehlt ist.
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
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        👥 Freunde{friends && friends.length > 0 ? ` (${onlineCount}/${friends.length})` : ""}
      </Text>

      {friends === undefined && <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.md }} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {friends && friends.length === 0 && !error && (
        <Text style={styles.empty}>Noch keine Freunde – füge welche im Spiel hinzu.</Text>
      )}

      <View style={{ gap: spacing.xs }}>
        {friends?.map((friend) => (
          <View key={friend.uuid} style={styles.row}>
            <Image
              style={styles.avatar}
              source={{ uri: friend.photoUrl ?? `https://crafatar.com/avatars/${friend.uuid}?size=32&overlay` }}
            />
            <View style={[styles.dot, friend.online ? styles.dotOnline : styles.dotOffline]} />
            <Text style={styles.name} numberOfLines={1}>{friend.name}</Text>
            {!friend.online && <Text style={styles.lastSeen}>{formatLastSeen(friend.lastSeen)}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.xl, gap: spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.gold,
  },
  error: { color: colors.danger, fontSize: 12 },
  empty: { color: colors.textMuted, fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  avatar: { width: 22, height: 22, borderRadius: 5, backgroundColor: "rgba(0,0,0,0.25)" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOnline: { backgroundColor: "#3ddc84" },
  dotOffline: { backgroundColor: "rgba(255,255,255,0.2)" },
  name: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.text },
  lastSeen: { fontSize: 10, color: colors.textMuted },
});
