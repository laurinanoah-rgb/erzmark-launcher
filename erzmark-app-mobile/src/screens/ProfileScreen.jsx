import { View, Text, StyleSheet } from "react-native";

// TODO: 3D-Skin-Vorschau (react-native passendes Äquivalent zu skinview3d
// im Launcher finden, z.B. WebView mit skinview3d oder eine native
// GL-Lösung), Charakter-Stats, zuletzt gespielte Klasse, Teilen-Button für
// die "Visitenkarte" (siehe PLANNING.md Hype-Idee #1).
export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil</Text>
      <Text style={styles.placeholder}>
        TODO: Skin-Vorschau, Stats, zuletzt gespielte Klasse, teilbare
        Charakter-Karte
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0f12", padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: "700", color: "#f2c94c" },
  placeholder: { color: "#8a8d98", marginTop: 12 },
});
