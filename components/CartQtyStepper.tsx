import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { addToCart, getCart, setLineQuantity, subscribeCart, type CartLine } from "@/lib/cart";
import { theme } from "@/lib/theme";
import { premiumAlert } from "@/lib/premiumAlert";

export type CartQtyStepperLine = Omit<CartLine, "quantity">;

/** Add — solid dark green, white label */
const ADD_GREEN = "#166534";
/** Light row behind − qty + */
const ROW_BG = "#fff7ed";
/** Dark controls (warm brown-orange) */
const BTN_DARK = "#7c2d12";
const BTN_DARK_DISABLED = "#a8a29e";

type Props = {
  line: CartQtyStepperLine;
  maxQty?: number;
  canAdd?: boolean;
  compact?: boolean;
  /** Smaller controls for image-corner overlay on product tiles */
  dense?: boolean;
  addLabel?: string;
  addBgColor?: string;
  addBorderColor?: string;
  /** White pill, green border & label (category grid / Blinkit-style ADD) */
  addOutline?: boolean;
  /** Green + circle on product image; expands to − qty + when in cart */
  fabPlus?: boolean;
};

export function CartQtyStepper({
  line,
  maxQty = 999,
  canAdd = true,
  compact = false,
  dense = false,
  addLabel = "Add to cart",
  addBgColor = ADD_GREEN,
  addBorderColor = "#14532d",
  addOutline = false,
  fabPlus = false,
}: Props) {
  const [qty, setQty] = useState(0);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    const cart = await getCart();
    setQty(cart.find((l) => l.productId === line.productId)?.quantity ?? 0);
  }, [line.productId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    return subscribeCart(() => {
      void refresh();
    });
  }, [refresh]);

  const cap = maxQty;
  const atMax = qty >= cap;
  const addDisabled = !canAdd;

  async function addFirstToCart(): Promise<boolean> {
    const res = await addToCart({ ...line, quantity: 1 });
    if (res.ok) return true;

    if (res.reason !== "store_mismatch") return false;

    const existingLabel = res.currentStoreName?.trim() || "another store";
    const nextLabel = line.storeName?.trim() || "this store";

    return new Promise((resolve) => {
      premiumAlert(
        "Different store",
        `Your cart has items from ${existingLabel}. Replace them with items from ${nextLabel}?`,
        [
          { text: "Keep current cart", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Replace cart",
            style: "destructive",
            onPress: () => {
              void (async () => {
                const replaced = await addToCart({ ...line, quantity: 1 }, { replaceOnStoreMismatch: true });
                resolve(replaced.ok);
              })();
            },
          },
        ],
      );
    });
  }

  async function increment() {
    if (inflight.current) return;
    if (qty === 0 && !canAdd) return;
    if (qty > 0 && atMax) return;
    inflight.current = true;
    const prev = qty;
    const next = prev === 0 ? 1 : Math.min(prev + 1, cap);
    setQty(next);
    try {
      if (prev === 0) {
        const added = await addFirstToCart();
        if (!added) setQty(prev);
      } else {
        await setLineQuantity(line.productId, next);
      }
    } catch {
      setQty(prev);
    } finally {
      inflight.current = false;
    }
  }

  async function decrement() {
    if (inflight.current || qty < 1) return;
    inflight.current = true;
    const prev = qty;
    setQty(prev - 1);
    try {
      await setLineQuantity(line.productId, prev - 1);
    } catch {
      setQty(prev);
    } finally {
      inflight.current = false;
    }
  }

  const btn = dense ? 26 : compact ? 34 : 44;
  const fontMain = dense ? 13 : compact ? 15 : 18;
  const fontQty = dense ? 13 : compact ? 15 : 18;
  const radius = dense ? 10 : compact ? 10 : 16;
  const rowGap = dense ? 4 : 6;
  const addPadV = dense ? 6 : compact ? 8 : 14;
  const addPadH = dense ? 10 : compact ? 10 : 14;
  const addMinH = dense ? 34 : compact ? 40 : 52;
  const rowMinH = dense ? 40 : compact ? 40 : 52;
  const rowPadH = dense ? 3 : compact ? 6 : 8;
  const rowPadV = dense ? 4 : compact ? 4 : 6;

  const fabShadow = Platform.select({
    ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
    android: { elevation: 2 },
    default: {},
  });

  if (fabPlus) {
    if (qty === 0) {
      return (
        <Pressable
          onPress={() => void increment()}
          disabled={addDisabled}
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: addDisabled ? "#94a3b8" : "#2f9e44",
            borderWidth: 1,
            borderColor: "#ffffff",
            alignItems: "center",
            justifyContent: "center",
            opacity: addDisabled ? 0.65 : 1,
            ...fabShadow,
          }}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="plus" size={19} color="#fff" />
        </Pressable>
      );
    }

    const fabBtn = 24;
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 30,
          borderRadius: 15,
          backgroundColor: "#ffffff",
          borderWidth: 1,
          borderColor: "#2f9e44",
          paddingHorizontal: 2,
          gap: 2,
          ...fabShadow,
        }}
      >
        <Pressable
          onPress={() => void decrement()}
          style={{
            width: fabBtn,
            height: fabBtn,
            borderRadius: fabBtn / 2,
            backgroundColor: "#2f9e44",
            alignItems: "center",
            justifyContent: "center",
          }}
          hitSlop={6}
        >
          <Text style={{ fontSize: 14, fontWeight: "900", color: "#fff", marginTop: -1 }}>−</Text>
        </Pressable>
        <Text style={{ minWidth: 14, textAlign: "center", fontSize: 12, fontWeight: "900", color: "#166534" }}>{qty}</Text>
        <Pressable
          onPress={() => void increment()}
          disabled={!canAdd || atMax}
          style={{
            width: fabBtn,
            height: fabBtn,
            borderRadius: fabBtn / 2,
            backgroundColor: atMax || !canAdd ? "#94a3b8" : "#2f9e44",
            alignItems: "center",
            justifyContent: "center",
          }}
          hitSlop={6}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "900",
              color: atMax || !canAdd ? "rgba(255,255,255,0.8)" : "#fff",
              marginTop: -1,
            }}
          >
            +
          </Text>
        </Pressable>
      </View>
    );
  }

  if (qty === 0) {
    return (
      <Pressable
        onPress={() => void increment()}
        disabled={addDisabled}
        style={{
          borderRadius: radius,
          overflow: "hidden",
          opacity: addDisabled ? 0.55 : 1,
          minHeight: addMinH,
          alignSelf: dense ? "stretch" : undefined,
          width: dense ? "100%" : undefined,
        }}
      >
        {addDisabled ? (
          <View
            style={{
              flex: 1,
              backgroundColor: theme.slateLine,
              paddingVertical: addPadV,
              paddingHorizontal: addPadH,
              alignItems: "center",
              justifyContent: "center",
              minHeight: addMinH,
            }}
          >
            <Text
              style={{
                color: theme.textDim,
                textAlign: "center",
                fontWeight: "900",
                fontSize: dense ? 10 : compact ? 12 : 16,
              }}
            >
              Out of stock
            </Text>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: addOutline ? "#ffffff" : addBgColor,
              paddingVertical: addPadV,
              paddingHorizontal: addPadH,
              alignItems: "center",
              justifyContent: "center",
              minHeight: addMinH,
              borderWidth: addOutline ? 1.5 : 1,
              borderColor: addOutline ? addBgColor : addBorderColor,
            }}
          >
            <Text
              style={{
                color: addOutline ? addBgColor : "#fff",
                textAlign: "center",
                fontWeight: "900",
                fontSize: dense ? 11 : compact ? 12 : 16,
              }}
            >
              {addLabel}
            </Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: rowGap,
        backgroundColor: ROW_BG,
        borderRadius: radius,
        paddingVertical: rowPadV,
        paddingHorizontal: rowPadH,
        minHeight: rowMinH,
        borderWidth: 1,
        borderColor: "#fed7aa",
        alignSelf: dense ? "stretch" : undefined,
        width: dense ? "100%" : undefined,
      }}
    >
      <Pressable
        onPress={() => void decrement()}
        style={{
          width: btn,
          height: btn,
          borderRadius: dense ? 7 : compact ? 8 : 12,
          backgroundColor: BTN_DARK,
          alignItems: "center",
          justifyContent: "center",
        }}
        hitSlop={8}
      >
        <Text style={{ fontSize: fontMain, fontWeight: "900", color: "#fff", marginTop: -1 }}>−</Text>
      </Pressable>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          minWidth: dense ? 20 : 28,
          paddingHorizontal: dense ? 2 : 0,
        }}
      >
        <Text style={{ fontSize: fontQty, fontWeight: "900", color: BTN_DARK }}>{qty}</Text>
      </View>
      <Pressable
        onPress={() => void increment()}
        disabled={!canAdd || atMax}
        style={{
          width: btn,
          height: btn,
          borderRadius: dense ? 7 : compact ? 8 : 12,
          backgroundColor: atMax || !canAdd ? BTN_DARK_DISABLED : BTN_DARK,
          alignItems: "center",
          justifyContent: "center",
        }}
        hitSlop={8}
      >
        <Text
          style={{
            fontSize: fontMain,
            fontWeight: "900",
            color: atMax || !canAdd ? "rgba(255,255,255,0.75)" : "#fff",
            marginTop: -1,
          }}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}
