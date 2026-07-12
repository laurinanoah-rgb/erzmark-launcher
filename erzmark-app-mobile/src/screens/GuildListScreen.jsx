import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { getMyGuild } from "../api/guilds";
import { getStoredToken } from "../api/auth";

/**
 * Zeigt die eine MMOCore-Gilde des Spielers (Name, Tag, Mitglieder) und
 * einen Einstieg in den Gilden-Chat. Kein Beitreten/Verlassen hier - das
 * passiert weiterhin per In-Game-Befehl, siehe api/guilds.js.
 */
export default function GuildListScreen({ navigation }) {
  const [guild, setGuild] = useState(undefined); // undefined = lädt, null = keine Gilde

  useEffect(() => {
    getStoredToken()
      .then(token => getMyGuild(token))
      .then(setGuild)
      .catch(() => setGuild(null));
  }, []);

  if (guild === undefined) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>Lädt…</Text>
      </View>
    );
  }

  if (!guild) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Meine Gilde</Text>
        <Text style={styles.placeholder}>
          Du bist noch in keiner Gilde. Tritt im Spiel einer Gilde bei, um
          hier ihren Chat zu sehen.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>[{guild.tag}] {guild.name}</Text>
      <Text style={styles.placeholder}>{guild.members.length} Mitglieder</Text>

      <FlatList
        data={guild.members}
        keyExtractor={item => item.uuid}
        renderItem={({ item }) => (
          <Text style={styles.memberRow}>
            {item.username} {item.uuid === guild.owner ? " (Anführer)" : ""}
          </Text>
        )}
      />

      <Pressable
        style={styles.chatButton}
        onPress={() => navigation.navigate("GuildChat", { guildName: guild.name })}
      >
        <Text style={styles.chatButtonText}>Zum Gilden-Chat</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0f12", padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: "700", color: "#f2c94c", marginBottom: 4 },
  placeholder: { color: "#8a8d98", marginBottom: 16 },
  memberRow: { color: "#f4f5f7", fontSize: 15, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#22242b" },
  chatButton: { backgroundColor: "#f2c94c", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  chatButtonText: { color: "#0e0f12", fontWeight: "700" },
});
