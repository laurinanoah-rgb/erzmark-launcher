import { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";

/**
 * Oben-links-Leiste über der Hauptansicht: ein Tap öffnet ein kleines Menü
 * mit "Profil wechseln" (nur die Profil-Wahl zurücksetzen) und "Abmelden"
 * (kompletter Logout, zurück zum Login). Siehe ProfileSelectScreen.jsx /
 * AppNavigator.jsx für den Gesamtfluss.
 */
export default function AccountBar({ profileName, onSwitchProfile, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.bar}>
      <Pressable style={styles.trigger} onPress={() => setMenuOpen(true)}>
        <Text style={styles.triggerText}>{profileName ?? "Account"} ▾</Text>
      </Pressable>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menu}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                onSwitchProfile();
              }}
            >
              <Text style={styles.menuItemText}>Profil wechseln</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                onLogout();
              }}
            >
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>Abmelden</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // top:104 statt 50 - sitzt sonst genau über dem neuen HomeHeader-Banner
  // (Logo/Wordmark links, Account+Abmelden rechts, siehe HomeHeader.jsx).
  bar: { position: "absolute", top: 104, left: 16, zIndex: 10 },
  trigger: { backgroundColor: "#1a1c22", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#262832" },
  triggerText: { color: "#f4f5f7", fontSize: 14, fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  menu: { position: "absolute", top: 144, left: 16, backgroundColor: "#1a1c22", borderRadius: 10, borderWidth: 1, borderColor: "#262832", overflow: "hidden", minWidth: 180 },
  menuItem: { paddingHorizontal: 16, paddingVertical: 14 },
  menuItemText: { color: "#f4f5f7", fontSize: 15 },
  menuItemDanger: { color: "#ff6b6b" },
  menuDivider: { height: 1, backgroundColor: "#262832" },
});
