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

import { checkForAppUpdate } from "../api/updateCheck";
import {
  getStoredToken,
  getActiveProfileUuid,
  clearActiveProfileUuid,
  logout,
  tryRefreshLogin,
} from "../api/auth";

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
  Einstellungen: "⚙️",
};

function MainTabs({ onLogout, onSwitchProfile }) {
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
      <Tabs.Screen name="Einstellungen">
        {() => <SettingsScreen onSwitchProfile={onSwitchProfile} onLogout={onLogout} />}
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

  useEffect(() => {
    checkForAppUpdate()
      .then(setPendingUpdate)
      .catch(() => setPendingUpdate(null));

    getStoredToken().then(async (stored) => {
      if (stored) {
        setToken(stored);
        return;
      }
      // Kein (mehr gültiger) gespeicherter Minecraft-Token - still über den
      // gespeicherten Microsoft-Refresh-Token einloggen, bevor der
      // Login-Screen gezeigt wird (Auto-Login, analog zum Desktop-Launcher).
      const refreshed = await tryRefreshLogin();
      setToken(refreshed);
    });

    getActiveProfileUuid().then(setActiveProfileUuid);
  }, []);

  if (pendingUpdate === undefined || token === undefined || activeProfileUuid === undefined) {
    return null; // TODO: Splash-Screen
  }

  async function handleSwitchProfile() {
    await clearActiveProfileUuid();
    setActiveProfileUuid(null);
  }

  async function handleLogout() {
    await logout();
    setToken(null);
    setActiveProfileUuid(null);
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
            {() => <LoginScreen onLoggedIn={setToken} />}
          </RootStack.Screen>
        ) : !activeProfileUuid ? (
          <RootStack.Screen name="ProfileSelect">
            {() => (
              <ProfileSelectScreen
                onProfileSelected={setActiveProfileUuid}
                onLogout={() => {
                  // logout() wurde schon in ProfileSelectScreen aufgerufen,
                  // hier nur noch den lokalen State zuruecksetzen.
                  setToken(null);
                  setActiveProfileUuid(null);
                }}
              />
            )}
          </RootStack.Screen>
        ) : (
          <RootStack.Screen name="Main">
            {() => <MainTabs onLogout={handleLogout} onSwitchProfile={handleSwitchProfile} />}
          </RootStack.Screen>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
