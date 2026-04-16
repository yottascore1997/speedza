import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, getToken } from "@/lib/api";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { CommonShopHeader } from "@/components/CommonShopHeader";
import { ProductPriceOfferRow } from "@/components/ProductPriceOfferRow";

function statusPillColors(status: string): { bg: string; text: string } {
  const s = status.toUpperCase();
  if (s.includes("DELIVERED") || s.includes("COMPLETED")) return { bg: "#dcfce7", text: "#166534" };
  if (s.includes("CANCEL")) return { bg: "#fee2e2", text: "#991b1b" };
  if (s.includes("OUT") || s.includes("PICK") || s.includes("DISPATCH")) return { bg: "#dbeafe", text: "#1e40af" };
  if (s.includes("PENDING") || s.includes("PLACED") || s.includes("CONFIRM")) return { bg: "#fef3c7", text: "#92400e" };
  return { bg: "#f3f4f6", text: "#374151" };
}

const orderCard = {
  backgroundColor: theme.bgElevated,
  borderRadius: 22,
  marginBottom: 14,
  borderWidth: 1,
  borderColor: theme.border,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 4,
} as const;

type OrderRow = {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  store: { name: string; shopVertical?: string | null };
  items?: {
    quantity: number;
    price: number;
    product: { id?: string; name: string; imageUrl?: string | null; imageUrl2?: string | null; mrp?: number | null };
  }[];
  delivery?: { id: string; status: string } | null;
};

function orderStatusLabel(status: string) {
  return status.replace(/_/g, " ").toUpperCase();
}

function money(v: number) {
  return `₹${Math.round(v * 100) / 100}`;
}

function productThumbUri(p: { imageUrl?: string | null; imageUrl2?: string | null } | undefined): string | undefined {
  if (!p) return undefined;
  return resolveMediaUrl(p.imageUrl?.trim() || p.imageUrl2?.trim() || undefined);
}

/** Store line under product — only for food-vertical shops (matches `Store.shopVertical`). */
function showStoreName(store: { shopVertical?: string | null } | undefined): boolean {
  const v = (store?.shopVertical ?? "").toLowerCase().trim();
  return v === "food" || v.startsWith("food-");
}

/** Unit-level % off from catalog MRP vs price you paid (per unit on the order line). */
function unitDiscountPercent(mrp: number | null | undefined, unitSelling: number): number | null {
  const m = typeof mrp === "number" && Number.isFinite(mrp) ? mrp : 0;
  if (m <= unitSelling || m <= 0) return null;
  const p = Math.round(((m - unitSelling) / m) * 100);
  return p > 0 ? p : null;
}

/** Must match server default `CUSTOMER_ORDER_CANCEL_MINUTES` (delivery/.env). */
const CUSTOMER_CANCEL_WINDOW_MS = 15 * 60 * 1000;

function canCustomerCancelOrder(o: {
  status: string;
  createdAt: string;
  delivery?: { id: string } | null;
}): boolean {
  if (o.status.toUpperCase() !== "PLACED") return false;
  if (o.delivery?.id) return false;
  const age = Date.now() - new Date(o.createdAt).getTime();
  return age >= 0 && age <= CUSTOMER_CANCEL_WINDOW_MS;
}

function customerCancelHint(o: {
  status: string;
  createdAt: string;
  delivery?: { id: string } | null;
}): string | null {
  if (o.status.toUpperCase() !== "PLACED" || o.delivery?.id) return null;
  if (canCustomerCancelOrder(o)) return null;
  return "The 15-minute free cancellation window has ended. Please contact the store if you still need help.";
}

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<OrderRow | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setOrders([]);
      return;
    }
    setLoading(true);
    const res = await api<{ orders: OrderRow[] }>("/api/orders/user?limit=40");
    setLoading(false);
    if (res.ok && res.data) setOrders(res.data.orders);
    else if (!res.ok) Alert.alert("Error", res.error || "Failed");
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const token = await getToken();
        if (!token) {
          setOrders([]);
          return;
        }
        await load();
      })();
    }, [load]),
  );

  const modalItemsTotal = useMemo(
    () =>
      activeOrder?.items?.reduce((sum, row) => sum + row.quantity * row.price, 0) ??
      activeOrder?.totalAmount ??
      0,
    [activeOrder],
  );

  async function requestCancelOrder(order: OrderRow) {
    Alert.alert(
      "Cancel this order?",
      "Only works while the store hasn’t started preparing it (within 15 minutes of placing). Stock will be released back to the store.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, cancel",
          style: "destructive",
          onPress: () => void submitCancelOrder(order.id),
        },
      ],
    );
  }

  async function submitCancelOrder(orderId: string) {
    setCancelLoading(true);
    const res = await api<{ order: { id: string; status: string } }>("/api/orders/cancel-my", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    });
    setCancelLoading(false);
    if (!res.ok) {
      Alert.alert("Could not cancel", res.error || "Please try again or contact the store.");
      return;
    }
    setActiveOrder(null);
    await load();
    Alert.alert("Order cancelled", "Your order was cancelled successfully.");
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.screenBg }}>
      <CommonShopHeader safeTop={insets.top} activeKey="__shop__" />
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
        data={orders}
        keyExtractor={(o) => o.id}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 30, fontWeight: "900", color: "#111827", letterSpacing: -0.3 }}>
              Your orders
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.textMuted, marginTop: 3 }}>
              Track everything in one place
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={{ paddingTop: 32, alignItems: "center", paddingHorizontal: 8 }}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: "900" }}>No orders yet</Text>
              <Text style={{ color: theme.textMuted, marginTop: 8, fontWeight: "600", textAlign: "center" }}>
                When you place an order, it will show up here.
              </Text>
              <Pressable
                onPress={() => router.replace("/")}
                style={{
                  marginTop: 20,
                  backgroundColor: theme.primary,
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  borderRadius: 14,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "800" }}>Start shopping</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const pill = statusPillColors(item.status);
          const firstItem = item.items?.[0];
          const firstThumb = productThumbUri(firstItem?.product);
          const firstItemTotal = firstItem ? firstItem.price * firstItem.quantity : item.totalAmount;
          return (
            <Pressable style={orderCard} onPress={() => setActiveOrder(item)}>
              <View
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                  paddingHorizontal: 14,
                  paddingTop: 12,
                  paddingBottom: 10,
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: "800" }}>
                  #{item.id.slice(0, 8).toUpperCase()}
                </Text>
                <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: pill.bg }}>
                  <Text style={{ fontSize: 12, color: pill.text, fontWeight: "900" }}>{orderStatusLabel(item.status)}</Text>
                </View>
              </View>

              <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <View
                    style={{
                      width: 112,
                      height: 96,
                      borderRadius: 16,
                      backgroundColor: "#f3f4f6",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {firstThumb ? (
                      <Image
                        source={{ uri: firstThumb }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        recyclingKey={firstItem?.product.id ?? firstThumb}
                      />
                    ) : (
                      <MaterialCommunityIcons name="package-variant" size={40} color={theme.textMuted} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                    <Text style={{ color: theme.text, fontSize: 22, fontWeight: "900" }} numberOfLines={2}>
                      {firstItem?.product.name || "Order item"}
                    </Text>
                    {showStoreName(item.store) ? (
                      <Text style={{ color: theme.textMuted, fontSize: 14, fontWeight: "600", marginTop: 6 }} numberOfLines={1}>
                        {item.store.name}
                      </Text>
                    ) : null}
                    {firstItem ? (
                      <ProductPriceOfferRow
                        sellingPrice={firstItem.price}
                        mrp={typeof firstItem.product.mrp === "number" ? firstItem.product.mrp : 0}
                        discountPercent={unitDiscountPercent(firstItem.product.mrp, firstItem.price)}
                        compact
                        layout="premiumGrid"
                        style={{ marginTop: showStoreName(item.store) ? 8 : 10 }}
                      />
                    ) : null}
                  </View>
                  <View style={{ alignItems: "flex-end", paddingTop: 2 }}>
                    <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: "800" }}>Order total</Text>
                    <Text style={{ color: "#ea580c", fontSize: 21, fontWeight: "900", marginTop: 2 }}>{money(item.totalAmount)}</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: "700", marginTop: 2 }}>COD</Text>
                  </View>
                </View>

                <Text style={{ marginTop: 12, fontSize: 13, color: theme.textMuted, fontWeight: "600" }}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>

                <View
                  style={{
                    marginTop: 10,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: "#f9fafb",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700", flex: 1 }} numberOfLines={2}>
                      {firstItem ? `${firstItem.quantity}x ${firstItem.product.name}` : "Tap to view details"}
                    </Text>
                    <Text style={{ color: theme.text, fontSize: 14, fontWeight: "900" }}>{money(firstItemTotal)}</Text>
                  </View>
                  {firstItem ? (
                    <ProductPriceOfferRow
                      sellingPrice={firstItem.price}
                      mrp={typeof firstItem.product.mrp === "number" ? firstItem.product.mrp : 0}
                      discountPercent={unitDiscountPercent(firstItem.product.mrp, firstItem.price)}
                      compact
                      layout="inline"
                      style={{ marginTop: 8 }}
                    />
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <Modal visible={!!activeOrder} transparent animationType="slide" onRequestClose={() => setActiveOrder(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <View
            style={{
              maxHeight: "82%",
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 14,
              paddingHorizontal: 16,
              paddingBottom: 16 + insets.bottom,
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 10 }}>
              <View style={{ width: 56, height: 6, borderRadius: 99, backgroundColor: "#e5e7eb" }} />
            </View>
            {activeOrder ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: theme.text }}>Order details</Text>
                <Text style={{ marginTop: 6, color: theme.textMuted, fontWeight: "700" }}>
                  #{activeOrder.id.slice(0, 8).toUpperCase()} · {new Date(activeOrder.createdAt).toLocaleString()}
                </Text>

                <View
                  style={{
                    marginTop: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: theme.border,
                    padding: 12,
                    backgroundColor: "#f8faf9",
                  }}
                >
                  {showStoreName(activeOrder.store) ? (
                    <Text style={{ color: theme.text, fontWeight: "900", fontSize: 16 }}>{activeOrder.store.name}</Text>
                  ) : null}
                  <Text
                    style={{
                      marginTop: showStoreName(activeOrder.store) ? 5 : 0,
                      color: theme.textMuted,
                      fontWeight: "700",
                    }}
                  >
                    Status: {orderStatusLabel(activeOrder.status)}
                  </Text>
                </View>

                <Text style={{ marginTop: 16, color: theme.text, fontWeight: "900", fontSize: 16 }}>Items</Text>
                <View style={{ marginTop: 8, gap: 8 }}>
                  {(activeOrder.items ?? []).map((line, idx) => {
                    const thumb = productThumbUri(line.product);
                    const lineKey = line.product.id ?? `${line.product.name}-${idx}`;
                    const lineTotal = line.quantity * line.price;
                    return (
                      <View
                        key={lineKey}
                        style={{
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: theme.border,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: 10,
                          backgroundColor: "#fff",
                        }}
                      >
                        <View
                          style={{
                            width: 84,
                            height: 76,
                            borderRadius: 14,
                            overflow: "hidden",
                            backgroundColor: "#f3f4f6",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {thumb ? (
                            <Image
                              source={{ uri: thumb }}
                              style={{ width: "100%", height: "100%" }}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                              recyclingKey={line.product.id ?? thumb}
                            />
                          ) : (
                            <MaterialCommunityIcons name="package-variant" size={36} color={theme.textMuted} />
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: theme.text, fontWeight: "800" }} numberOfLines={2}>
                            {line.quantity}× {line.product.name}
                          </Text>
                          <ProductPriceOfferRow
                            sellingPrice={line.price}
                            mrp={typeof line.product.mrp === "number" ? line.product.mrp : 0}
                            discountPercent={unitDiscountPercent(line.product.mrp, line.price)}
                            compact
                            layout="premiumGrid"
                            style={{ marginTop: 4 }}
                          />
                        </View>
                        <View style={{ alignItems: "flex-end", paddingTop: 2 }}>
                          <Text style={{ color: theme.text, fontWeight: "900", fontSize: 15 }}>{money(lineTotal)}</Text>
                          {line.quantity > 1 ? (
                            <Text style={{ marginTop: 4, fontSize: 11, fontWeight: "600", color: theme.textMuted }}>
                              ×{line.quantity}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                  {!activeOrder.items?.length ? (
                    <View
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: theme.border,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        backgroundColor: "#fff",
                      }}
                    >
                      <Text style={{ color: theme.textMuted, fontWeight: "600" }}>Items not available for this order.</Text>
                    </View>
                  ) : null}
                </View>

                <View
                  style={{
                    marginTop: 16,
                    borderTopWidth: 1,
                    borderTopColor: theme.border,
                    paddingTop: 12,
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: theme.textMuted, fontWeight: "700" }}>Items total</Text>
                    <Text style={{ color: theme.text, fontWeight: "800" }}>{money(modalItemsTotal)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: theme.textMuted, fontWeight: "700" }}>Payment mode</Text>
                    <Text style={{ color: theme.text, fontWeight: "800" }}>COD</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                    <Text style={{ color: theme.text, fontWeight: "900", fontSize: 16 }}>Grand total</Text>
                    <Text style={{ color: "#ea580c", fontWeight: "900", fontSize: 19 }}>{money(activeOrder.totalAmount)}</Text>
                  </View>
                </View>

                {canCustomerCancelOrder(activeOrder) ? (
                  <Text
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      fontWeight: "600",
                      color: theme.textMuted,
                      lineHeight: 17,
                    }}
                  >
                    Free cancellation: within 15 minutes of placing, only while status is still “placed” (store not
                    preparing yet). COD — nothing to refund.
                  </Text>
                ) : null}
                {customerCancelHint(activeOrder) ? (
                  <Text
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      fontWeight: "600",
                      color: theme.roseText,
                      lineHeight: 17,
                    }}
                  >
                    {customerCancelHint(activeOrder)}
                  </Text>
                ) : null}

                {canCustomerCancelOrder(activeOrder) ? (
                  <Pressable
                    disabled={cancelLoading}
                    onPress={() => void requestCancelOrder(activeOrder)}
                    style={{
                      marginTop: 14,
                      borderRadius: 14,
                      paddingVertical: 14,
                      borderWidth: 2,
                      borderColor: theme.roseBorder,
                      backgroundColor: theme.roseBg,
                      opacity: cancelLoading ? 0.7 : 1,
                    }}
                  >
                    {cancelLoading ? (
                      <ActivityIndicator color={theme.roseText} />
                    ) : (
                      <Text style={{ textAlign: "center", color: theme.roseText, fontWeight: "900", fontSize: 15 }}>
                        Cancel order
                      </Text>
                    )}
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => setActiveOrder(null)}
                  style={{
                    marginTop: 18,
                    backgroundColor: theme.primary,
                    borderRadius: 14,
                    paddingVertical: 14,
                  }}
                >
                  <Text style={{ textAlign: "center", color: "#fff", fontWeight: "900", fontSize: 15 }}>Close</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
