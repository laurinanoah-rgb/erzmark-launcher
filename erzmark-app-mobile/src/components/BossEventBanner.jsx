import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Linking, Animated, StyleSheet } from "react-native";
import { getBossEvent } from "../api/events";
import { colors, radius, spacing } from "../theme";

const EVENTS_PAGE_URL = "https://erzmark.de/events";
// Der Termin selbst kann sich aendern, waehrend die App offen ist (Team
// setzt kurzfristig einen neuen Boss-Event an) - deshalb regelmaessig neu
// abfragen statt nur einmal beim Start, analog zum Freundesliste-Pattern
// im Launcher (FriendsList.jsx, AUTO_REFRESH_MS).
const AUTO_REFRESH_MS = 60 * 1000;

function getRemaining(targetIso) {
  const target = new Date(targetIso).getTime();
  const diff = Math.max(0, target - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: diff <= 0,
  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

/**
 * Boss-Event-Countdown - "Highlight"-Banner im Stil des Desktop-Launchers
 * (Gold-Glow + pulsierende Sekunden, siehe .erzmark-boss-countdown in
 * theme.css). Liest denselben öffentlichen events.json-Termin und blendet
 * sich komplett aus, solange kein (zukünftiger) Termin gesetzt ist.
 */
export default function BossEventBanner() {
  const [event, setEvent] = useState(null);
  const [now, setNow] = useState(Date.now());
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getBossEvent().then(setEvent);
    const id = setInterval(() => getBossEvent().then(setEvent), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const remaining = useMemo(() => {
    if (!event?.nextBossEventAt) return null;
    return getRemaining(event.nextBossEventAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, now]);

  if (!remaining || remaining.expired) return null;

  const secondsScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <Pressable
      style={styles.banner}
      onPress={() => Linking.openURL(EVENTS_PAGE_URL).catch(() => {})}
    >
      <View style={styles.sigil}>
        <Text style={styles.icon}>⏳</Text>
      </View>
      <View style={styles.textCol}>
        <Text style={styles.label}>{event.eventName ?? "Boss-Event"}</Text>
        <View style={styles.digits}>
          {remaining.days > 0 && <Text style={styles.number}>{remaining.days}T </Text>}
          <Text style={styles.number}>{pad(remaining.hours)}</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.number}>{pad(remaining.minutes)}</Text>
          <Text style={styles.colon}>:</Text>
          <Animated.Text style={[styles.number, styles.numberGold, { transform: [{ scale: secondsScale }] }]}>
            {pad(remaining.seconds)}
          </Animated.Text>
        </View>
        {event.description && (
          <Text style={styles.description} numberOfLines={1}>
            {event.description}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: "rgba(255, 185, 0, 0.5)",
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  sigil: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1.5,
    borderColor: "rgba(255, 185, 0, 0.5)",
  },
  icon: { fontSize: 18 },
  textCol: { flex: 1, gap: 2 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.gold,
    textShadowColor: "rgba(255, 185, 0, 0.5)",
    textShadowRadius: 8,
  },
  digits: { flexDirection: "row", alignItems: "baseline" },
  number: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  numberGold: {
    color: colors.gold,
    textShadowColor: "rgba(255, 185, 0, 0.6)",
    textShadowRadius: 10,
  },
  colon: { fontSize: 15, fontWeight: "800", color: "rgba(255, 185, 0, 0.45)", marginHorizontal: 1 },
  description: { fontSize: 11, color: colors.textMuted },
});
