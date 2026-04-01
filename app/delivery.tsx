import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api, getToken, getUser } from "@/lib/api";

type Row = {
  id: string;
  status: string;
  order: {
    id: string;
    totalAmount: number;
    store: { name: string; address: string };
    user: { phone: string };
  };
};

const nextMap: Record<string, string> = {
  ASSIGNED: "ACCEPTED",
  ACCEPTED: "PICKED_UP",
  PICKED_UP: "DELIVERED",
};

export default function DeliveryScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api<{ deliveries: Row[] }>("/api/delivery/mine");
    setLoading(false);
    if (res.ok && res.data) setRows(res.data.deliveries);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const token = await getToken();
        const u = await getUser();
        if (!token || u?.role !== "DELIVERY") {
          Alert.alert("Delivery only", "Login as delivery partner", [
            { text: "OK", onPress: () => router.replace("/login") },
          ]);
          return;
        }
        await load();
      })();
    }, [load, router]),
  );

  async function advance(item: Row) {
    const next = nextMap[item.status];
    if (!next) return;
    const res = await api("/api/delivery/update-status", {
      method: "POST",
      body: JSON.stringify({ deliveryId: item.id, status: next }),
    });
    if (!res.ok) Alert.alert("Error", res.error || "Failed");
    await load();
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={rows}
        keyExtractor={(r) => r.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={{ color: "#64748b" }}>No deliveries assigned</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: "#fff",
              padding: 14,
              borderRadius: 12,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: "#e2e8f0",
            }}
          >
            <Text style={{ fontWeight: "700" }}>{item.order.store.name}</Text>
            <Text style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
              {item.order.store.address}
            </Text>
            <Text style={{ marginTop: 6 }}>
              {item.order.user.phone} · ₹{item.order.totalAmount}
            </Text>
            <Text style={{ color: "#16a34a", marginTop: 4, fontSize: 12 }}>
              {item.status}
            </Text>
            {item.status !== "DELIVERED" && (
              <Pressable
                onPress={() => void advance(item)}
                style={{
                  marginTop: 10,
                  backgroundColor: "#0f172a",
                  padding: 10,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#fff", textAlign: "center", fontWeight: "600" }}>
                  {item.status === "ASSIGNED" && "Accept"}
                  {item.status === "ACCEPTED" && "Picked up"}
                  {item.status === "PICKED_UP" && "Delivered"}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}
