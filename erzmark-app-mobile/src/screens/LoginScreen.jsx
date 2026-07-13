import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { loginWithMinecraft } from "../api/auth";

/**
 * Login-Screen: exakt wie im Launcher nur Minecraft-Account (Microsoft
 * OAuth2), kein eigenes Erzmark-Passwort.
 */
export default function LoginScreen({ onLoggedIn }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const result = await loginWithMinecraft();
      onLoggedIn(result);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Erzmark</Text>
      <Text style={styles.subtitle}>Mit deinem Minecraft-Account anmelden</Text>

      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#0e0f12" /> : <Text style={styles.buttonText}>Mit Microsoft anmelden</Text>}
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0f12", alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 32, fontWeight: "700", color: "#f2c94c", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#c7c9d1", marginBottom: 32, textAlign: "center" },
  button: { backgroundColor: "#f2c94c", paddingVertical: 14, paddingHorizontal: 28, borderRadius: 10 },
  buttonText: { color: "#0e0f12", fontWeight: "700", fontSize: 16 },
  error: { color: "#ff6b6b", marginTop: 20, textAlign: "center" },
});
