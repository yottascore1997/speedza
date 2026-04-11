import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, getToken } from "@/lib/api";
import { clearCart, getCart, removeLine, setCart, setLineQuantity, type CartLine } from "@/lib/cart";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { CommonShopHeader } from "@/components/CommonShopHeader";
import { deliveryFeeForSubtotal, FREE_DELIVERY_MIN_SUBTOTAL } from "@/lib/free-delivery";

const QTY_GREEN = "#16a34a";
const CARD = {
  backgroundColor: "#fff",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#e5e7eb",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
} as const;

function money(n: number) {
  return `₹${Math.round(n * 100) / 100}`;
}

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deliveryFeePerOrder, setDeliveryFeePerOrder] = useState(25);
  const [freeDeliveryMin, setFreeDeliveryMin] = useState(FREE_DELIVERY_MIN_SUBTOTAL);
  const handlingFee = 0;

  const refreshLines = useCallback(async () => {
    const cart = await getCart();
    setLines(cart);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await refreshLines();
        const res = await api<{
          deliveryFeePerOrder?: number;
          freeDeliveryMinSubtotal?: number;
        }>("/api/shop/ordering-status");
        if (
          res.ok &&
          res.data &&
          typeof res.data.deliveryFeePerOrder === "number" &&
          Number.isFinite(res.data.deliveryFeePerOrder)
        ) {
          setDeliveryFeePerOrder(res.data.deliveryFeePerOrder);
        }
        if (
          res.ok &&
          res.data &&
          typeof res.data.freeDeliveryMinSubtotal === "number" &&
          Number.isFinite(res.data.freeDeliveryMinSubtotal) &&
          res.data.freeDeliveryMinSubtotal > 0
        ) {
          setFreeDeliveryMin(res.data.freeDeliveryMinSubtotal);
        }
      })();
    }, [refreshLines]),
  );

  /** Older cart rows had no imageUrl; fetch from product API and persist (same as delivery web cart). */
  useEffect(() => {
    const missingIds = [...new Set(lines.filter((l) => !l.imageUrl?.trim()).map((l) => l.productId))];
    if (missingIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      const updates: Record<string, string> = {};
      const slice = missingIds.slice(0, 24);
      await Promise.all(
        slice.map(async (pid) => {
          const res = await api<{ product: { imageUrl?: string | null; imageUrl2?: string | null } }>(
            `/api/shop/product/${encodeURIComponent(pid)}`,
          );
          if (!res.ok || !res.data?.product) return;
          const u =
            res.data.product.imageUrl?.trim() ||
            res.data.product.imageUrl2?.trim() ||
            "";
          if (u) updates[pid] = u;
        }),
      );
      if (cancelled || Object.keys(updates).length === 0) return;
      const cart = await getCart();
      const next = cart.map((l) => (updates[l.productId] ? { ...l, imageUrl: updates[l.productId] } : l));
      await setCart(next);
      if (!cancelled) setLines(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [lines]);

  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const itemsTotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const deliveryFee = deliveryFeeForSubtotal(itemsTotal, deliveryFeePerOrder, lines.length > 0, freeDeliveryMin);
  const total = itemsTotal + deliveryFee + handlingFee;
  const amountToFreeDelivery =
    lines.length > 0 && itemsTotal < freeDeliveryMin ? Math.max(0, freeDeliveryMin - itemsTotal) : 0;
  const storeId = lines[0]?.storeId;

  async function changeQty(productId: string, delta: number) {
    const line = lines.find((l) => l.productId === productId);
    if (!line) return;
    const next = line.quantity + delta;
    await setLineQuantity(productId, next);
    await refreshLines();
  }

  async function trashLine(productId: string) {
    await removeLine(productId);
    await refreshLines();
  }

  async function checkout() {
    const token = await getToken();
    if (!token) {
      Alert.alert("Login required", "Please sign in to place an order.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign in", onPress: () => router.push("/login") },
      ]);
      return;
    }
    if (!storeId) return;
    setSubmitting(true);
    const res = await api<{ order: { id: string } }>("/api/orders/create", {
      method: "POST",
      body: JSON.stringify({
        storeId,
        paymentType: "COD",
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        })),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      Alert.alert("Error", res.error || "Order failed");
      return;
    }
    await clearCart();
    setLines([]);
    Alert.alert("Order placed", `Order ${res.data?.order.id?.slice(0, 8)}…`, [
      { text: "OK", onPress: () => router.push("/orders") },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.screenBg }}>
      <CommonShopHeader safeTop={insets.top} activeKey="__shop__" />
      {lines.length === 0 ? (
        <View style={{ flex: 1, padding: 16, paddingTop: 24, alignItems: "center" }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "900" }}>Your cart is empty</Text>
          <Text style={{ color: theme.textMuted, marginTop: 8, fontWeight: "600", textAlign: "center" }}>
            Browse categories and tap Add to build your order.
          </Text>
          <Pressable
            onPress={() => router.replace("/")}
            style={{
              marginTop: 20,
              backgroundColor: theme.brandNavOrange,
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>Browse shop</Text>
          </Pressable>
          <Text
            style={{
              marginTop: 16,
              fontSize: 12,
              fontWeight: "700",
              color: theme.primary,
              textAlign: "center",
              paddingHorizontal: 20,
            }}
          >
            Free delivery on orders above ₹{freeDeliveryMin}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 24 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          {lines.map((item) => {
            const img = resolveMediaUrl(item.imageUrl ?? undefined);
            const lineTotal = item.price * item.quantity;
            const unit = item.unitLabel?.trim() || "—";
            return (
              <View key={item.productId} style={{ ...CARD, padding: 14, marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      overflow: "hidden",
                      backgroundColor: theme.slateLine,
                    }}
                  >
                    {img ? (
                      <Image
                        source={{ uri: img }}
                        style={{ width: 64, height: 64 }}
                        contentFit="cover"
                        recyclingKey={item.productId}
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <MaterialCommunityIcons name="package-variant" size={28} color={theme.textMuted} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: "900", color: theme.text }} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textMuted, marginTop: 4 }}>{unit}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: theme.textMuted }}>
                        {money(item.price)} each
                      </Text>
                      <View
                        style={{
                          backgroundColor: "#ffedd5",
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "900", color: "#c2410c" }}>Total {money(lineTotal)}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View
                  style={{
                    marginTop: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    alignSelf: "flex-end",
                    borderWidth: 1.5,
                    borderColor: QTY_GREEN,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <Pressable
                    onPress={() => void changeQty(item.productId, -1)}
                    style={{ paddingHorizontal: 14, paddingVertical: 10 }}
                    hitSlop={8}
                  >
                    <Text style={{ fontSize: 20, fontWeight: "900", color: QTY_GREEN }}>−</Text>
                  </Pressable>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: theme.text, minWidth: 28, textAlign: "center" }}>
                    {item.quantity}
                  </Text>
                  <Pressable
                    onPress={() => void changeQty(item.productId, 1)}
                    style={{ paddingHorizontal: 14, paddingVertical: 10 }}
                    hitSlop={8}
                  >
                    <Text style={{ fontSize: 20, fontWeight: "900", color: QTY_GREEN }}>+</Text>
                  </Pressable>
                  <View style={{ width: 1, alignSelf: "stretch", backgroundColor: "#fecaca" }} />
                  <Pressable
                    onPress={() => void trashLine(item.productId)}
                    style={{ paddingHorizontal: 12, paddingVertical: 10 }}
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={22} color="#dc2626" />
                  </Pressable>
                </View>
              </View>
            );
          })}

          <View
            style={{
              marginBottom: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: theme.primarySoft,
              borderWidth: 1,
              borderColor: "#a7f3d0",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color: theme.primary,
                textAlign: "center",
              }}
            >
              Free delivery on orders above ₹{freeDeliveryMin}
            </Text>
            {amountToFreeDelivery > 0 ? (
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  fontWeight: "600",
                  color: theme.textMuted,
                  textAlign: "center",
                }}
              >
                Add {money(amountToFreeDelivery)} more to unlock free delivery
              </Text>
            ) : lines.length > 0 ? (
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  fontWeight: "700",
                  color: "#059669",
                  textAlign: "center",
                }}
              >
                You unlocked free delivery on this order
              </Text>
            ) : null}
          </View>

          <View style={{ ...CARD, padding: 16, marginTop: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: theme.textMuted, letterSpacing: 1 }}>BILL SUMMARY</Text>
            <View style={{ marginTop: 14, gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.textMuted, fontWeight: "600" }}>Items</Text>
                <Text style={{ color: theme.text, fontWeight: "800" }}>{itemCount}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.textMuted, fontWeight: "600" }}>Subtotal</Text>
                <Text style={{ color: theme.text, fontWeight: "800" }}>{money(itemsTotal)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.textMuted, fontWeight: "600" }}>Delivery</Text>
                <Text
                  style={{
                    color: deliveryFee === 0 ? "#059669" : theme.text,
                    fontWeight: "800",
                  }}
                >
                  {lines.length > 0 && deliveryFee === 0 ? "FREE" : money(deliveryFee)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.textMuted, fontWeight: "600" }}>Handling</Text>
                <Text style={{ color: theme.text, fontWeight: "800" }}>{money(handlingFee)}</Text>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 14 }} />
            <Text style={{ fontSize: 11, fontWeight: "800", color: theme.textMuted, letterSpacing: 0.8 }}>TO PAY</Text>
            <Text style={{ fontSize: 28, fontWeight: "900", color: theme.text, marginTop: 6 }}>{money(total)}</Text>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textMuted, marginTop: 4 }}>
              Incl. taxes as applicable · COD
            </Text>
            {submitting ? (
              <ActivityIndicator color={theme.brandNavOrange} style={{ marginTop: 16 }} />
            ) : (
              <Pressable onPress={() => void checkout()} style={{ marginTop: 16, borderRadius: 14, overflow: "hidden" }}>
                <LinearGradient
                  colors={[...theme.placeOrderGradient]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ paddingVertical: 16, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 17 }}>Place order</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
