import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import HomeHeader from "../components/HomeHeader";
import BossEventBanner from "../components/BossEventBanner";
import ProfileCard from "../components/ProfileCard";
import NewsList from "../components/NewsList";
import FriendsPreview from "../components/FriendsPreview";
import { getMyProfiles } from "../api/profiles";
import { getStoredToken, getActiveProfileUuid } from "../api/auth";
import { colors, spacing } from "../theme";

// Rang/Münzen/Level können sich ändern, während die App offen bleibt (z.B.
// Rang-Upgrade durchs Team, Levelaufstieg im Spiel) - regelmäßig neu laden
// statt nur einmal beim Öffnen, analog zu News/Freunden/Boss-Event.
const AUTO_REFRESH_MS = 60 * 1000;

/**
 * Dashboard nach der Profil-Auswahl: Banner (Logout), Boss-Event-Countdown,
 * Statistiken des gewählten Profils, Neuigkeiten und Freunde. Gilden-Chat
 * bewusst NICHT hier (kommt separat als eigener Tab, Realtime folgt später).
 */
export default function HomeScreen({ onLogout }) {
  const [accountName, setAccountName] = useState(null);
  const [activeProfile, setActiveProfile] = useState(undefined);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const [token, activeUuid] = await Promise.all([getStoredToken(), getActiveProfileUuid()]);
      try {
        const profiles = await getMyProfiles(token);
        if (cancelled) return;
        const match = profiles.find((p) => p.uuid === activeUuid) ?? profiles[0] ?? null;
        setActiveProfile(match);
        setAccountName(match?.name ?? null);
      } catch {
        if (!cancelled) setActiveProfile((prev) => (prev === undefined ? null : prev));
      }
    }

    refresh();
    const id = setInterval(refresh, AUTO_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <HomeHeader accountName={accountName} onLogout={onLogout} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ProfileCard profile={activeProfile} />
        <BossEventBanner />
        <NewsList />
        <FriendsPreview />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: spacing.xl },
});
