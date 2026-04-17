import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Modal } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, getToken } from "@/lib/api";
import { clearCart, getCart, setCart, setLineQuantity, type CartLine } from "@/lib/cart";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { CommonShopHeader } from "@/components/CommonShopHeader";
import { deliveryFeeForSubtotal, FREE_DELIVERY_MIN_SUBTOTAL } from "@/lib/free-delivery";

const QTY_ORANGE = "#1d4ed8";
const CART_LINE_IMAGE = 80;
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

function numFromApi(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function offerPercent(line: CartLine): number | null {
  if (typeof line.discountPercent === "number" && line.discountPercent > 0) {
    return Math.round(line.discountPercent);
  }
  const mrp = line.mrp ?? 0;
  if (mrp > line.price && mrp > 0) return Math.round(((mrp - line.price) / mrp) * 100);
  return null;
}

function totalDiscount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => {
    const mrp = line.mrp ?? line.price;
    if (mrp <= line.price) return sum;
    return sum + (mrp - line.price) * line.quantity;
  }, 0);
}

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState("");
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

  /** Older rows: fill image, MRP, discount from product API. */
  useEffect(() => {
    const ids = new Set<string>();
    for (const l of lines) {
      if (!l.imageUrl?.trim()) ids.add(l.productId);
      if (l.mrp === undefined) ids.add(l.productId);
    }
    const missingIds = [...ids];
    if (missingIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      type Pick = {
        imageUrl?: string | null;
        imageUrl2?: string | null;
        mrp?: unknown;
        discountPercent?: number | null;
      };
      const updates: Record<string, { imageUrl?: string | null; mrp: number; discountPercent: number }> = {};
      const slice = missingIds.slice(0, 24);
      await Promise.all(
        slice.map(async (pid) => {
          const res = await api<{ product: Pick }>(`/api/shop/product/${encodeURIComponent(pid)}`);
          if (!res.ok || !res.data?.product) return;
          const pr = res.data.product;
          const img =
            pr.imageUrl?.trim() || pr.imageUrl2?.trim() || "";
          const mrpN = numFromApi(pr.mrp);
          const disc =
            typeof pr.discountPercent === "number" && Number.isFinite(pr.discountPercent) ? pr.discountPercent : 0;
          updates[pid] = {
            ...(img ? { imageUrl: img } : {}),
            mrp: mrpN,
            discountPercent: disc,
          };
        }),
      );
      if (cancelled || Object.keys(updates).length === 0) return;
      const cart = await getCart();
      const next = cart.map((l) => {
        const u = updates[l.productId];
        if (!u) return l;
        return {
          ...l,
          ...(u.imageUrl ? { imageUrl: u.imageUrl } : {}),
          mrp: u.mrp,
          discountPercent: u.discountPercent,
        };
      });
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
  const discountTotal = totalDiscount(lines);
  const storeId = lines[0]?.storeId;

  async function changeQty(productId: string, delta: number) {
    const line = lines.find((l) => l.productId === productId);
    if (!line) return;
    const next = line.quantity + delta;
    await setLineQuantity(productId, next);
    await refreshLines();
  }

  async function removeLine(productId: string) {
    await setLineQuantity(productId, 0);
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
    const oid = res.data?.order.id ?? "";
    await clearCart();
    setLines([]);
    setPlacedOrderId(oid);
    setShowOrderSuccess(true);
  }

  function confirmCheckout() {
    if (submitting) return;
    setShowCheckoutConfirm(true);
  }

  function confirmCheckoutYes() {
    setShowCheckoutConfirm(false);
    void checkout();
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
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: 16,
              paddingBottom: 140 + insets.bottom,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                marginBottom: 14,
                borderRadius: 18,
                backgroundColor: "#047857",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderWidth: 1,
                borderColor: "#059669",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: "#ecfdf5", fontSize: 22, fontWeight: "900" }}>You saved {money(discountTotal || 0)}</Text>
                <Text style={{ color: "rgba(236,253,245,0.9)", fontSize: 12, fontWeight: "700", marginTop: 2 }}>
                  Best deals automatically applied.
                </Text>
              </View>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="party-popper" size={20} color="#ecfdf5" />
              </View>
            </View>

            {lines.map((item) => {
              const img = resolveMediaUrl(item.imageUrl ?? undefined);
              const unit = item.unitLabel?.trim() || "—";
              const mrp = item.mrp ?? 0;
              const showMrp = mrp > item.price;
              const offPct = offerPercent(item);
              return (
                <View key={item.productId} style={{ ...CARD, padding: 12, marginBottom: 12, borderRadius: 18 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <View
                      style={{
                        width: CART_LINE_IMAGE,
                        height: CART_LINE_IMAGE,
                        borderRadius: 14,
                        overflow: "hidden",
                        backgroundColor: theme.slateLine,
                      }}
                    >
                      {img ? (
                        <Image
                          source={{ uri: img }}
                          style={{ width: CART_LINE_IMAGE, height: CART_LINE_IMAGE }}
                          contentFit="cover"
                          recyclingKey={item.productId}
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                          <MaterialCommunityIcons name="package-variant" size={34} color={theme.textMuted} />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                        <Text style={{ flex: 1, minWidth: 0, fontSize: 20, fontWeight: "900", color: theme.text }} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Pressable onPress={() => void removeLine(item.productId)} hitSlop={8} style={{ padding: 2 }}>
                          <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.textMuted} />
                        </Pressable>
                      </View>
                      <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "900", color: "#1d4ed8" }}>{money(item.price * item.quantity)}</Text>
                          {showMrp ? (
                            <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textDim, textDecorationLine: "line-through" }}>
                              {money(mrp * item.quantity)}
                            </Text>
                          ) : null}
                          {offPct != null && offPct > 0 ? (
                            <View style={{ backgroundColor: "#dcfce7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 10, fontWeight: "900", color: "#059669" }}>{offPct}% OFF</Text>
                            </View>
                          ) : null}
                        </View>
                        <View
                          style={{
                            flexShrink: 0,
                            flexDirection: "row",
                            alignItems: "center",
                            borderWidth: 1,
                            borderColor: "#dbeafe",
                            borderRadius: 999,
                            overflow: "hidden",
                            backgroundColor: "#eff6ff",
                          }}
                        >
                          <Pressable onPress={() => void changeQty(item.productId, -1)} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }} hitSlop={8}>
                            <Text style={{ fontSize: 18, fontWeight: "900", color: QTY_ORANGE }}>−</Text>
                          </Pressable>
                          <Text style={{ fontSize: 14, fontWeight: "900", color: theme.text, minWidth: 28, textAlign: "center" }}>{item.quantity}</Text>
                          <Pressable
                            onPress={() => void changeQty(item.productId, 1)}
                            style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: "#bfdbfe" }}
                            hitSlop={8}
                          >
                            <Text style={{ fontSize: 18, fontWeight: "900", color: "#1e3a8a" }}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textMuted, marginTop: 4 }}>{unit}</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            <View style={{ ...CARD, marginBottom: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 16 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: theme.textMuted, letterSpacing: 1 }}>APPLY COUPON</Text>
              <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#f3f4f6", borderRadius: 999, padding: 5 }}>
                <View style={{ width: 30, alignItems: "center" }}>
                  <MaterialCommunityIcons name="ticket-percent-outline" size={17} color={theme.textMuted} />
                </View>
                <Text style={{ flex: 1, color: theme.textDim, fontWeight: "700", fontSize: 12 }}>Enter coupon code</Text>
                <Pressable style={{ backgroundColor: "#2563eb", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 }}>
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>Apply</Text>
                </Pressable>
              </View>
              <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
                {["SAVE50", "FREESHIP", "NEWUSER"].map((code) => (
                  <View key={code} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa" }}>
                    <Text style={{ color: "#9a3412", fontWeight: "800", fontSize: 10 }}>{code}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={{ ...CARD, padding: 14, marginBottom: 12, borderRadius: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" }}>
                    <MaterialCommunityIcons name="map-marker-radius-outline" size={18} color="#9ca3af" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: "800", fontSize: 13 }} numberOfLines={1}>
                      Home: 123, Luxury Heights...
                    </Text>
                    <Text style={{ color: theme.textMuted, fontWeight: "700", fontSize: 11, marginTop: 2 }}>ETA 15-20 mins</Text>
                  </View>
                </View>
                <Pressable>
                  <Text style={{ color: "#2563eb", fontWeight: "900", fontSize: 11 }}>CHANGE</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ ...CARD, padding: 16, marginTop: 2, borderRadius: 18 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: theme.textMuted, letterSpacing: 1 }}>BILL SUMMARY</Text>
              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: theme.textMuted, fontWeight: "600" }}>Subtotal</Text>
                  <Text style={{ color: theme.text, fontWeight: "800" }}>{money(itemsTotal)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: theme.textMuted, fontWeight: "600" }}>Delivery Fee</Text>
                  <Text style={{ color: deliveryFee === 0 ? "#059669" : theme.text, fontWeight: "800" }}>
                    {lines.length > 0 && deliveryFee === 0 ? "FREE" : money(deliveryFee)}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: theme.textMuted, fontWeight: "600" }}>Discount</Text>
                  <Text style={{ color: "#059669", fontWeight: "800" }}>-{money(discountTotal)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: theme.textMuted, fontWeight: "600" }}>Taxes & Charges</Text>
                  <Text style={{ color: theme.text, fontWeight: "800" }}>{money(handlingFee)}</Text>
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 14 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                <Text style={{ fontSize: 25, fontWeight: "900", color: theme.text }}>Total Amount</Text>
                <Text style={{ fontSize: 28, fontWeight: "900", color: "#1d4ed8" }}>{money(total)}</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textMuted, marginTop: 6 }}>
                {amountToFreeDelivery > 0 ? `Add ${money(amountToFreeDelivery)} more for free delivery` : "Free delivery unlocked on this order"}
              </Text>
            </View>
          </ScrollView>

          <View
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: 12 + insets.bottom,
              borderRadius: 18,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#e5e7eb",
              paddingHorizontal: 12,
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.1,
              shadowRadius: 14,
              elevation: 8,
            }}
          >
            <View>
              <Text style={{ color: theme.textMuted, fontWeight: "800", fontSize: 10, letterSpacing: 0.8 }}>GRAND TOTAL</Text>
              <Text style={{ color: theme.text, fontWeight: "900", fontSize: 20 }}>{money(total)}</Text>
              <Text style={{ color: theme.textMuted, fontWeight: "700", fontSize: 10 }}>{itemCount} items</Text>
            </View>
            {submitting ? (
              <View style={{ flex: 1, alignItems: "center" }}>
                <ActivityIndicator color={theme.brandNavOrange} />
              </View>
            ) : (
              <Pressable onPress={confirmCheckout} style={{ flex: 1, borderRadius: 999, overflow: "hidden" }}>
                <LinearGradient
                  colors={["#3b82f6", "#2563eb"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ paddingVertical: 15, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}>Place Order</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#fff" />
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </>
      )}
      <Modal transparent visible={showCheckoutConfirm} animationType="fade" onRequestClose={() => setShowCheckoutConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(2,6,23,0.5)", paddingHorizontal: 20, alignItems: "center", justifyContent: "center" }}>
          <View
            style={{
              width: "100%",
              maxWidth: 360,
              borderRadius: 22,
              backgroundColor: "#ffffff",
              borderWidth: 1,
              borderColor: "#dbeafe",
              paddingHorizontal: 18,
              paddingVertical: 18,
              shadowColor: "#0f172a",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 10 }}>
              <MaterialCommunityIcons name="cart-check" size={24} color="#2563eb" />
            </View>
            <Text style={{ textAlign: "center", color: "#0f172a", fontWeight: "900", fontSize: 20 }}>Place Order</Text>
            <Text style={{ textAlign: "center", color: "#475569", fontWeight: "700", fontSize: 15, marginTop: 6, lineHeight: 22 }}>
              Are you sure you want to proceed?
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={confirmCheckoutYes}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  backgroundColor: "#2563eb",
                  paddingVertical: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>Yes</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowCheckoutConfirm(false)}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  backgroundColor: "#f1f5f9",
                  borderWidth: 1,
                  borderColor: "#cbd5e1",
                  paddingVertical: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#334155", fontWeight: "800", fontSize: 14 }}>No</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={showOrderSuccess} animationType="fade" onRequestClose={() => setShowOrderSuccess(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(2,6,23,0.45)", paddingHorizontal: 20, alignItems: "center", justifyContent: "center" }}>
          <View
            style={{
              width: "100%",
              maxWidth: 360,
              borderRadius: 24,
              backgroundColor: "#ffffff",
              borderWidth: 1,
              borderColor: "#bfdbfe",
              paddingHorizontal: 18,
              paddingVertical: 20,
              shadowColor: "#0f172a",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <LinearGradient
              colors={["#dbeafe", "#93c5fd"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 12 }}
            >
              <MaterialCommunityIcons name="check-bold" size={28} color="#1e3a8a" />
            </LinearGradient>
            <Text style={{ textAlign: "center", color: "#0f172a", fontWeight: "900", fontSize: 22 }}>Order Placed</Text>
            <Text style={{ textAlign: "center", color: "#475569", fontWeight: "700", fontSize: 14, marginTop: 6, lineHeight: 21 }}>
              Your order has been placed successfully.
            </Text>
            {placedOrderId ? (
              <View style={{ marginTop: 12, alignSelf: "center", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#dbeafe" }}>
                <Text style={{ color: "#1d4ed8", fontWeight: "900", fontSize: 12 }}>Order ID: {placedOrderId.slice(0, 8)}...</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <Pressable
                onPress={() => {
                  setShowOrderSuccess(false);
                  router.push("/");
                }}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  backgroundColor: "#f1f5f9",
                  borderWidth: 1,
                  borderColor: "#cbd5e1",
                  paddingVertical: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#334155", fontWeight: "800", fontSize: 14 }}>Continue</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowOrderSuccess(false);
                  router.push("/orders");
                }}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  backgroundColor: "#2563eb",
                  paddingVertical: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>View Order</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
