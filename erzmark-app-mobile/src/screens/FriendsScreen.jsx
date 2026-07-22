import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Image, FlatList, ActivityIndicator, StyleSheet, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFriends, removeFriend } from "../api/friends";
import { getAccountUuid, getActiveProfileUuid, getStoredToken } from "../api/auth";
import { useNotifications } from "../state/NotificationsContext";
import FriendProfileModal from "../components/FriendProfileModal";
import { colors, radius, spacing } from "../theme";

// Freunde sind pro MMOProfiles-Charakter getrennt gespeichert (siehe
// PlayerController::friendsForProfile im MineTrax-Backend), deshalb hier -
// wie in FriendsPreview.jsx - die aktive Profil-UUID nutzen statt der
// festen Account-UUID.
const AUTO_REFRESH_MS = 60 * 1000;

/** Eine Freundeszeile, fadet/rutscht gestaffelt (per `index`) beim ersten Laden ein. */
function FriendRow({ friend, index, onRemove, removing, onOpenProfile }) {
  const entrance = useRef(new Animated.Value(0)).current;
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index, 12) * 40,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [{ translateX: entrance.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
      }}
    >
      <View style={styles.row}>
        <Image
          style={styles.avatar}
          source={{ uri: friend.photoUrl ?? `https://crafatar.com/avatars/${friend.uuid}?size=48&overlay` }}
        />
        <View style={[styles.dot, friend.online ? styles.dotOnline : styles.dotOffline]} />
        <Pressable style={styles.nameBtn} onPress={() => onOpenProfile(friend)} hitSlop={4}>
          <Text style={styles.name} numberOfLines={1}>{friend.name}</Text>
        </Pressable>
        {!confirming && (
          <Text style={styles.status}>{friend.online ? "Online" : formatLastSeen(friend.lastSeen)}</Text>
        )}
        {confirming ? (
          <View style={styles.confirmGroup}>
            <Pressable onPress={() => onRemove(friend.uuid)} disabled={removing} hitSlop={6}>
              <Text style={styles.confirmBtn}>{removing ? "…" : "Wirklich?"}</Text>
            </Pressable>
            <Pressable onPress={() => setConfirming(false)} disabled={removing} hitSlop={6}>
              <Text style={styles.confirmCancel}>Abbrechen</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setConfirming(true)} hitSlop={8}>
            <Text style={styles.removeBtn}>✕</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

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
  const [removingUuid, setRemovingUuid] = useState(null);
  const [openProfileFriend, setOpenProfileFriend] = useState(null);
  const { friendRequests, respondFriendRequest } = useNotifications();
  // Server-seitig wirkt "Entfernen" asynchron (live falls online, sonst
  // sobald offline) - bis MMOCore das uebernommen hat, lokal ausblenden,
  // gleiches Muster wie im Desktop-Launcher (FriendsList.jsx).
  const pendingRemovalsRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    let intervalId;

    function refresh(uuid) {
      getFriends(uuid)
        .then((result) => {
          if (cancelled) return;
          const visible = result.filter((f) => !pendingRemovalsRef.current.has(f.uuid));
          const sorted = [...visible].sort((a, b) => Number(b.online) - Number(a.online));
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

  async function handleRemove(uuid) {
    setRemovingUuid(uuid);
    try {
      const token = await getStoredToken();
      await removeFriend(token, uuid);
      pendingRemovalsRef.current.add(uuid);
      setFriends((prev) => (prev ?? []).filter((f) => f.uuid !== uuid));
      setOpenProfileFriend(null);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setRemovingUuid(null);
    }
  }

  const onlineCount = friends?.filter((f) => f.online).length ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Freunde</Text>
        {friends && friends.length > 0 && (
          <Text style={styles.subtitle}>{onlineCount} von {friends.length} online</Text>
        )}
      </View>

      {friendRequests.length > 0 && (
        <View style={styles.requestList}>
          {friendRequests.map((req) => (
            <View key={req.id} style={styles.requestCard}>
              <Text style={styles.requestText}>
                <Text style={styles.requestStrong}>{req.data.requesterName}</Text> möchte mit dir befreundet sein.
                Akzeptieren?
              </Text>
              <View style={styles.requestActions}>
                <Text style={styles.requestAccept} onPress={() => respondFriendRequest(req.id, true)}>
                  Annehmen
                </Text>
                <Text style={styles.requestDecline} onPress={() => respondFriendRequest(req.id, false)}>
                  Ablehnen
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {friends === undefined && <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.lg }} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {friends && friends.length === 0 && !error && friendRequests.length === 0 && (
        <Text style={styles.empty}>Noch keine Freunde – füge welche im Spiel mit /friends hinzu.</Text>
      )}

      <FlatList
        data={friends ?? []}
        keyExtractor={(item) => item.uuid}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <FriendRow
            friend={item}
            index={index}
            onRemove={handleRemove}
            removing={removingUuid === item.uuid}
            onOpenProfile={setOpenProfileFriend}
          />
        )}
      />

      <FriendProfileModal
        friend={openProfileFriend}
        onClose={() => setOpenProfileFriend(null)}
        onRemove={handleRemove}
        removing={removingUuid === openProfileFriend?.uuid}
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
  requestList: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  requestCard: {
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: "rgba(66, 183, 250, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(66, 183, 250, 0.3)",
  },
  requestText: { fontSize: 13, color: colors.text, lineHeight: 18, marginBottom: spacing.sm },
  requestStrong: { fontWeight: "800" },
  requestActions: { flexDirection: "row", gap: spacing.lg },
  requestAccept: { fontSize: 13, fontWeight: "800", color: colors.gold },
  requestDecline: { fontSize: 13, color: colors.textMuted, textDecorationLine: "underline" },
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
  avatar: { width: 28, height: 28, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.25)" },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotOnline: { backgroundColor: "#3ddc84" },
  dotOffline: { backgroundColor: "rgba(255,255,255,0.2)" },
  nameBtn: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "700", color: colors.text },
  status: { fontSize: 12, color: colors.textMuted },
  removeBtn: { fontSize: 13, color: colors.textMuted, paddingHorizontal: 4 },
  confirmGroup: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  confirmBtn: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.danger,
    borderWidth: 1,
    borderColor: "rgba(239,67,67,0.5)",
    backgroundColor: "rgba(239,67,67,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  confirmCancel: { fontSize: 11, color: colors.textMuted, textDecorationLine: "underline" },
});
