import { useState } from "react";
import { View, Text, Image, Pressable, Modal, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../theme";

/**
 * Discord-artiges Profil-Popup fuer einen Freund (22.07.2026, Nutzerwunsch),
 * mobiles Pendant zu FriendProfilePopup.jsx im Desktop-Launcher - oeffnet
 * sich beim Tippen auf den Namen in der Freundesliste. Der Chat-Button ist
 * bewusst als "bald verfuegbar" markiert, bis die Realtime-Chat-Funktion
 * (Reverb) gebaut ist.
 */
export default function FriendProfileModal({ friend, onClose, onRemove, removing }) {
  const [confirming, setConfirming] = useState(false);
  if (!friend) return null;

  function handleClose() {
    setConfirming(false);
    onClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Profil</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.hero}>
            <Image
              style={styles.avatar}
              source={{ uri: friend.photoUrl ?? `https://crafatar.com/avatars/${friend.uuid}?size=96&overlay` }}
            />
            <View>
              <Text style={styles.name}>{friend.name}</Text>
              <Text style={[styles.status, friend.online && styles.statusOnline]}>
                {friend.online ? "Online" : "Offline"}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <View style={styles.chatBtn}>
              <Text style={styles.chatBtnText}>💬 Chat (bald verfügbar)</Text>
            </View>

            {confirming ? (
              <View style={styles.confirmGroup}>
                <Pressable onPress={() => onRemove(friend.uuid)} disabled={removing} hitSlop={6}>
                  <Text style={styles.confirmBtn}>{removing ? "…" : "Wirklich entfernen?"}</Text>
                </Pressable>
                <Pressable onPress={() => setConfirming(false)} disabled={removing} hitSlop={6}>
                  <Text style={styles.confirmCancel}>Abbrechen</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setConfirming(true)} hitSlop={6}>
                <Text style={styles.removeBtn}>Freund entfernen</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  panel: {
    width: 300,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.goldSoft,
  },
  title: { fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", color: colors.gold },
  close: { fontSize: 14, color: colors.textMuted },
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.25)" },
  name: { fontSize: 17, fontWeight: "800", color: colors.text },
  status: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  statusOnline: { color: "#3ddc84" },
  actions: { padding: spacing.lg, paddingTop: 0, gap: spacing.md, alignItems: "flex-start" },
  chatBtn: {
    borderWidth: 1,
    borderColor: colors.goldSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    opacity: 0.5,
  },
  chatBtnText: { fontSize: 12, fontWeight: "700", color: colors.text },
  removeBtn: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.danger,
    borderWidth: 1,
    borderColor: "rgba(239,67,67,0.4)",
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: "hidden",
  },
  confirmGroup: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  confirmBtn: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.danger,
    borderWidth: 1,
    borderColor: "rgba(239,67,67,0.5)",
    backgroundColor: "rgba(239,67,67,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  confirmCancel: { fontSize: 12, color: colors.textMuted, textDecorationLine: "underline" },
});
