import { useEffect, useState } from "react";
import { View, Text, FlatList, TextInput, Pressable, StyleSheet } from "react-native";
import { getGuildChatHistory, sendGuildChatMessage } from "../api/guilds";
import { getStoredToken } from "../api/auth";

// TODO: Realtime-Anbindung (Laravel Reverb, bereits auf dem Server
// installiert + Backend-Event fertig, siehe PLANNING.md) statt nur
// Chat-Historie per Request abzurufen - aktuell nur Grundgerüst. Nur eine
// Gilde pro Spieler (MMOCore-Limitierung, siehe api/guilds.js), deshalb
// kein guildId nötig. Navigation: erreichbar über GuildStackScreen in
// AppNavigator.jsx (verschachtelter Stack im "Gilden"-Tab).
export default function GuildChatScreen({ route }) {
  const { guildName } = route.params;
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [token, setToken] = useState(null);

  useEffect(() => {
    getStoredToken().then(t => {
      setToken(t);
      getGuildChatHistory(t).then(setMessages).catch(() => setMessages([]));
    });
  }, []);

  async function handleSend() {
    if (!draft.trim()) return;
    const message = draft;
    setDraft("");
    const sent = await sendGuildChatMessage(token, message);
    setMessages(prev => [...prev, sent]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{guildName}</Text>
      <FlatList
        data={messages}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.messageRow}>
            <Text style={styles.author}>{item.author}</Text>
            <Text style={styles.text}>{item.message}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Nachricht schreiben…"
          placeholderTextColor="#6b6e78"
        />
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Senden</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0f12", padding: 16, paddingTop: 60 },
  title: { fontSize: 20, fontWeight: "700", color: "#f2c94c", marginBottom: 12 },
  messageRow: { marginBottom: 10 },
  author: { color: "#f2c94c", fontSize: 12, fontWeight: "600" },
  text: { color: "#f4f5f7", fontSize: 15 },
  inputRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  input: { flex: 1, backgroundColor: "#1a1c22", color: "#f4f5f7", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  sendButton: { backgroundColor: "#f2c94c", borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  sendButtonText: { color: "#0e0f12", fontWeight: "700" },
});
