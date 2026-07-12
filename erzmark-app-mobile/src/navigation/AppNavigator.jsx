import { useEffect, useState } from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import LoginScreen from "../screens/LoginScreen";
import UpdateRequiredScreen from "../screens/UpdateRequiredScreen";
import ProfileSelectScreen from "../screens/ProfileSelectScreen";
import HomeScreen from "../screens/HomeScreen";
import GuildListScreen from "../screens/GuildListScreen";
import GuildChatScreen from "../screens/GuildChatScreen";
import FriendsScreen from "../screens/FriendsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AccountBar from "../components/AccountBar";

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

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Gilden" component={GuildStackScreen} />
      <Tabs.Screen name="Freunde" component={FriendsScreen} />
      <Tabs.Screen name="Profil" component={ProfileScreen} />
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
 * 4. Haupt-Tabs, mit AccountBar oben links ("Profil wechseln"/"Abmelden" -
 *    führt zurück zu Schritt 3 bzw. 2).
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
            {() => (
              <View style={{ flex: 1 }}>
                <MainTabs />
                <AccountBar onSwitchProfile={handleSwitchProfile} onLogout={handleLogout} />
              </View>
            )}
          </RootStack.Screen>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
