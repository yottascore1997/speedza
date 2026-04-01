import { useCallback, useState } from "react";
import { View, Text, FlatList, RefreshControl, Alert, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, getToken } from "@/lib/api";
import { theme } from "@/lib/theme";

type OrderRow = {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  store: { name: string };
};

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={{ paddingTop: 48, alignItems: "center" }}>
              <Text style={{ color: theme.textMuted, fontSize: 16, fontWeight: "600" }}>No orders yet</Text>
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
                <Text style={{ color: "#fff", fontWeight: "800" }}>Start shopping</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: theme.bgElevated,
              padding: 16,
              borderRadius: 14,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ fontWeight: "800", fontSize: 16, color: theme.text }}>{item.store.name}</Text>
            <Text style={{ color: theme.textMuted, marginTop: 6, fontWeight: "600" }}>
              {item.status} · ₹{item.totalAmount}
            </Text>
            <Text style={{ fontSize: 12, color: theme.textDim, marginTop: 6, fontWeight: "500" }}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
