import { View, Text, StyleSheet } from "react-native";

// TODO: Freundesliste + Live-Online-Status (Push bei "Freund online"),
// siehe PLANNING.md Phase 2. Kann strukturell an FriendsList.jsx aus dem
// Launcher angelehnt werden (gleicher Backend-Endpunkt).
export default function FriendsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Freunde</Text>
      <Text style={styles.placeholder}>TODO: Freundesliste + Online-Status</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0f12", padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: "700", color: "#f2c94c" },
  placeholder: { color: "#8a8d98", marginTop: 12 },
});
