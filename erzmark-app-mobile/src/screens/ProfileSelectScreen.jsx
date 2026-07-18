import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Platform } from "react-native";
import Constants from "expo-constants";
import { getMyProfiles, reportAppError } from "../api/profiles";
import { getStoredToken, storeActiveProfileUuid, logout } from "../api/auth";

/**
 * Erscheint im Start-Flow nach Update-Check und Login, bevor die
 * Hauptansicht geladen wird (nicht in den Einstellungen versteckt!) - siehe
 * AppNavigator.jsx. Grund: MMOProfiles gibt jedem Charakter-Profil eine
 * eigene UUID (proxy_based_profiles), der Spieler muss also explizit
 * wählen, welches Profil gerade "er" ist, bevor Gilde/Klasse/Stats
 * angezeigt werden können.
 *
 * `onLogout` ist bewusst hier verfügbar (nicht nur im Einstellungen-Tab der
 * Haupt-Tabs) - falls das Laden der Profile fehlschlägt (z.B. falscher/
 * abgelaufener Token), gäbe es sonst keinen Weg zurück zum Login-Screen.
 */
export default function ProfileSelectScreen({ onProfileSelected, onLogout }) {
  const [profiles, setProfiles] = useState(undefined); // undefined = lädt
  const [error, setError] = useState(null);
  const [selecting, setSelecting] = useState(null);
  const [reportStatus, setReportStatus] = useState(null); // null | "sending" | "sent" | "failed"

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
    const remaining = await logout();
    onLogout(remaining);
  }

  async function handleReportError() {
    setReportStatus("sending");
    try {
      const token = await getStoredToken();
      await reportAppError(token, {
        message: error,
        context: "ProfileSelectScreen",
        appVersion: Constants.expoConfig?.version ?? "0.0.0",
        platform: Platform.OS,
      });
      setReportStatus("sent");
    } catch {
      setReportStatus("failed");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil wählen</Text>
      <Text style={styles.subtitle}>Mit welchem Charakter möchtest du weitermachen?</Text>

      {profiles === undefined && <ActivityIndicator color="#f2c94c" style={{ marginTop: 24 }} />}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          {reportStatus === "sent" ? (
            <Text style={styles.reportSent}>✓ Fehler wurde ans Team gemeldet, danke!</Text>
          ) : (
            <Pressable
              style={styles.reportButton}
              onPress={handleReportError}
              disabled={reportStatus === "sending"}
            >
              {reportStatus === "sending" ? (
                <ActivityIndicator color="#0e0f12" size="small" />
              ) : (
                <Text style={styles.reportButtonText}>
                  {reportStatus === "failed" ? "Fehlgeschlagen, nochmal versuchen" : "Fehler melden"}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      )}

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
            <View style={styles.emptyBox}>
              <Text style={styles.placeholder}>Kein Profil gefunden.</Text>
              <Text style={styles.placeholderHint}>
                So bekommst du eins: Starte Minecraft, verbinde dich mit dem Erzmark-Server, klicke dort
                auf „Play" und wähle im sich öffnenden Menü deinen Charakter aus (oder erstelle einen
                neuen). Danach erscheint er automatisch auch hier in der App.
              </Text>
            </View>
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
  emptyBox: { marginTop: 12, gap: 8 },
  placeholder: { color: "#c7c9d1", fontSize: 15, fontWeight: "600" },
  placeholderHint: { color: "#8a8d98", fontSize: 13, lineHeight: 19 },
  errorBox: { marginBottom: 20, gap: 10 },
  error: { color: "#ff6b6b" },
  reportButton: {
    alignSelf: "flex-start",
    backgroundColor: "#f2c94c",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  reportButtonText: { color: "#0e0f12", fontSize: 13, fontWeight: "700" },
  reportSent: { color: "#6bcf7f", fontSize: 13, fontWeight: "600" },
  profileCard: { backgroundColor: "#1a1c22", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#262832" },
  profileName: { color: "#f4f5f7", fontSize: 17, fontWeight: "600" },
  profileMeta: { color: "#8a8d98", fontSize: 13, marginTop: 4 },
  logoutLink: { alignSelf: "center", marginTop: 20, padding: 8 },
  logoutText: { color: "#8a8d98", fontSize: 14, textDecorationLine: "underline" },
});
