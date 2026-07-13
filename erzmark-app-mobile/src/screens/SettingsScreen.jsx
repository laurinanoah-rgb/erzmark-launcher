import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import Constants from "expo-constants";
import { listAccounts, removeAccount } from "../api/auth";
import { colors, radius, spacing } from "../theme";

/**
 * Einstellungen-Tab: Konten-Verwaltung (mehrere Microsoft-/Minecraft-Konten,
 * siehe auth.js), Profil wechseln/Abmelden (vorher in der überlappenden
 * AccountBar, die den HomeHeader verdeckt hat) sowie Platz für künftige
 * Personalisierung (Benachrichtigungen, Darstellung, etc.).
 */
export default function SettingsScreen({ onSwitchProfile, onLogout, onSwitchAccount, onAddAccount }) {
  const version = Constants.expoConfig?.version;
  const [accounts, setAccounts] = useState(undefined);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    listAccounts().then(setAccounts);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleAddAccount() {
    setBusy(true);
    try {
      await onAddAccount();
      reload();
    } catch {
      // Abgebrochener/fehlgeschlagener Login - Kontenliste bleibt unveraendert.
    } finally {
      setBusy(false);
    }
  }

  async function handleSwitchAccount(uuid) {
    setBusy(true);
    try {
      await onSwitchAccount(uuid);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveAccount(uuid) {
    await removeAccount(uuid);
    reload();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>⚙️ Einstellungen</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Konten</Text>

        {accounts === undefined && <ActivityIndicator color={colors.gold} />}

        {accounts?.map((account) => (
          <View key={account.accountUuid} style={styles.accountRow}>
            <Pressable
              style={styles.accountInfo}
              disabled={busy || account.isActive}
              onPress={() => handleSwitchAccount(account.accountUuid)}
            >
              <Text style={styles.accountName}>{account.username}</Text>
              {account.isActive && <Text style={styles.accountActiveBadge}>Aktiv</Text>}
            </Pressable>
            {!account.isActive && (
              <Pressable onPress={() => handleRemoveAccount(account.accountUuid)} hitSlop={8} disabled={busy}>
                <Text style={styles.accountRemove}>Entfernen</Text>
              </Pressable>
            )}
          </View>
        ))}

        <Pressable style={styles.addAccountBtn} onPress={handleAddAccount} disabled={busy}>
          <Text style={styles.addAccountText}>{busy ? "Wird geladen…" : "+ Konto hinzufügen"}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profil</Text>
        <Pressable style={styles.row} onPress={onSwitchProfile}>
          <Text style={styles.rowLabel}>Profil wechseln</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={onLogout}>
          <Text style={[styles.rowLabel, styles.rowDanger]}>Abmelden</Text>
          <Text style={[styles.rowChevron, styles.rowDanger]}>›</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personalisierung</Text>
        <Text style={styles.placeholder}>
          Benachrichtigungen, Darstellung u.a. folgen hier in einer künftigen Version.
        </Text>
      </View>

      {version && <Text style={styles.version}>Erzmark App v{version}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: 60, gap: spacing.lg },
  title: { fontSize: 20, fontWeight: "800", color: colors.gold, letterSpacing: 0.5 },
  section: { gap: spacing.xs },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  rowLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  rowChevron: { fontSize: 16, color: colors.textMuted },
  rowDanger: { color: colors.danger },
  placeholder: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  version: { fontSize: 11, color: colors.textMuted, textAlign: "center", marginTop: "auto" },

  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    marginBottom: spacing.xs,
  },
  accountInfo: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  accountName: { fontSize: 14, fontWeight: "700", color: colors.text },
  accountActiveBadge: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.bg,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  accountRemove: { fontSize: 12, color: colors.danger, fontWeight: "600" },
  addAccountBtn: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    borderStyle: "dashed",
  },
  addAccountText: { fontSize: 13, fontWeight: "700", color: colors.primary },
});
