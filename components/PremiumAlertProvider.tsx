import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  inferPremiumAlertVariant,
  registerPremiumAlertPresenter,
  unregisterPremiumAlertPresenter,
  type PremiumAlertButton,
  type PremiumAlertConfig,
  type PremiumAlertVariant,
} from "@/lib/premiumAlert";
import { rms, rs } from "@/lib/responsive";

const CTA_GREEN = "#059669";
const CTA_GREEN_PRESSED = "#047857";

type QueueItem = PremiumAlertConfig & { id: number };

const VARIANT_META: Record<
  PremiumAlertVariant,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; bg: string; color: string; ring: string }
> = {
  success: { icon: "check-circle-outline", bg: "#ecfdf5", color: "#059669", ring: "#bbf7d0" },
  error: { icon: "alert-circle-outline", bg: "#fef2f2", color: "#dc2626", ring: "#fecaca" },
  warning: { icon: "alert-outline", bg: "#fff7ed", color: "#d97706", ring: "#fed7aa" },
  info: { icon: "information-outline", bg: "#eff6ff", color: "#2563eb", ring: "#bfdbfe" },
};

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
  },
  android: { elevation: 12 },
  default: {},
});

function normalizeButtons(buttons?: PremiumAlertButton[]): PremiumAlertButton[] {
  if (!buttons?.length) return [{ text: "OK", style: "default" }];
  return buttons;
}

export function PremiumAlertProvider({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - rs(48), rs(340));
  const queueRef = useRef<QueueItem[]>([]);
  const idRef = useRef(0);
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [current, setCurrent] = useState<QueueItem | null>(null);

  const animateIn = useCallback(() => {
    scale.setValue(0.92);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.96, duration: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start(() => onDone());
    },
    [opacity, scale],
  );

  const showNext = useCallback(() => {
    const next = queueRef.current.shift() ?? null;
    setCurrent(next);
    if (next) animateIn();
  }, [animateIn]);

  const dismiss = useCallback(
    (after?: () => void) => {
      animateOut(() => {
        setCurrent(null);
        after?.();
        if (queueRef.current.length) showNext();
      });
    },
    [animateOut, showNext],
  );

  const enqueue = useCallback(
    (config: PremiumAlertConfig) => {
      const item: QueueItem = { ...config, id: ++idRef.current };
      if (!current && queueRef.current.length === 0) {
        setCurrent(item);
        animateIn();
      } else {
        queueRef.current.push(item);
      }
    },
    [animateIn, current],
  );

  useEffect(() => {
    registerPremiumAlertPresenter(enqueue);
    return () => unregisterPremiumAlertPresenter();
  }, [enqueue]);

  const variant = current ? inferPremiumAlertVariant(current.title, current.message) : "info";
  const meta = VARIANT_META[variant];
  const buttons = normalizeButtons(current?.buttons);
  const hasMessage = Boolean(current?.message?.trim());
  const stacked = buttons.length > 2;

  function onButtonPress(btn: PremiumAlertButton) {
    dismiss(() => btn.onPress?.());
  }

  function buttonStyle(btn: PremiumAlertButton) {
    if (btn.style === "destructive") {
      return { bg: "#dc2626", bgPressed: "#b91c1c", text: "#fff", border: "transparent" as const };
    }
    if (btn.style === "cancel") {
      return { bg: "#f8fafc", bgPressed: "#f1f5f9", text: "#475569", border: "#e2e8f0" as const };
    }
    return { bg: CTA_GREEN, bgPressed: CTA_GREEN_PRESSED, text: "#fff", border: "transparent" as const };
  }

  return (
    <>
      {children}
      <Modal visible={current != null} transparent animationType="none" statusBarTranslucent onRequestClose={() => dismiss()}>
        <Animated.View style={[styles.backdrop, { opacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss()} accessibilityRole="button" />
          <Animated.View
            style={[
              styles.card,
              cardShadow,
              { width: cardWidth, transform: [{ scale }] },
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: meta.bg, borderColor: meta.ring },
              ]}
            >
              <MaterialCommunityIcons name={meta.icon} size={rs(32)} color={meta.color} />
            </View>

            <Text style={styles.title}>{current?.title}</Text>
            {hasMessage ? <Text style={styles.message}>{current?.message}</Text> : null}

            <View style={[styles.btnRow, stacked && styles.btnCol]}>
              {buttons.map((btn, i) => {
                const s = buttonStyle(btn);
                return (
                  <Pressable
                    key={`${btn.text}-${i}`}
                    onPress={() => onButtonPress(btn)}
                    style={({ pressed }) => [
                      styles.btn,
                      stacked ? styles.btnFull : styles.btnFlex,
                      {
                        backgroundColor: pressed ? s.bgPressed : s.bg,
                        borderColor: s.border,
                        borderWidth: s.border === "transparent" ? 0 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.btnText, { color: s.text }]} numberOfLines={1}>
                      {btn.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: rs(20),
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: rs(24),
    paddingTop: rs(26),
    paddingHorizontal: rs(22),
    paddingBottom: rs(20),
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    alignItems: "center",
  },
  iconWrap: {
    width: rs(64),
    height: rs(64),
    borderRadius: rs(32),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: rs(16),
  },
  title: {
    fontSize: rms(19),
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: -0.3,
    paddingHorizontal: rs(4),
  },
  message: {
    marginTop: rs(10),
    fontSize: rms(14),
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
    lineHeight: rms(21),
    paddingHorizontal: rs(2),
  },
  btnRow: {
    flexDirection: "row",
    gap: rs(10),
    marginTop: rs(22),
    width: "100%",
  },
  btnCol: {
    flexDirection: "column",
  },
  btn: {
    borderRadius: rs(14),
    paddingVertical: rs(13),
    paddingHorizontal: rs(12),
    alignItems: "center",
    justifyContent: "center",
    minHeight: rs(48),
  },
  btnFlex: {
    flex: 1,
  },
  btnFull: {
    width: "100%",
  },
  btnText: {
    fontSize: rms(14),
    fontWeight: "900",
    letterSpacing: 0.1,
  },
});
