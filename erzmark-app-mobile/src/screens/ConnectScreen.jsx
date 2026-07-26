import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getConnectStatus, startConnect, stopConnect } from "../api/connect";
import { getStoredToken } from "../api/auth";
import { colors, radius, spacing } from "../theme";

// Wie oft der echte Serverstatus nachgeprüft wird, während die Umleitung
// laeuft - der Button spiegelt damit den tatsächlichen Relay-Status wider
// (fällt z.B. zurück in den grünen Ruhezustand, falls die Freigabe serverseitig
// abgelaufen ist), statt nur den letzten Tap zu merken.
const STATUS_POLL_MS = 15 * 1000;

/**
 * "Connect"-Untermenü für Bedrock-Konsolenspieler (Xbox/PlayStation/Switch):
 * schaltet die eigene Public-IP für den zentral gehosteten DNS+RakNet-Relay
 * frei, der die Konsole direkt zu erzmark.de durchleitet. Nur für Konsolen
 * relevant - Mobile/Windows-Bedrock verbindet sich bereits über Geyser/Floodgate.
 */
export default function ConnectScreen({ onBack } = {}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [status, setStatus] = useState(undefined); // undefined = laedt initial noch
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    const token = await getStoredToken();
    const result = await getConnectStatus(token);
    setStatus(result);
    return result;
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const result = await refreshStatus();
        if (!result.active) stopPolling();
      } catch {
        // Health-Check kurz nicht erreichbar - naechster Tick versucht es
        // erneut, bevor wir den Nutzer mit einem Fehler stoeren.
      }
    }, STATUS_POLL_MS);
  }, [refreshStatus, stopPolling]);

  useEffect(() => {
    refreshStatus()
      .then((result) => {
        if (result.active) startPolling();
      })
      .catch(() => setStatus({ active: false, dnsHost: null, expiresAt: null }));
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePress() {
    setBusy(true);
    setError(null);
    try {
      const token = await getStoredToken();
      const result = status?.active ? await stopConnect(token) : await startConnect(token);
      setStatus(result);
      if (result.active) startPolling();
      else stopPolling();
    } catch (err) {
      stopPolling();
      setStatus((prev) => ({ ...(prev ?? {}), active: false }));
      setError(
        status?.active
          ? "Stoppen fehlgeschlagen - bitte erneut versuchen."
          : "Verbindung konnte nicht gestartet werden - Dienst gerade nicht erreichbar."
      );
    } finally {
      setBusy(false);
    }
  }

  const active = status?.active === true;
  const loading = status === undefined;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={8}>
            <Text style={styles.backLink}>‹ Zurück zur Plattformwahl</Text>
          </Pressable>
        )}
        <Text style={styles.title}>🎮 Connect</Text>
        <Text style={styles.subtitle}>Für Xbox, PlayStation & Nintendo Switch (Bedrock)</Text>

        <Pressable style={styles.infoPanel} onPress={() => setInfoOpen((v) => !v)}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoHeaderText}>Wie funktioniert das?</Text>
            <Text style={styles.infoChevron}>{infoOpen ? "︿" : "﹀"}</Text>
          </View>
          {infoOpen && (
            <View style={styles.infoBody}>
              <Text style={styles.infoText}>
                Konsolen können sich nicht direkt mit Bedrock-Servern außerhalb der offiziellen Serverliste
                verbinden. Der Trick: Du trägst bei deiner Konsole eine spezielle DNS-Adresse ein - darüber
                landest du in einer Serverliste mit nur einem Eintrag: Erzmark.
              </Text>
              <Text style={styles.infoStep}>1. Tippe unten auf „Starten".</Text>
              <Text style={styles.infoStep}>
                2. Konsole: Netzwerkeinstellungen → DNS manuell einstellen{status?.dnsHost ? ` → ${status.dnsHost}` : ""}.
              </Text>
              <Text style={styles.infoStep}>3. Netzwerkverbindung der Konsole neu testen/speichern.</Text>
              <Text style={styles.infoStep}>4. In der Bedrock-Serverliste „Erzmark" auswählen.</Text>
              <Text style={styles.infoHint}>
                Handy und Konsole müssen im selben WLAN sein, solange „Verbindung aktiv" ist.
              </Text>
            </View>
          )}
        </Pressable>

        {active && <Text style={styles.statusText}>Verbindung zu erzmark.de stabil</Text>}
        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.buttonWrap}>
          <Pressable
            style={[styles.mainButton, active ? styles.mainButtonActive : styles.mainButtonIdle]}
            onPress={handlePress}
            disabled={busy || loading}
          >
            {busy || loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.mainButtonText}>{active ? "Stoppen" : "Starten"}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg, alignItems: "stretch" },
  backLink: { fontSize: 13, color: colors.textMuted, textDecorationLine: "underline" },
  title: { fontSize: 26, fontWeight: "700", color: colors.gold },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: -spacing.sm },

  infoPanel: {
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    overflow: "hidden",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  infoHeaderText: { fontSize: 14, fontWeight: "700", color: colors.text },
  infoChevron: { fontSize: 12, color: colors.textMuted },
  infoBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
  infoText: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.xs },
  infoStep: { fontSize: 12, color: colors.text, lineHeight: 18 },
  infoHint: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, fontStyle: "italic" },

  statusText: { fontSize: 13, fontWeight: "700", color: colors.success, textAlign: "center" },
  errorText: { fontSize: 12, color: colors.danger, textAlign: "center" },

  buttonWrap: { alignItems: "center", marginTop: spacing.md },
  mainButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  mainButtonIdle: { backgroundColor: colors.success },
  mainButtonActive: { backgroundColor: colors.danger },
  mainButtonText: { fontSize: 22, fontWeight: "800", color: colors.bg, letterSpacing: 0.5 },
});
