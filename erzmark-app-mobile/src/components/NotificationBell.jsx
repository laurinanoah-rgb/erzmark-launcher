import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal, FlatList, StyleSheet, Animated, Easing } from "react-native";
import { useNotifications } from "../state/NotificationsContext";
import { colors, radius, spacing } from "../theme";

function formatRelativeTime(ms) {
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std`;
  return `vor ${Math.floor(diffH / 24)} Tag${Math.floor(diffH / 24) === 1 ? "" : "en"}`;
}

/**
 * Benachrichtigungs-Glocke, mobiles Pendant zu
 * src/components/NotificationBell.jsx im Desktop-Launcher: pulsiert/wackelt
 * in Endlosschleife, solange ungelesene Freundschaftsanfragen da sind, Tap
 * öffnet ein Panel, Schließen markiert alles als gelesen (Badge/Glow-Reset) -
 * offene Anfragen bleiben trotzdem bis zur Annahme/Ablehnung aktionierbar.
 */
export default function NotificationBell() {
  const { notifications, unreadCount, respondFriendRequest, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const rock = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (unreadCount === 0) {
      rock.setValue(0);
      glow.setValue(0);
      return;
    }

    const rockLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(rock, { toValue: 1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(rock, { toValue: -1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(rock, { toValue: 0.5, duration: 80, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(rock, { toValue: 0, duration: 80, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.35, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    rockLoop.start();
    glowLoop.start();
    return () => {
      rockLoop.stop();
      glowLoop.stop();
    };
  }, [unreadCount, rock, glow]);

  const rotate = rock.interpolate({ inputRange: [-1, 1], outputRange: ["-16deg", "16deg"] });

  function close() {
    setOpen(false);
    markAllRead();
  }

  const sorted = [...notifications].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} style={styles.bellWrap}>
        {unreadCount > 0 && <Animated.View style={[styles.glowCircle, { opacity: glow }]} />}
        <Animated.Text
          style={[styles.bellIcon, unreadCount > 0 && styles.bellIconAlert, { transform: [{ rotate }] }]}
        >
          🔔
        </Animated.Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Benachrichtigungen</Text>
              <Pressable onPress={close} hitSlop={8}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            {sorted.length === 0 && <Text style={styles.empty}>Keine Benachrichtigungen.</Text>}

            <FlatList
              data={sorted}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <View style={[styles.item, !item.read && styles.itemUnread]}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemText}>
                    <Text style={styles.itemStrong}>{item.data.requesterName}</Text> {item.body}
                  </Text>
                  <Text style={styles.itemTime}>{formatRelativeTime(item.createdAt)}</Text>

                  {item.data.status === "pending" ? (
                    <View style={styles.actions}>
                      <Pressable style={styles.acceptBtn} onPress={() => respondFriendRequest(item.id, true)}>
                        <Text style={styles.acceptText}>Annehmen</Text>
                      </Pressable>
                      <Pressable onPress={() => respondFriendRequest(item.id, false)} hitSlop={6}>
                        <Text style={styles.declineText}>Ablehnen</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.status,
                        item.data.status === "accepted" ? styles.statusAccepted : styles.statusDeclined,
                      ]}
                    >
                      {item.data.status === "accepted" ? "Angenommen" : "Abgelehnt"}
                    </Text>
                  )}
                </View>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellWrap: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  glowCircle: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(239,67,67,0.4)",
  },
  bellIcon: { fontSize: 19, opacity: 0.75 },
  bellIconAlert: { opacity: 1 },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 9, fontWeight: "800", color: "#fff" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "flex-end" },
  panel: {
    marginTop: 60,
    marginRight: spacing.md,
    width: 300,
    maxHeight: "70%",
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    overflow: "hidden",
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.goldSoft,
  },
  panelTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  close: { fontSize: 14, color: colors.textMuted },
  empty: { color: colors.textMuted, padding: spacing.md, fontSize: 13 },
  list: { padding: spacing.sm },
  item: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
    marginBottom: spacing.xs,
  },
  itemUnread: { borderLeftColor: colors.gold, backgroundColor: "rgba(255,185,0,0.07)" },
  itemTitle: { fontSize: 12, fontWeight: "800", color: colors.text, marginBottom: 2 },
  itemText: { fontSize: 12, color: colors.textMuted },
  itemStrong: { fontWeight: "800", color: colors.text },
  itemTime: { fontSize: 10, color: colors.textMuted, opacity: 0.8, marginTop: 3 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 6 },
  acceptBtn: { backgroundColor: colors.gold, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill },
  acceptText: { fontSize: 11, fontWeight: "800", color: colors.bg },
  declineText: { fontSize: 11, color: colors.textMuted, textDecorationLine: "underline" },
  status: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", marginTop: 4 },
  statusAccepted: { color: colors.success },
  statusDeclined: { color: colors.textMuted },
});
