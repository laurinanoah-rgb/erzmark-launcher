import { useEffect, useState } from "react";
import { View, Text, Image, Pressable, Linking, ActivityIndicator, StyleSheet } from "react-native";
import { getNews } from "../api/news";
import { colors, radius, spacing } from "../theme";

// Automatischer Sync-Rhythmus, analog zu NewsFeed.jsx im Launcher - neue
// Blogbeitraege sollen ohne App-Neustart auftauchen.
const AUTO_REFRESH_MS = 5 * 60 * 1000;

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

/** Kompakte Neuigkeiten-Liste (erzmark.de/news), Pendant zu NewsFeed.jsx im Launcher. */
export default function NewsList({ limit = 4 }) {
  const [posts, setPosts] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    function refresh() {
      getNews(limit)
        .then((result) => {
          setPosts(result);
          setError(null);
        })
        .catch((err) => {
          setError(err?.message ?? String(err));
          setPosts((prev) => prev ?? []);
        });
    }

    refresh();
    const id = setInterval(refresh, AUTO_REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📰 Neuigkeiten</Text>

      {posts === undefined && <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.md }} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {posts && posts.length === 0 && !error && <Text style={styles.empty}>Noch keine Neuigkeiten gefunden.</Text>}

      <View style={{ gap: spacing.sm }}>
        {posts?.map((post) => (
          <Pressable
            key={post.id}
            style={styles.card}
            onPress={() => Linking.openURL(post.url).catch(() => {})}
          >
            {post.photoUrl && <Image source={{ uri: post.photoUrl }} style={styles.thumb} />}
            <View style={styles.body}>
              <View style={styles.meta}>
                {post.isPinned && <Text style={styles.pin}>📌</Text>}
                <Text style={styles.metaText}>
                  {formatDate(post.publishedAt)} · {post.authorName}
                </Text>
              </View>
              <Text style={styles.title} numberOfLines={2}>{post.title}</Text>
              {post.excerpt && (
                <Text style={styles.excerpt} numberOfLines={2}>{post.excerpt}</Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.gold,
  },
  error: { color: colors.danger, fontSize: 12 },
  empty: { color: colors.textMuted, fontSize: 12 },
  card: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  thumb: { width: 64, height: 64, borderRadius: 6, backgroundColor: colors.bgElevated },
  body: { flex: 1, gap: 3, justifyContent: "center" },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  pin: { fontSize: 10 },
  metaText: { fontSize: 10, color: colors.textMuted, textTransform: "uppercase" },
  title: { fontSize: 13, fontWeight: "800", color: colors.text },
  excerpt: { fontSize: 11, color: colors.textMuted },
});
