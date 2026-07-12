import { View, Text, StyleSheet } from "react-native";

/**
 * Dashboard: Server-Status (Spieleranzahl), nächstes Boss-Event-Cooldown,
 * News-Feed. TODO: an dieselben Endpunkte anbinden wie Launcher
 * (events.json, Neuigkeiten-Sync).
 */
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Erzmark</Text>
      <Text style={styles.placeholder}>
        TODO: Server-Status, Boss-Event-Countdown, News-Feed
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0f12", padding: 20, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: "700", color: "#f2c94c" },
  placeholder: { color: "#8a8d98", marginTop: 12 },
});
