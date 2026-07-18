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
import GuildChatScreen from "../screens/GuildChatScreen";
import FriendsScreen from "../screens/FriendsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import SplashScreen from "../screens/SplashScreen";
import TeamScreen from "../screens/TeamScreen";

import { checkForAppUpdate } from "../api/updateCheck";
import { getMyProfiles } from "../api/profiles";
import {
  getStoredToken,
  getActiveProfileUuid,
  clearActiveProfileUuid,
  logout,
  tryRefreshLogin,
  switchAccount,
  loginWithMinecraft,
} from "../api/auth";

// Team-Raenge mit Zugriff auf das CloudNet-Webinterface (siehe
// CloudNetTeamController.php auf der Website - deckt sich mit den dort als
// "isTeamRank" markierten LuckPerms-Gruppen, ohne "builder"). Nur eine
// UI-Abkuerzung: der echte Zugriffsschutz laeuft serverseitig ueber die
// Spatie-Permission "access cloudnet webinterface" auf dem Website-Login.
const STAFF_RANKS = ["owner", "dev", "mod", "supp"];

// Mindestdauer fuer die Start-Animation (SplashScreen.jsx) - ohne das
// wuerde sie auf schnellen Geraeten/mit bereits gueltigem Token oft nur ein
// paar Millisekunden aufblitzen, bevor direkt der Home-Screen erscheint.
const SPLASH_MIN_DURATION_MS = 1500;

const RootStack = createNativeStackNavigator();
const GuildStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function GuildStackScreen() {
  // Verschachtelter Stack innerhalb des "Gilden"-Tabs, damit GuildChatScreen
  // von GuildListScreen aus per navigation.navigate erreichbar ist.
  return (
    <GuildStack.Navigator screenOptions={{ headerShown: false }}>
      <GuildStack.Screen name="GuildOverview" component={GuildListScreen} />
      <GuildStack.Screen name="GuildChat" component={GuildChatScreen} />
    </GuildStack.Navigator>
  );
}

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
      <Tabs.Screen name="Gilden" component={GuildStackScreen} />
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
  );
}

/**
 * Reihenfolge beim Start:
 * 1. Update-Check (Store-Pflicht-Update blockiert alles andere).
 * 2. Login-Check (Minecraft-Account nötig).
 * 3. Profil-Auswahl (MMOProfiles: mehrere Charakter-UUIDs pro Account,
 *    siehe Task #51/#82) - eigener Screen im Start-Flow, NICHT in den
 *    Einstellungen versteckt.
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

  // Team-Tab-Sichtbarkeit haengt vom Rang des AKTIVEN Profils ab (nicht vom
  // Account als Ganzes) - jedes Profil hat seinen eigenen LuckPerms-Rang.
  // Bewusst separat von HomeScreen's eigenem getMyProfiles()-Aufruf, damit
  // der Navigator nicht auf den HomeScreen-Datenfluss angewiesen ist.
  useEffect(() => {
    if (!token || !activeProfileUuid) {
      setIsStaff(false);
      return;
    }
    let cancelled = false;
    getMyProfiles(token)
      .then((profiles) => {
        if (cancelled) return;
        const active = profiles.find((p) => p.uuid === activeProfileUuid);
        setIsStaff(STAFF_RANKS.includes(active?.rankName));
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

    // Token + Profil-Auswahl bewusst NACHEINANDER (nicht parallel) laden:
    // Beide hängen jetzt vom aktiven Konto ab, und `tryRefreshLogin()` kann
    // dieses bei einem ungültigen Refresh-Token entfernen und zu einem
    // anderen wechseln (siehe auth.js) - ein paralleler Abruf von
    // `getActiveProfileUuid()` könnte sonst noch den Stand VOR diesem
    // Wechsel lesen (Race Condition).
    (async () => {
      const stored = await getStoredToken();
      if (stored) {
        setToken(stored);
        setActiveProfileUuid(await getActiveProfileUuid());
        return;
      }
      // Kein (mehr gültiger) gespeicherter Minecraft-Token - still über den
      // gespeicherten Microsoft-Refresh-Token einloggen, bevor der
      // Login-Screen gezeigt wird (Auto-Login, analog zum Desktop-Launcher).
      const refreshed = await tryRefreshLogin();
      setToken(refreshed?.token ?? null);
      setActiveProfileUuid(refreshed?.activeProfileUuid ?? null);
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
