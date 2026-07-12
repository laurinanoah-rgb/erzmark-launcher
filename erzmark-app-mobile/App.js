import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNavigator from "./src/navigation/AppNavigator";

/**
 * Einstiegspunkt der Erzmark-App. Der eigentliche Update-Check
 * ("Update verfügbar, jetzt updaten") + Login-Gate passiert in
 * AppNavigator, damit App.js schlank bleibt.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
