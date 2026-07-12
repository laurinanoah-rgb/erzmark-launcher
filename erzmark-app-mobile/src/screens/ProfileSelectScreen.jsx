import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { getMyProfiles } from "../api/profiles";
import { getStoredToken, storeActiveProfileUuid, logout } from "../api/auth";

/**
 * Erscheint im Start-Flow nach Update-Check und Login, bevor die
 * Hauptansicht geladen wird (nicht in den Einstellungen versteckt!) - siehe
 * AppNavigator.jsx. Grund: MMOProfiles gibt jedem Charakter-Profil eine
 * eigene UUID (proxy_based_profiles), der Spieler muss also explizit
 * wählen, welches Profil gerade "er" ist, bevor Gilde/Klasse/Stats
 * angezeigt werden können.
 *
 * `onLogout` ist bewusst hier verfügbar (nicht nur in der AccountBar auf
 * den Haupt-Tabs) - falls das Laden der Profile fehlschlägt (z.B. falscher/
 * abgelaufener Token), gäbe es sonst keinen Weg zurück zum Login-Screen.
 */
export default function ProfileSelectScreen({ onProfileSelected, onLogout }) {
  const [profiles, setProfiles] = useState(undefined); // undefined = lädt
  const [error, setError] = useState(null);
  const [selecting, setSelecting] = useState(null);

  useEffect(() => {
    getStoredToken()
      .then(token => getMyProfiles(token))
      .then(setProfiles)
      .catch(err => {
        setError(err?.message ?? String(err));
        setProfiles([]);
      });
  }, []);

  async function handleSelect(profile) {
    setSelecting(profile.uuid);
    try {
      await storeActiveProfileUuid(profile.uuid);
      onProfileSelected(profile.uuid);
    } finally {
      setSelecting(null);
    }
  }

  async function handleLogout() {
    await logout();
    onLogout();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil wählen</Text>
      <Text style={styles.subtitle}>Mit welchem Charakter möchtest du weitermachen?</Text>

      {profiles === undefined && <ActivityIndicator color="#f2c94c" style={{ marginTop: 24 }} />}
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={profiles ?? []}
        keyExtractor={item => item.uuid}
        contentContainerStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.profileCard}
            onPress={() => handleSelect(item)}
            disabled={selecting !== null}
          >
            <Text style={styles.profileName}>{item.name}</Text>
            {item.className && <Text style={styles.profileMeta}>{item.className}</Text>}
            {selecting === item.uuid && <ActivityIndicator color="#0e0f12" style={{ marginTop: 6 }} />}
          </Pressable>
        )}
        ListEmptyComponent={
          profiles !== undefined && !error ? (
            <Text style={styles.placeholder}>Keine Profile gefunden.</Text>
          ) : null
        }
      />

      <Pressable onPress={handleLogout} style={styles.logoutLink}>
        <Text style={styles.logoutText}>Abmelden</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0f12", padding: 20, paddingTop: 70 },
  title: { fontSize: 26, fontWeight: "700", color: "#f2c94c", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#c7c9d1", marginBottom: 24 },
  placeholder: { color: "#8a8d98", marginTop: 12 },
  error: { color: "#ff6b6b", marginBottom: 12 },
  profileCard: { backgroundColor: "#1a1c22", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#262832" },
  profileName: { color: "#f4f5f7", fontSize: 17, fontWeight: "600" },
  profileMeta: { color: "#8a8d98", fontSize: 13, marginTop: 4 },
  logoutLink: { alignSelf: "center", marginTop: 20, padding: 8 },
  logoutText: { color: "#8a8d98", fontSize: 14, textDecorationLine: "underline" },
});
