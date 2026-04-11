import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, getToken, getUser } from "@/lib/api";
import { theme } from "@/lib/theme";
import * as Linking from "expo-linking";

type Row = {
  id: string;
  status: string;
  order: {
    id: string;
    totalAmount: number;
    store: { name: string; address: string };
    user: { phone: string };
    deliveryAddress?: string;
    deliveryLat?: number;
    deliveryLng?: number;
    items?: { quantity: number; productName: string }[];
  };
};

type Earnings = {
  completedDeliveries: number;
  feePerOrder: number;
  estimatedEarnings: number;
};

const nextMap: Record<string, string> = {
  ASSIGNED: "ACCEPTED",
  ACCEPTED: "PICKED_UP",
  PICKED_UP: "DELIVERED",
};

const steps = ["ASSIGNED", "ACCEPTED", "PICKED_UP", "DELIVERED"] as const;

export default function DeliveryScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [earn, setEarn] = useState<Earnings | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [res, e] = await Promise.all([
      api<{ deliveries: Row[] }>("/api/delivery/mine"),
      api<Earnings>("/api/delivery/earnings"),
    ]);
    setLoading(false);
    if (res.ok && res.data) setRows(res.data.deliveries);
    if (e.ok && e.data) setEarn(e.data);
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

  const header = useMemo(() => {
    return (
      <View style={{ padding: 16, paddingBottom: 10 }}>
        <Text style={{ fontSize: 22, fontWeight: "900", color: theme.text, letterSpacing: -0.4 }}>
          Rider hub
        </Text>
        <Text style={{ marginTop: 4, color: theme.textMuted, fontWeight: "600" }}>
          Pickup · deliver · earn
        </Text>
        {earn ? (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: theme.accent,
                borderRadius: 16,
                padding: 14,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11, textTransform: "uppercase", opacity: 0.9 }}>
                Completed drops
              </Text>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 28, marginTop: 8 }}>
                {earn.completedDeliveries}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: theme.bgElevated,
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Text style={{ color: theme.textMuted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" }}>
                Fee / order
              </Text>
              <Text style={{ color: theme.text, fontWeight: "900", fontSize: 24, marginTop: 8 }}>
                ₹{earn.feePerOrder}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: theme.primarySoft,
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: "#a7f3d0",
              }}
            >
              <Text style={{ color: theme.primaryDark, fontWeight: "900", fontSize: 11, textTransform: "uppercase" }}>
                Est. earnings
              </Text>
              <Text style={{ color: theme.primaryDark, fontWeight: "900", fontSize: 24, marginTop: 8 }}>
                ₹{earn.estimatedEarnings}
              </Text>
            </View>
          </View>
        ) : null}
        <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 16, fontWeight: "900", color: theme.text }}>Your runs</Text>
          <Pressable
            onPress={() => void load()}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: theme.bgElevated,
              borderWidth: 1,
              borderColor: theme.border,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
            }}
          >
            <MaterialCommunityIcons name="refresh" size={18} color={theme.textMuted} />
            <Text style={{ color: theme.textMuted, fontWeight: "900" }}>Refresh</Text>
          </Pressable>
        </View>
      </View>
    );
  }, [earn, load]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        contentContainerStyle={{ paddingBottom: 20 }}
        ListHeaderComponent={header}
        data={rows}
        keyExtractor={(r) => r.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
              <View
                style={{
                  backgroundColor: theme.bgElevated,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 16,
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <MaterialCommunityIcons name="bike-fast" size={34} color={theme.textDim} />
                <Text style={{ marginTop: 10, color: theme.textMuted, fontWeight: "800" }}>
                  No assignments yet
                </Text>
                <Text style={{ marginTop: 4, color: theme.textDim, fontWeight: "600" }}>
                  Admin will assign READY orders to you
                </Text>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <View
              style={{
                backgroundColor: theme.bgElevated,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: theme.border,
                overflow: "hidden",
              }}
            >
              <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: "900", fontSize: 16 }}>
                      {item.order.store.name}
                    </Text>
                    <Text style={{ marginTop: 4, color: theme.textMuted, fontWeight: "600" }}>
                      {item.order.store.address}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: theme.primaryDark, fontWeight: "900", fontSize: 18 }}>
                      ₹{item.order.totalAmount}
                    </Text>
                    <Text style={{ color: theme.textDim, fontWeight: "800", fontSize: 11 }}>COD</Text>
                  </View>
                </View>

                <Text style={{ marginTop: 10, color: theme.text, fontWeight: "700" }}>
                  Customer · <Text style={{ color: theme.primaryDark, fontWeight: "900" }}>{item.order.user.phone}</Text>
                </Text>

                {item.order.deliveryAddress ? (
                  <View
                    style={{
                      marginTop: 10,
                      backgroundColor: theme.bg,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: 16,
                      padding: 12,
                    }}
                  >
                    <Text style={{ color: theme.textMuted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" }}>
                      Drop address
                    </Text>
                    <Text style={{ marginTop: 6, color: theme.text, fontWeight: "800" }}>
                      {item.order.deliveryAddress}
                    </Text>
                    {typeof item.order.deliveryLat === "number" && typeof item.order.deliveryLng === "number" ? (
                      <Pressable
                        onPress={() =>
                          Linking.openURL(
                            `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                              `${item.order.deliveryLat},${item.order.deliveryLng}`,
                            )}`,
                          )
                        }
                        style={{ marginTop: 8 }}
                      >
                        <Text style={{ color: theme.accent, fontWeight: "900", textDecorationLine: "underline" }}>
                          Open in Google Maps
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={{ padding: 14 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {steps.map((st) => {
                    const idx = steps.indexOf(item.status as any);
                    const i = steps.indexOf(st);
                    const done = i <= idx;
                    const current = i === idx;
                    const bg = done ? (current ? theme.accent : theme.primarySoft) : theme.slateLine;
                    const fg = done ? (current ? "#fff" : theme.primaryDark) : theme.textDim;
                    return (
                      <View
                        key={st}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: 999,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          backgroundColor: bg,
                        }}
                      >
                        <Text style={{ color: fg, fontWeight: "900", fontSize: 12 }}>
                          {done ? "✓" : "○"} {st.replace("_", " ")}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {item.order.items?.length ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ color: theme.textMuted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" }}>
                      Items
                    </Text>
                    <Text style={{ marginTop: 6, color: theme.textMuted, fontWeight: "700" }} numberOfLines={2}>
                      {item.order.items.slice(0, 6).map((x) => `${x.quantity}× ${x.productName}`).join(" · ")}
                      {item.order.items.length > 6 ? " · …" : ""}
                    </Text>
                  </View>
                ) : null}

                {item.status !== "DELIVERED" ? (
                  <Pressable
                    onPress={() => void advance(item)}
                    style={{
                      marginTop: 14,
                      backgroundColor: theme.text,
                      paddingVertical: 14,
                      borderRadius: 16,
                    }}
                  >
                    <Text style={{ color: "#fff", textAlign: "center", fontWeight: "900", fontSize: 15 }}>
                      {item.status === "ASSIGNED" && "Accept order"}
                      {item.status === "ACCEPTED" && "Picked up from store"}
                      {item.status === "PICKED_UP" && "Delivered to customer"}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={{ marginTop: 14, color: theme.primaryDark, fontWeight: "900", textAlign: "center" }}>
                    ✓ Completed — great job!
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}
