import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { startLanBroadcast, stopLanBroadcast, isLanBroadcastActive } from "../native/lanBroadcast";
import { colors, radius, spacing } from "../theme";

/**
 * "Connect"-Untermenü für Bedrock-Konsolenspieler (Xbox/PlayStation/Switch):
 * das Handy beantwortet LAN-Discovery-Broadcasts (siehe native/lanBroadcast.js),
 * sodass "Erzmark" automatisch in der Bedrock-Serverliste der Konsole
 * auftaucht - kein manuelles DNS-Eintragen mehr (Nutzerwunsch, 26.07.2026,
 * ersetzt den ursprünglich geplanten zentralen DNS-Redirect). Nur für
 * Konsolen relevant - Mobile/Windows-Bedrock verbindet sich bereits über
 * Geyser/Floodgate direkt.
 *
 * WICHTIG: Funktioniert nur, solange die App im Vordergrund offen ist (kein
 * Hintergrund-Listening) UND nur, solange Handy und Konsole im selben WLAN
 * sind - reines LAN-Protokoll, kein Internet/DNS involviert. Geht die App in
 * den Hintergrund, wird automatisch gestoppt (AppState-Listener unten),
 * sonst würde der Button faelschlich "aktiv" anzeigen, obwohl nicht mehr
 * geantwortet wird.
 *
 * Phase 1 von 2 (siehe lanBroadcast.js-Kommentar): macht das Handy nur
 * SICHTBAR in der LAN-Liste. Tippt jemand auf der Konsole auf "Erzmark",
 * passiert aktuell noch nichts - der volle RakNet-Verbindungsaufbau +
 * Transfer-Paket zum echten Server ist noch nicht gebaut (echtes
 * Protokoll-Reverse-Engineering, erst nach Bestätigung dass Phase 1 auf
 * einer echten Konsole sichtbar ist).
 */
export default function ConnectScreen({ onBack } = {}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" && isLanBroadcastActive()) {
        stopLanBroadcast();
        setActive(false);
      }
    });
    return () => {
      sub.remove();
      stopLanBroadcast();
    };
  }, []);

  async function handlePress() {
    setBusy(true);
    setError(null);
    try {
      if (active) {
        stopLanBroadcast();
        setActive(false);
      } else {
        await startLanBroadcast();
        setActive(true);
      }
    } catch (err) {
      stopLanBroadcast();
      setActive(false);
      setError(
        active
          ? "Stoppen fehlgeschlagen - bitte erneut versuchen."
          : `Konnte nicht starten: ${err?.message ?? String(err)}`
      );
    } finally {
      setBusy(false);
    }
  }

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
                Dein Handy meldet sich im WLAN als "LAN-Welt" - genau wie beim gemeinsamen Bauen mit
                Freunden im selben Netzwerk. Deine Konsole findet Erzmark dadurch automatisch, ganz ohne
                DNS- oder Netzwerkeinstellungen.
              </Text>
              <Text style={styles.infoStep}>1. Handy und Konsole im selben WLAN.</Text>
              <Text style={styles.infoStep}>2. Tippe unten auf „Starten" und lass die App offen.</Text>
              <Text style={styles.infoStep}>3. Konsole: Minecraft öffnen → Spielen → „Erzmark" sollte in der Liste erscheinen.</Text>
              <Text style={styles.infoHint}>
                Die App muss dabei im Vordergrund bleiben - schließt du sie, verschwindet Erzmark wieder
                aus der Liste.
              </Text>
            </View>
          )}
        </Pressable>

        {active && <Text style={styles.statusText}>Im WLAN sichtbar als „Erzmark"</Text>}
        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.buttonWrap}>
          <Pressable
            style={[styles.mainButton, active ? styles.mainButtonActive : styles.mainButtonIdle]}
            onPress={handlePress}
            disabled={busy}
          >
            {busy ? (
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
