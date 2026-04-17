import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, Alert, ScrollView, ActivityIndicator, TextInput } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { api, clearSession, getApiBase, getToken, getUser, type User } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/assets";
import { theme } from "@/lib/theme";
import { CommonShopHeader } from "@/components/CommonShopHeader";

type OrderRow = {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  store: { name: string; shopVertical?: string | null };
  items?: { quantity: number; price: number; product: { name: string } }[];
};

/** Profile order cards: show store line only for food shops (same as Orders tab). */
function showStoreName(store: { shopVertical?: string | null } | undefined): boolean {
  const v = (store?.shopVertical ?? "").toLowerCase().trim();
  return v === "food" || v.startsWith("food-");
}

type AddressRow = {
  label?: string | null;
  address: string;
};
type ListRequestRow = {
  id: string;
  imageUrl: string;
  note: string;
  address: string;
  status: string;
  adminNote?: string;
  createdAt: string;
};

const ALLOWED_ROLES = new Set(["CUSTOMER", "STORE_OWNER", "DELIVERY", "ADMIN"]);

const cardElevated = {
  backgroundColor: theme.bgElevated,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: theme.border,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 4,
} as const;

function statusPillColors(status: string): { bg: string; text: string } {
  const s = status.toUpperCase();
  if (s.includes("DELIVERED") || s.includes("COMPLETED")) return { bg: "#dcfce7", text: "#166534" };
  if (s.includes("CANCEL")) return { bg: "#fee2e2", text: "#991b1b" };
  if (s.includes("OUT") || s.includes("PICK") || s.includes("DISPATCH")) return { bg: "#dbeafe", text: "#1e40af" };
  if (s.includes("PENDING") || s.includes("PLACED") || s.includes("CONFIRM")) return { bg: "#fef3c7", text: "#92400e" };
  return { bg: "#f3f4f6", text: "#374151" };
}

function isOrderToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function initialsFromName(name: string) {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [address, setAddress] = useState<AddressRow | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [listRequests, setListRequests] = useState<ListRequestRow[]>([]);
  const [listImageUri, setListImageUri] = useState<string | null>(null);
  const [listNote, setListNote] = useState("");
  const [sendingList, setSendingList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleErr, setRoleErr] = useState(false);
  const [ordersErr, setOrdersErr] = useState<string | null>(null);

  const { todayOrders, pastOrders } = useMemo(() => {
    const today: OrderRow[] = [];
    const past: OrderRow[] = [];
    for (const o of orders) {
      if (isOrderToday(o.createdAt)) today.push(o);
      else past.push(o);
    }
    return { todayOrders: today, pastOrders: past };
  }, [orders]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        setOrdersErr(null);
        const token = await getToken();
        const localUser = await getUser();
        if (!token || !localUser) {
          setUser(null);
          setRoleErr(false);
          setLoading(false);
          return;
        }

        if (!ALLOWED_ROLES.has(localUser.role)) {
          setUser(localUser);
          setRoleErr(true);
          setLoading(false);
          return;
        }

        setRoleErr(false);
        setUser(localUser);
        const [meRes, addrRes, ordRes, listRes] = await Promise.all([
          api<{ user: { imageUrl: string | null } }>("/api/user/me"),
          api<{ address: AddressRow | null }>("/api/user/address"),
          api<{ orders: OrderRow[] }>("/api/orders/user?limit=40"),
          api<{ requests: ListRequestRow[] }>("/api/list-requests?limit=15"),
        ]);
        if (meRes.ok && meRes.data?.user) {
          setImageUrl(resolveMediaUrl(meRes.data.user.imageUrl ?? undefined) ?? null);
        } else {
          setImageUrl(null);
        }
        if (addrRes.ok && addrRes.data?.address) {
          setAddress(addrRes.data.address);
        } else {
          setAddress(null);
        }
        if (ordRes.ok && ordRes.data?.orders) {
          setOrders(ordRes.data.orders);
        } else {
          setOrders([]);
          setOrdersErr(ordRes.error || "Could not load orders");
        }
        if (listRes.ok && listRes.data?.requests) setListRequests(listRes.data.requests);
        else setListRequests([]);
        setLoading(false);
      })();
    }, []),
  );

  async function logout() {
    await clearSession();
    setUser(null);
  }
  async function pickListImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow gallery access to upload list photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setListImageUri(result.assets[0].uri);
    }
  }
  async function submitListRequest() {
    if (!listImageUri) {
      Alert.alert("Photo required", "Please pick a list photo first.");
      return;
    }
    const token = await getToken();
    if (!token) {
      Alert.alert("Sign in required", "Please login again.");
      return;
    }
    setSendingList(true);
    try {
      const fd = new FormData();
      const ext = listImageUri.split(".").pop()?.toLowerCase() || "jpg";
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      fd.append("file", { uri: listImageUri, name: `list.${ext}`, type: mime } as any);
      const up = await fetch(`${getApiBase()}/api/list-requests/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd as any,
      });
      const upJson = (await up.json().catch(() => null)) as { imageUrl?: string; error?: string } | null;
      if (!up.ok || !upJson?.imageUrl) {
        Alert.alert("Upload failed", upJson?.error || "Could not upload list image");
        return;
      }
      const createRes = await api<{ request: ListRequestRow }>("/api/list-requests", {
        method: "POST",
        body: JSON.stringify({
          imageUrl: upJson.imageUrl,
          note: listNote.trim(),
          address: address?.address ?? "",
        }),
      });
      if (!createRes.ok) {
        Alert.alert("Request failed", createRes.error || "Could not create list request");
        return;
      }
      setListImageUri(null);
      setListNote("");
      const mine = await api<{ requests: ListRequestRow[] }>("/api/list-requests?limit=15");
      if (mine.ok && mine.data?.requests) setListRequests(mine.data.requests);
      Alert.alert("Submitted", "Admin received your grocery list. You can track status below.");
    } finally {
      setSendingList(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.screenBg }}>
        <CommonShopHeader safeTop={insets.top} activeKey="__shop__" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.screenBg }}>
        <CommonShopHeader safeTop={insets.top} activeKey="__shop__" />
        <View style={{ padding: 16, flex: 1 }}>
        <Text style={{ color: theme.text, fontWeight: "900", fontSize: 18 }}>Sign in to open profile</Text>
        <Text style={{ marginTop: 6, color: theme.textMuted, fontWeight: "600" }}>
          Your photo, address and orders are tied to your account.
        </Text>
        <Pressable
          onPress={() => router.push("/login")}
          style={{ marginTop: 16, backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 14 }}
        >
          <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800" }}>Sign in</Text>
        </Pressable>
        </View>
      </View>
    );
  }

  if (roleErr) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.screenBg }}>
        <CommonShopHeader safeTop={insets.top} activeKey="__shop__" />
        <View style={{ padding: 16, flex: 1 }}>
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#fcd34d",
            backgroundColor: "#fffbeb",
            padding: 16,
          }}
        >
          <Text style={{ color: "#78350f", fontWeight: "800" }}>Customer account required for this page.</Text>
          <Pressable
            onPress={() => router.push("/login")}
            style={{ marginTop: 12, backgroundColor: theme.primary, paddingVertical: 12, borderRadius: 10 }}
          >
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800" }}>Customer login</Text>
          </Pressable>
        </View>
        </View>
      </View>
    );
  }

  const displayName = user.name || "Customer";
  const initials = initialsFromName(displayName);

  return (
    <View style={{ flex: 1, backgroundColor: theme.screenBg }}>
      <CommonShopHeader safeTop={insets.top} activeKey="__shop__" />
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
    >
      <View
        style={{
          ...cardElevated,
          padding: 18,
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              overflow: "hidden",
              backgroundColor: "#fde68a",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: "#fff",
            }}
          >
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <Text style={{ fontSize: 26, fontWeight: "900", color: "#78350f" }}>{initials}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "900", color: theme.text }}>{displayName}</Text>
            <Text style={{ fontSize: 14, color: theme.textMuted, marginTop: 4, fontWeight: "600" }}>{user.phone}</Text>
            <Pressable
              onPress={() => router.push("/profile")}
              style={{
                marginTop: 10,
                alignSelf: "flex-start",
                borderWidth: 1,
                borderColor: "#fdba74",
                backgroundColor: "#fff7ed",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: "#9a3412", fontWeight: "800", fontSize: 12 }}>Change photo</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 14 }}>
          <Text style={{ fontSize: 11, fontWeight: "900", color: theme.textDim, letterSpacing: 0.6 }}>
            DELIVERY ADDRESS
          </Text>
          {address ? (
            <Text style={{ color: theme.text, fontWeight: "700", marginTop: 6 }}>
              <Text style={{ color: theme.textMuted }}>{address.label || "Home"}: </Text>
              {address.address}
            </Text>
          ) : (
            <Text style={{ color: theme.textMuted, fontWeight: "600", marginTop: 6 }}>No address saved yet.</Text>
          )}
          <Pressable
            onPress={() => router.push("/profile")}
            style={{
              marginTop: 10,
              alignSelf: "flex-start",
              borderWidth: 1,
              borderColor: "#fdba74",
              backgroundColor: "#fff7ed",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: "#9a3412", fontWeight: "800", fontSize: 12 }}>{address ? "Change" : "Add"}</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pressable
            onPress={() => router.push("/help")}
            style={{ borderWidth: 1, borderColor: "#a7f3d0", backgroundColor: "#ecfdf5", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
          >
            <Text style={{ color: "#065f46", fontWeight: "900", fontSize: 12 }}>Help & support</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/orders")}
            style={{ borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bgElevated, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
          >
            <Text style={{ color: theme.text, fontWeight: "900", fontSize: 12 }}>All orders</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert("Sign out?", "You will need to sign in again.", [
                { text: "Cancel", style: "cancel" },
                { text: "Sign out", style: "destructive", onPress: () => void logout() },
              ])
            }
            style={{ borderWidth: 1, borderColor: "#fecdd3", backgroundColor: "#fff1f2", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
          >
            <Text style={{ color: "#9f1239", fontWeight: "900", fontSize: 12 }}>Log out</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ ...cardElevated, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontSize: 17, fontWeight: "900", color: theme.text }}>Upload grocery list photo</Text>
        <Text style={{ marginTop: 4, color: theme.textMuted, fontWeight: "600" }}>
          Send one photo of your written list. Admin will process and deliver.
        </Text>
        <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => void pickListImage()}
            style={{ borderWidth: 1, borderColor: "#86efac", backgroundColor: "#ecfdf5", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <MaterialCommunityIcons name="image-plus" size={16} color="#166534" />
            <Text style={{ color: "#166534", fontWeight: "900", fontSize: 12 }}>{listImageUri ? "Change photo" : "Pick photo"}</Text>
          </Pressable>
          <Pressable
            disabled={sendingList || !listImageUri}
            onPress={() => void submitListRequest()}
            style={{ borderWidth: 1, borderColor: "#16a34a", backgroundColor: "#16a34a", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, opacity: sendingList || !listImageUri ? 0.55 : 1, flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <MaterialCommunityIcons name="send" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>{sendingList ? "Sending..." : "Send to admin"}</Text>
          </Pressable>
        </View>
        {listImageUri ? (
          <View style={{ marginTop: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 12, overflow: "hidden", backgroundColor: "#fff" }}>
            <Image source={{ uri: listImageUri }} style={{ width: "100%", height: 160 }} contentFit="cover" />
          </View>
        ) : null}
        <TextInput
          value={listNote}
          onChangeText={setListNote}
          placeholder="Optional note for admin (e.g. 2kg sugar, good quality)"
          placeholderTextColor={theme.textDim}
          multiline
          style={{ marginTop: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bgElevated, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, color: theme.text, minHeight: 44, textAlignVertical: "top" }}
        />
        {listRequests.length > 0 ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Text style={{ fontSize: 13, color: theme.textDim, fontWeight: "900", letterSpacing: 0.4 }}>
              LIST REQUEST STATUS
            </Text>
            {listRequests.slice(0, 4).map((r) => (
              <View key={r.id} style={{ borderWidth: 1, borderColor: theme.border, backgroundColor: "#f8fafc", borderRadius: 12, padding: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: theme.text, fontWeight: "800", fontSize: 12 }}>#{r.id.slice(0, 8)}</Text>
                  <Text style={{ color: "#166534", fontWeight: "900", fontSize: 11 }}>{r.status.replace(/_/g, " ")}</Text>
                </View>
                <Text style={{ marginTop: 5, color: theme.textMuted, fontSize: 11, fontWeight: "600" }}>
                  {new Date(r.createdAt).toLocaleString()}
                </Text>
                {r.adminNote ? (
                  <Text style={{ marginTop: 4, color: theme.text, fontSize: 11, fontWeight: "700" }}>
                    Admin: {r.adminNote}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {ordersErr ? (
        <View style={{ marginBottom: 12, borderWidth: 1, borderColor: theme.roseBorder, backgroundColor: theme.roseBg, padding: 12, borderRadius: 12 }}>
          <Text style={{ color: theme.roseText, fontWeight: "600" }}>{ordersErr}</Text>
        </View>
      ) : null}

      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: theme.text }}>Today&apos;s orders</Text>
        <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2, fontWeight: "600" }}>
          Placed today in your timezone
        </Text>
        {todayOrders.length === 0 ? (
          <View style={{ marginTop: 10, borderWidth: 1, borderColor: theme.border, borderStyle: "dashed", borderRadius: 18, padding: 22, backgroundColor: theme.bgElevated }}>
            <Text style={{ color: theme.textMuted, textAlign: "center", fontWeight: "600" }}>No orders today</Text>
          </View>
        ) : (
          <View style={{ marginTop: 10, gap: 10 }}>
            {todayOrders.map((o) => (
              <View key={o.id} style={{ ...cardElevated, overflow: "hidden", padding: 0 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#f8faf9", borderBottomWidth: 1, borderBottomColor: theme.border }}>
                  <Text style={{ fontSize: 11, color: theme.textMuted, fontWeight: "700" }}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: statusPillColors(o.status).bg,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: statusPillColors(o.status).text, fontWeight: "800", textTransform: "capitalize" }}>
                      {o.status.replace(/_/g, " ").toLowerCase()}
                    </Text>
                  </View>
                </View>
                <View style={{ padding: 12 }}>
                  {showStoreName(o.store) ? (
                    <Text style={{ fontSize: 16, fontWeight: "900", color: theme.text }}>{o.store.name}</Text>
                  ) : null}
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.textMuted,
                      marginTop: showStoreName(o.store) ? 3 : 0,
                      fontWeight: "600",
                    }}
                  >
                    {new Date(o.createdAt).toLocaleString()}
                  </Text>
                  {o.items?.length ? (
                    <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 8, gap: 4 }}>
                      {o.items.slice(0, 3).map((i, idx) => (
                        <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ flex: 1, fontSize: 12, color: theme.textMuted, fontWeight: "600" }} numberOfLines={1}>
                            {i.quantity}x {i.product.name}
                          </Text>
                          <Text style={{ fontSize: 12, color: theme.textMuted, fontWeight: "700" }}>
                            ₹{Math.round(i.price * i.quantity * 100) / 100}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12, color: theme.textMuted, fontWeight: "700" }}>Total (COD)</Text>
                    <Text style={{ fontSize: 17, color: "#1d4ed8", fontWeight: "900" }}>₹{o.totalAmount}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View>
        <Text style={{ fontSize: 18, fontWeight: "900", color: theme.text }}>Past orders</Text>
        <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2, fontWeight: "600" }}>Earlier deliveries</Text>
        {pastOrders.length === 0 ? (
          <View style={{ marginTop: 10, borderWidth: 1, borderColor: theme.border, borderStyle: "dashed", borderRadius: 18, padding: 22, backgroundColor: theme.bgElevated }}>
            <Text style={{ color: theme.textMuted, textAlign: "center", fontWeight: "600" }}>No past orders yet</Text>
          </View>
        ) : (
          <View style={{ marginTop: 10, gap: 10 }}>
            {pastOrders.map((o) => (
              <View key={o.id} style={{ ...cardElevated, padding: 14 }}>
                {showStoreName(o.store) ? (
                  <Text style={{ fontWeight: "800", fontSize: 16, color: theme.text }}>{o.store.name}</Text>
                ) : null}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: showStoreName(o.store) ? 8 : 0,
                  }}
                >
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: statusPillColors(o.status).bg }}>
                    <Text style={{ fontSize: 11, color: statusPillColors(o.status).text, fontWeight: "800", textTransform: "capitalize" }}>
                      {o.status.replace(/_/g, " ").toLowerCase()}
                    </Text>
                  </View>
                  <Text style={{ color: theme.text, fontWeight: "900" }}>₹{o.totalAmount}</Text>
                </View>
                <Text style={{ fontSize: 12, color: theme.textDim, marginTop: 5, fontWeight: "500" }}>
                  {new Date(o.createdAt).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {user?.role === "DELIVERY" ? (
        <Pressable
          onPress={() => router.push("/delivery")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            ...cardElevated,
            padding: 16,
            marginTop: 8,
          }}
        >
          <MaterialCommunityIcons name="bike-fast" size={24} color={theme.primary} />
          <Text style={{ fontWeight: "800", color: theme.text, fontSize: 16 }}>Delivery dashboard</Text>
        </Pressable>
      ) : null}
    </ScrollView>
    </View>
  );
}
