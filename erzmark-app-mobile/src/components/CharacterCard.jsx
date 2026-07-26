import { forwardRef } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../theme";

/**
 * Teilbare "Visitenkarte" (26.07.2026, PLANNING.md Hype-Idee #1) - wird von
 * ProfileScreen.jsx per react-native-view-shot in ein PNG gerendert und über
 * den System-Share-Dialog geteilt. Nutzt bewusst den flachen Crafatar-Body-
 * Render statt eines Screenshots von SkinViewer3D.jsx: WebGL-Canvas-Inhalte
 * lassen sich mit view-shot auf Android nicht zuverlässig einfangen (teils
 * leeres Bild), ein normales <Image> dagegen problemlos.
 */
const CharacterCard = forwardRef(function CharacterCard(
  { accountUuid, name, className, level, rankBadge, rankIconUrl, stickers = [] },
  ref
) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.brand}>ERZMARK</Text>
        {rankIconUrl ? (
          <Image source={{ uri: rankIconUrl }} style={styles.rankIcon} />
        ) : (
          rankBadge && (
            <View style={[styles.rankBadge, { backgroundColor: rankBadge.color }]}>
              <Text style={styles.rankBadgeText}>{rankBadge.label}</Text>
            </View>
          )
        )}
      </View>

      {accountUuid && (
        <Image
          source={{ uri: `https://crafatar.com/renders/body/${accountUuid}?overlay&scale=8` }}
          style={styles.skinRender}
        />
      )}

      <Text style={styles.name}>{name}</Text>
      <Text style={styles.subline}>
        {[className, level != null ? `Level ${level}` : null].filter(Boolean).join(" · ")}
      </Text>

      {stickers.length > 0 && (
        <View style={styles.stickerRow}>
          {stickers.slice(0, 3).map((s) => (
            <View key={s.id} style={styles.sticker}>
              <Text style={styles.stickerIcon}>{s.icon}</Text>
              <Text style={styles.stickerLabel} numberOfLines={1}>{s.title}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.footer}>erzmark.de</Text>
    </View>
  );
});

export default CharacterCard;

const styles = StyleSheet.create({
  card: {
    width: 320,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: "center",
    gap: spacing.xs,
  },
  headerRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { fontSize: 12, fontWeight: "800", letterSpacing: 2, color: colors.gold },
  rankIcon: { width: 24, height: 24, resizeMode: "contain" },
  rankBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  rankBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase", color: "#fff" },
  skinRender: { width: 140, height: 200, resizeMode: "contain", marginVertical: spacing.sm },
  name: { fontSize: 20, fontWeight: "800", color: colors.text },
  subline: { fontSize: 13, color: colors.textMuted },
  stickerRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap", justifyContent: "center" },
  sticker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 100,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,185,0,0.12)",
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  stickerIcon: { fontSize: 13 },
  stickerLabel: { fontSize: 10, color: colors.gold, fontWeight: "700" },
  footer: { fontSize: 10, color: colors.textMuted, marginTop: spacing.sm, letterSpacing: 1 },
});
