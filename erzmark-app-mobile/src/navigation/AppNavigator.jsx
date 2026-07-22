import { useEffect, useState } from "react";
import { Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors } from "../theme";

import LoginScreen from "../screens/LoginScreen";
import UpdateRequiredScreen from "../screens/UpdateRequiredScreen";
import ProfileSelectScreen from "../screens/ProfileSelectScreen";
import HomeScreen from "../screens/HomeScreen";
import GuildListScreen from "../screens/GuildListScreen";
import FriendsScreen from "../screens/FriendsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import SplashScreen from "../screens/SplashScreen";
import TeamScreen from "../screens/TeamScreen";
import { NotificationsProvider } from "../state/NotificationsContext";

import { checkForAppUpdate } from "../api/updateCheck";
import { getMyProfiles } from "../api/profiles";
import {
  getStoredToken,
  clearActiveProfileUuid,
  logout,
  tryRefreshLogin,
  switchAccount,
  loginWithMinecraft,
} from "../api/auth";

// Mindestdauer fuer die Start-Animation (SplashScreen.jsx) - ohne das
// wuerde sie auf schnellen Geraeten/mit bereits gueltigem Token oft nur ein
// paar Millisekunden aufblitzen, bevor direkt der Home-Screen erscheint.
const SPLASH_MIN_DURATION_MS = 1500;

const RootStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const TAB_ICONS = {
  Home: "🏠",
  Gilden: "🛡️",
  Freunde: "👥",
  Profil: "🙂",
  Team: "🛠️",
  Einstellungen: "⚙️",
};

function MainTabs({ onLogout, onSwitchProfile, onSwitchAccount, onAddAccount, isStaff }) {
  return (
    <NotificationsProvider>
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>{TAB_ICONS[route.name]}</Text>,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.bgElevated, borderTopColor: colors.goldSoft },
      })}
    >
      <Tabs.Screen name="Home">{() => <HomeScreen onLogout={onLogout} />}</Tabs.Screen>
      <Tabs.Screen name="Gilden" component={GuildListScreen} />
      <Tabs.Screen name="Freunde" component={FriendsScreen} />
      <Tabs.Screen name="Profil" component={ProfileScreen} />
      {isStaff && <Tabs.Screen name="Team" component={TeamScreen} />}
      <Tabs.Screen name="Einstellungen">
        {() => (
          <SettingsScreen
            onSwitchProfile={onSwitchProfile}
            onLogout={onLogout}
            onSwitchAccount={onSwitchAccount}
            onAddAccount={onAddAccount}
          />
        )}
      </Tabs.Screen>
    </Tabs.Navigator>
    </NotificationsProvider>
  );
}

/**
 * Reihenfolge beim Start:
 * 1. Update-Check (Store-Pflicht-Update blockiert alles andere).
 * 2. Login-Check (Minecraft-Account nötig).
 * 3. Profil-Auswahl (MMOProfiles: mehrere Charakter-UUIDs pro Account,
 *    siehe Task #51/#82) - eigener Screen im Start-Flow, NICHT in den
 *    Einstellungen versteckt. Erscheint bewusst bei JEDEM App-Start (nicht
 *    nur beim allerersten Login) - ein zuletzt gespeichertes Profil wird
 *    hier absichtlich nicht automatisch übernommen, siehe Nutzerwunsch
 *    "Spielstände-Auswahl statt Startseite".
 * 4. Haupt-Tabs, "Profil wechseln"/"Abmelden" leben im Einstellungen-Tab
 *    (führt zurück zu Schritt 3 bzw. 2) - vorher eine überlappende
 *    AccountBar oben links, die den neuen HomeHeader verdeckt hat.
 */
export default function AppNavigator() {
  const [pendingUpdate, setPendingUpdate] = useState(undefined); // undefined = noch am prüfen
  const [token, setToken] = useState(undefined);
  const [activeProfileUuid, setActiveProfileUuid] = useState(undefined);
  const [splashMinDurationDone, setSplashMinDurationDone] = useState(false);
  const [isStaff, setIsStaff] = useState(false);

  // Team-Tab-Sichtbarkeit: echte MineTrax-Website-Berechtigung des
  // verknuepften Accounts ("access cloudnet webinterface", siehe
  // ProfileController::mine() -> isStaff), NICHT der Minecraft-Rang - vor
  // dem Account-Merge vom 18.07.2026 war der App-Login ein eigener,
  // unverknuepfter User ohne diese Berechtigung, ein Rang-Raten war da die
  // einzige Naeherung. Jetzt zeigt jedes Profil dasselbe isStaff (haengt am
  // Account, nicht am einzelnen Charakter), reicht also, das erste zu lesen.
  useEffect(() => {
    if (!token || !activeProfileUuid) {
      setIsStaff(false);
      return;
    }
    let cancelled = false;
    getMyProfiles(token)
      .then((profiles) => {
        if (cancelled) return;
        const active = profiles.find((p) => p.uuid === activeProfileUuid) ?? profiles[0];
        setIsStaff(active?.isStaff === true);
      })
      .catch(() => {
        if (!cancelled) setIsStaff(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, activeProfileUuid]);

  useEffect(() => {
    checkForAppUpdate()
      .then(setPendingUpdate)
      .catch(() => setPendingUpdate(null));

    // Ein gespeichertes aktives Profil wird beim Start bewusst NICHT
    // übernommen (siehe JSDoc oben) - die Profil-Auswahl soll bei jedem
    // App-Start erscheinen, `activeProfileUuid` bleibt also so lange auf
    // `null`, bis der Nutzer in ProfileSelectScreen erneut wählt.
    (async () => {
      const stored = await getStoredToken();
      if (stored) {
        setToken(stored);
        setActiveProfileUuid(null);
        return;
      }
      // Kein (mehr gültiger) gespeicherter Minecraft-Token - still über den
      // gespeicherten Microsoft-Refresh-Token einloggen, bevor der
      // Login-Screen gezeigt wird (Auto-Login, analog zum Desktop-Launcher).
      const refreshed = await tryRefreshLogin();
      setToken(refreshed?.token ?? null);
      setActiveProfileUuid(null);
    })();

    const timer = setTimeout(() => setSplashMinDurationDone(true), SPLASH_MIN_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const checksReady = pendingUpdate !== undefined && token !== undefined && activeProfileUuid !== undefined;
  if (!checksReady || !splashMinDurationDone) {
    return <SplashScreen />;
  }

  async function handleSwitchProfile() {
    await clearActiveProfileUuid();
    setActiveProfileUuid(null);
  }

  // Meldet NUR das aktive Konto ab - sind noch andere Konten gespeichert,
  // wechselt die App automatisch zum ersten verbleibenden (siehe
  // auth.js::removeAccount), statt komplett zum Login-Screen zu springen.
  async function handleLogout() {
    const remaining = await logout();
    setToken(remaining?.token ?? null);
    setActiveProfileUuid(remaining?.activeProfileUuid ?? null);
  }

  async function handleSwitchAccount(uuid) {
    const result = await switchAccount(uuid);
    setToken(result.token);
    setActiveProfileUuid(result.activeProfileUuid);
  }

  // Startet denselben Microsoft-Login-Flow wie beim allerersten Login -
  // fügt aber ein weiteres Konto hinzu, statt das bestehende zu ersetzen
  // (siehe auth.js::loginWithMinecraft).
  async function handleAddAccount() {
    const result = await loginWithMinecraft();
    setToken(result.token);
    setActiveProfileUuid(result.activeProfileUuid);
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {pendingUpdate ? (
          <RootStack.Screen name="UpdateRequired">
            {() => <UpdateRequiredScreen update={pendingUpdate} />}
          </RootStack.Screen>
        ) : !token ? (
          <RootStack.Screen name="Login">
            {() => (
              <LoginScreen
                onLoggedIn={(result) => {
                  setToken(result.token);
                  setActiveProfileUuid(result.activeProfileUuid);
                }}
              />
            )}
          </RootStack.Screen>
        ) : !activeProfileUuid ? (
          <RootStack.Screen name="ProfileSelect">
            {() => (
              <ProfileSelectScreen
                onProfileSelected={setActiveProfileUuid}
                onLogout={(remaining) => {
                  // logout() wurde schon in ProfileSelectScreen aufgerufen,
                  // hier nur noch den lokalen State auf das (ggf. andere)
                  // verbleibende Konto setzen.
                  setToken(remaining?.token ?? null);
                  setActiveProfileUuid(remaining?.activeProfileUuid ?? null);
                }}
              />
            )}
          </RootStack.Screen>
        ) : (
          <RootStack.Screen name="Main">
            {() => (
              <MainTabs
                onLogout={handleLogout}
                onSwitchProfile={handleSwitchProfile}
                onSwitchAccount={handleSwitchAccount}
                onAddAccount={handleAddAccount}
                isStaff={isStaff}
              />
            )}
          </RootStack.Screen>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
