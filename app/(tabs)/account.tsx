import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { api, clearSession, getToken, getUser, type User } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/assets";
import { QuickGroceryOrderSection, type QuickGroceryListRequest } from "@/components/QuickGroceryOrderSection";
type AddressRow = {
  label?: string | null;
  address: string;
};
const ALLOWED_ROLES = new Set(["CUSTOMER", "STORE_OWNER", "DELIVERY", "ADMIN"]);

/** Profile — calm slate + Speedza brand blue (theme) */
const Z = {
  canvas: "#f1f5f9",
  ink: "#0f172a",
  inkSoft: "#334155",
  muted: "#64748b",
  muted2: "#94a3b8",
  line: "#e2e8f0",
  rowRule: "#f1f5f9",
  card: "#ffffff",
  brand: "#2563eb",
  brandSoft: "#eff6ff",
  walletFrom: "#eff6ff",
  walletTo: "#ffffff",
  walletBorder: "#bfdbfe",
  walletRule: "#e0f2fe",
  avatarBg: "#dbeafe",
  avatarIcon: "#1d4ed8",
  newGreen: "#059669",
  slateIconBg: "#f1f5f9",
} as const;

const cardLift =
  Platform.OS === "ios"
    ? {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      }
    : { elevation: 2 };

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [address, setAddress] = useState<AddressRow | null>(null);
  const [listRequests, setListRequests] = useState<QuickGroceryListRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleErr, setRoleErr] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          const token = await getToken();
          const localUser = await getUser();
          if (!token || !localUser) {
            setUser(null);
            setRoleErr(false);
            return;
          }

          if (!ALLOWED_ROLES.has(localUser.role)) {
            setUser(localUser);
            setRoleErr(true);
            return;
          }

          setRoleErr(false);
          setUser(localUser);
          const [meRes, addrRes, listRes] = await Promise.all([
            api<{ user: { imageUrl: string | null } }>("/api/user/me"),
            api<{ address: AddressRow | null }>("/api/user/address"),
            api<{ requests: QuickGroceryListRequest[] }>("/api/list-requests?limit=15"),
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
          if (listRes.ok && listRes.data?.requests) setListRequests(listRes.data.requests);
          else setListRequests([]);
        } finally {
          setLoading(false);
        }
      })();
    }, []),
  );

  async function logout() {
    await clearSession();
    setUser(null);
  }
  const profileCanvas = Z.canvas;
  const backBtnLift =
    Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 }
      : { elevation: 3 };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: profileCanvas, paddingTop: insets.top }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Z.brand} />
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: profileCanvas }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: insets.top + 8,
            paddingBottom: 12,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
              ...backBtnLift,
            }}
          >
            <MaterialCommunityIcons name="chevron-left" size={26} color="#111827" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: 16, flex: 1 }}>
          <Text style={{ color: "#111827", fontWeight: "900", fontSize: 18 }}>Sign in to open profile</Text>
          <Text style={{ marginTop: 6, color: "#6b7280", fontWeight: "600" }}>
            Your photo, address and orders are tied to your account.
          </Text>
          <Pressable
            onPress={() => router.push("/login")}
            style={{ marginTop: 16, backgroundColor: Z.brand, paddingVertical: 14, borderRadius: 14 }}
          >
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800" }}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (roleErr) {
    return (
      <View style={{ flex: 1, backgroundColor: profileCanvas }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: insets.top + 8,
            paddingBottom: 12,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
              ...backBtnLift,
            }}
          >
            <MaterialCommunityIcons name="chevron-left" size={26} color="#111827" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
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
              style={{ marginTop: 12, backgroundColor: Z.brand, paddingVertical: 12, borderRadius: 10 }}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800" }}>Customer login</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const displayName = user.name || "Customer";

  const type = {
    headerTitle: { fontSize: 17, fontWeight: "700" as const, color: Z.ink, letterSpacing: -0.3 },
    name: { fontSize: 20, fontWeight: "700" as const, color: Z.ink, letterSpacing: -0.4 },
    phone: { fontSize: 14, fontWeight: "500" as const, color: Z.muted, marginTop: 4 },
    section: { fontSize: 12, fontWeight: "700" as const, color: Z.muted, letterSpacing: 0.6 },
    listTitle: { fontSize: 15, fontWeight: "600" as const, color: Z.ink },
    listSub: { fontSize: 13, fontWeight: "500" as const, color: Z.muted, marginTop: 2 },
    quickLabel: { fontSize: 12, fontWeight: "600" as const, color: Z.inkSoft, textAlign: "center" as const, marginTop: 10, lineHeight: 15 },
  };

  const infoRow = (opts: {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    subtitle?: string;
    onPress: () => void;
    isLast?: boolean;
  }) => (
    <Pressable
      key={opts.title}
      onPress={opts.onPress}
      android_ripple={{ color: "rgba(15,23,42,0.04)" }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 13,
        paddingHorizontal: 14,
        borderBottomWidth: opts.isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: Z.rowRule,
        backgroundColor: pressed ? "#f8fafc" : "transparent",
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: Z.slateIconBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name={opts.icon} size={20} color={Z.inkSoft} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={type.listTitle}>{opts.title}</Text>
        {opts.subtitle ? <Text style={type.listSub}>{opts.subtitle}</Text> : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#cbd5e1" />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: profileCanvas }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingTop: insets.top + 6,
          paddingBottom: 10,
        }}
      >
        <View style={{ width: 44, alignItems: "flex-start" }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: Z.card,
              alignItems: "center",
              justifyContent: "center",
              ...backBtnLift,
            }}
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color={Z.ink} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={type.headerTitle}>Profile</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 + insets.bottom }}
      >
        <LinearGradient
          colors={["#ffffff", "#f8fafc"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: Z.line,
            paddingVertical: 18,
            paddingHorizontal: 16,
            flexDirection: "row",
            alignItems: "center",
            overflow: "hidden",
            ...cardLift,
          }}
        >
          <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: Z.brand }} />
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              borderWidth: 3,
              borderColor: "#bfdbfe",
              overflow: "hidden",
              backgroundColor: Z.avatarBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <MaterialCommunityIcons name="account" size={32} color={Z.avatarIcon} />
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 14, minWidth: 0 }}>
            <Text style={type.name} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={type.phone}>{user.phone}</Text>
          </View>
        </LinearGradient>

        <Text style={[type.section, { marginTop: 22, marginBottom: 10 }]}>YOUR INFORMATION</Text>
        <View
          style={{
            backgroundColor: Z.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: Z.line,
            overflow: "hidden",
            ...cardLift,
          }}
        >
          {infoRow({
            icon: "shopping-outline",
            title: "Your Orders",
            onPress: () => router.push("/orders"),
          })}
          {infoRow({
            icon: "cash-refund",
            title: "Your Refunds",
            onPress: () => router.push("/orders"),
          })}
          {infoRow({
            icon: "message-text-outline",
            title: "Help & Support",
            onPress: () => router.push("/help"),
          })}
          {infoRow({
            icon: "map-marker-outline",
            title: "Saved Addresses",
            subtitle: address ? "1 address" : "Tap to add",
            onPress: () => router.push("/profile"),
            isLast: true,
          })}
        </View>

        <Pressable
          onPress={() =>
            Alert.alert("Sign out?", "You will need to sign in again.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => void logout() },
            ])
          }
          android_ripple={{ color: "rgba(220,38,38,0.08)" }}
          style={({ pressed }) => ({
            marginTop: 14,
            backgroundColor: "#fff",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#fecaca",
            paddingVertical: 14,
            alignItems: "center",
            opacity: pressed ? 0.92 : 1,
            ...cardLift,
          })}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#dc2626", letterSpacing: 0.2 }}>Sign out</Text>
        </Pressable>

        <Text style={[type.section, { marginTop: 22, marginBottom: 10 }]}>MORE FROM SPEEDZA</Text>

        <QuickGroceryOrderSection
          variant="profile"
          listRequests={listRequests}
          onRequestsUpdated={setListRequests}
        />

        {user?.role === "DELIVERY" ? (
          <Pressable
            onPress={() => router.push("/delivery")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: Z.card,
              borderRadius: 12,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: Z.line,
              paddingVertical: 12,
              paddingHorizontal: 14,
              marginTop: 10,
              ...cardLift,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: Z.slateIconBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name="bike-fast" size={20} color={Z.brand} />
            </View>
            <Text style={{ flex: 1, fontWeight: "600", color: Z.ink, fontSize: 15 }}>Delivery dashboard</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#cbd5e1" />
          </Pressable>
        ) : null}
    </ScrollView>
    </View>
  );
}
