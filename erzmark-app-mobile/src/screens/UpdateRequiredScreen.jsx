import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Linking, ActivityIndicator } from "react-native";
import { applyOtaUpdate } from "../api/updateCheck";

/**
 * Entspricht dem "Update verfügbar, jetzt updaten"-Dialog aus dem Launcher.
 * `update.type === "store"`  -> Store-Seite öffnen (native Änderung nötig).
 * `update.type === "ota"`    -> neues JS-Bundle direkt in der App laden,
 *                                kein Store-Umweg nötig.
 */
export default function UpdateRequiredScreen({ update }) {
  const [applying, setApplying] = useState(false);

  async function handleUpdate() {
    if (update.type === "store") {
      Linking.openURL(update.storeUrl);
      return;
    }
    setApplying(true);
    try {
      await applyOtaUpdate(); // lädt neues Bundle + startet App neu
    } finally {
      setApplying(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Update verfügbar</Text>
      <Text style={styles.subtitle}>
        {update.type === "store"
          ? "Eine neue Version ist im Store verfügbar."
          : "Eine neue Version ist bereit."}
      </Text>

      <Pressable style={styles.button} onPress={handleUpdate} disabled={applying}>
        {applying ? <ActivityIndicator color="#0e0f12" /> : <Text style={styles.buttonText}>Jetzt updaten</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0f12", alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 24, fontWeight: "700", color: "#f2c94c", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#c7c9d1", marginBottom: 32, textAlign: "center" },
  button: { backgroundColor: "#f2c94c", paddingVertical: 14, paddingHorizontal: 28, borderRadius: 10 },
  buttonText: { color: "#0e0f12", fontWeight: "700", fontSize: 16 },
});
