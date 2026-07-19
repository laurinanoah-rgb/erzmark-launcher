import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Defs, ClipPath, G, Rect, Circle } from "react-native-svg";
import { colors, spacing } from "../theme";

// Sack-Silhouette (Beutel mit Knoten oben) in einem 100x110-ViewBox, per
// Hand als Kurvenpfad gezeichnet (keine externe Grafik-Asset nötig).
const POUCH_PATH =
  "M50 6 C42 6 36 12 36 20 C20 24 8 42 8 62 C8 88 26 104 50 104 C74 104 92 88 92 62 C92 42 80 24 64 20 C64 12 58 6 50 6 Z";

// Referenzwert, ab dem der Beutel als "voll" gilt - bewusst logarithmisch
// skaliert, nicht linear: die ersten paar Münzen sollen sichtbar etwas
// füllen, aber der Unterschied zwischen 1.000 und 10.000 Münzen soll den
// Beutel nicht endlos weiter wachsen lassen (er ist ja schon voll). Bei
// FULL_REFERENCE=10000 landet z.B. 100 Münzen bei ~50% Füllstand.
const FULL_REFERENCE = 10000;

function fillRatioForCoins(coins) {
  if (!coins || coins <= 0) return 0;
  const ratio = Math.log10(coins + 1) / Math.log10(FULL_REFERENCE + 1);
  return Math.max(0, Math.min(1, ratio));
}

/**
 * Mittelalterlicher Münzbeutel statt nüchterner "🪙 1234"-Zeile - der
 * Füllstand zeigt den ungefähren Münzbestand auf einen Blick (wenige Münzen
 * = fast leerer Beutel, viele Münzen = prall gefüllt), siehe
 * `fillRatioForCoins` für die genaue Skalierung. Reine Anzeige, keine
 * Interaktion - der genaue Betrag steht zusätzlich als Zahl daneben, damit
 * der Beutel nicht die einzige (ungenaue) Informationsquelle ist.
 */
export default function CoinPouch({ coins, size = 72 }) {
  const fillRatio = fillRatioForCoins(coins);
  const fillHeight = 104 * fillRatio;
  const fillY = 104 - fillHeight;
  const showCoinAccents = fillRatio > 0.08;

  return (
    <View style={styles.row}>
      <Svg width={size} height={(size * 110) / 100} viewBox="0 0 100 110">
        <Defs>
          <ClipPath id="pouchClip">
            <Path d={POUCH_PATH} />
          </ClipPath>
        </Defs>

        <Path d={POUCH_PATH} fill={colors.bgElevated} />

        <G clipPath="url(#pouchClip)">
          <Rect x={0} y={fillY} width={100} height={fillHeight} fill={colors.gold} />
          {showCoinAccents && (
            <>
              <Circle cx={40} cy={fillY + 6} r={5} fill="#f7dd8a" opacity={0.85} />
              <Circle cx={62} cy={fillY + 4} r={4} fill="#f7dd8a" opacity={0.7} />
            </>
          )}
        </G>

        <Path d={POUCH_PATH} fill="none" stroke={colors.goldSoft} strokeWidth={3} />
        {/* Knoten/Kordel oben am Hals */}
        <Path d="M40 18 Q50 26 60 18" fill="none" stroke={colors.goldSoft} strokeWidth={2.5} />
      </Svg>

      <View>
        <Text style={styles.amount}>{Math.round(coins ?? 0).toLocaleString("de-DE")}</Text>
        <Text style={styles.label}>Münzen</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  amount: { fontSize: 18, fontWeight: "800", color: colors.text },
  label: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
