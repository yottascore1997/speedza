import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, getToken } from "@/lib/api";
import { clearCart, getCart, type CartLine } from "@/lib/cart";
import { theme } from "@/lib/theme";

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deliveryFeePerOrder, setDeliveryFeePerOrder] = useState(25);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLines(await getCart());
        const res = await api<{ deliveryFeePerOrder?: number }>("/api/shop/ordering-status");
        if (
          res.ok &&
          res.data &&
          typeof res.data.deliveryFeePerOrder === "number" &&
          Number.isFinite(res.data.deliveryFeePerOrder)
        ) {
          setDeliveryFeePerOrder(res.data.deliveryFeePerOrder);
        }
      })();
    }, []),
  );

  const itemsTotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const deliveryFee = lines.length > 0 ? deliveryFeePerOrder : 0;
  const total = itemsTotal + deliveryFee;
  const storeId = lines[0]?.storeId;

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
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
        data={lines}
        keyExtractor={(l) => l.productId}
        ListEmptyComponent={
          <View style={{ paddingTop: 48, alignItems: "center" }}>
            <Text style={{ color: theme.textMuted, fontSize: 16, fontWeight: "600" }}>Your cart is empty</Text>
            <Pressable
              onPress={() => router.push("/")}
              style={{
                marginTop: 16,
                backgroundColor: theme.primary,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>Browse shop</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: theme.bgElevated,
              padding: 14,
              borderRadius: 14,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ fontWeight: "800", fontSize: 15, color: theme.text }}>{item.name}</Text>
            <Text style={{ color: theme.textMuted, marginTop: 6, fontWeight: "600" }}>
              ₹{item.price} × {item.quantity}
            </Text>
          </View>
        )}
      />
      {lines.length > 0 && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.bgElevated,
            padding: 16,
            paddingBottom: 16 + insets.bottom,
            gap: 8,
          }}
        >
          <Text style={{ color: theme.textMuted, fontSize: 14, fontWeight: "600" }}>
            Items ₹{Math.round(itemsTotal * 100) / 100}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 14, fontWeight: "600" }}>
            Delivery ₹{deliveryFee}
          </Text>
          <Text style={{ fontSize: 20, fontWeight: "900", color: theme.text }}>
            Total ₹{Math.round(total * 100) / 100} · COD
          </Text>
          {submitting ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 8 }} />
          ) : (
            <Pressable
              onPress={() => void checkout()}
              style={{
                marginTop: 8,
                backgroundColor: theme.accent,
                paddingVertical: 16,
                borderRadius: 14,
              }}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800", fontSize: 16 }}>
                Place order
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
