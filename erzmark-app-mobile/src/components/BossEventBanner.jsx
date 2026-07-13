import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import { getBossEvent } from "../api/events";
import { colors, radius, spacing } from "../theme";

const EVENTS_PAGE_URL = "https://erzmark.de/events";

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
 * Boss-Event-Countdown, Pendant zu BossEventCountdown.jsx im Desktop-Launcher
 * - liest denselben öffentlichen events.json-Termin. Blendet sich komplett
 * aus, solange kein (zukünftiger) Termin gesetzt ist, statt eine
 * Fehlermeldung zu zeigen (rein dekoratives Widget).
 */
export default function BossEventBanner() {
  const [event, setEvent] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    getBossEvent().then(setEvent);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = useMemo(() => {
    if (!event?.nextBossEventAt) return null;
    return getRemaining(event.nextBossEventAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, now]);

  if (!remaining || remaining.expired) return null;

  return (
    <Pressable
      style={styles.banner}
      onPress={() => Linking.openURL(EVENTS_PAGE_URL).catch(() => {})}
    >
      <Text style={styles.icon}>⏳</Text>
      <View style={styles.textCol}>
        <Text style={styles.label}>{event.eventName ?? "Boss-Event"}</Text>
        <View style={styles.digits}>
          {remaining.days > 0 && (
            <Text style={styles.number}>{remaining.days}T </Text>
          )}
          <Text style={styles.number}>
            {pad(remaining.hours)}:{pad(remaining.minutes)}:{pad(remaining.seconds)}
          </Text>
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
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  icon: { fontSize: 22 },
  textCol: { flex: 1, gap: 2 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.gold,
  },
  digits: { flexDirection: "row", alignItems: "baseline" },
  number: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  description: { fontSize: 11, color: colors.textMuted },
});
