import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { api, clearSession, getApiBase, getToken, getUser, type User } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/assets";
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
  const [listRequests, setListRequests] = useState<ListRequestRow[]>([]);
  const [listImageUri, setListImageUri] = useState<string | null>(null);
  const [listNote, setListNote] = useState("");
  const [sendingList, setSendingList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleErr, setRoleErr] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
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
        const [meRes, addrRes, listRes] = await Promise.all([
          api<{ user: { imageUrl: string | null } }>("/api/user/me"),
          api<{ address: AddressRow | null }>("/api/user/address"),
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
    walletTitle: { fontSize: 15, fontWeight: "700" as const, color: Z.ink, letterSpacing: -0.2 },
    balanceLead: { fontSize: 13, fontWeight: "500" as const, color: Z.muted },
    balanceAmt: { fontSize: 15, fontWeight: "700" as const, color: Z.ink },
    btnOutline: { fontSize: 13, fontWeight: "700" as const, color: Z.brand },
  };

  const quickCard = (opts: {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    label: string;
    onPress: () => void;
    tone: "brand" | "slate";
  }) => {
    const bg = opts.tone === "brand" ? Z.brandSoft : "#f8fafc";
    const border = opts.tone === "brand" ? "#dbeafe" : Z.line;
    const iconC = opts.tone === "brand" ? Z.brand : Z.inkSoft;
    return (
      <Pressable
        key={opts.label}
        onPress={opts.onPress}
        android_ripple={{ color: "rgba(37,99,235,0.12)" }}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 100,
          backgroundColor: bg,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: border,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
          paddingHorizontal: 6,
          opacity: pressed ? 0.92 : 1,
          ...cardLift,
        })}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: opts.tone === "brand" ? "rgba(37,99,235,0.12)" : "rgba(15,23,42,0.06)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons name={opts.icon} size={24} color={iconC} />
        </View>
        <Text style={type.quickLabel} numberOfLines={2}>
          {opts.label}
        </Text>
      </Pressable>
    );
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

        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          {quickCard({
            icon: "shopping-outline",
            label: "Your Orders",
            onPress: () => router.push("/orders"),
            tone: "brand",
          })}
          {quickCard({
            icon: "message-text-outline",
            label: "Help & Support",
            onPress: () => router.push("/help"),
            tone: "slate",
          })}
        </View>

        <View
          style={{
            marginTop: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: Z.walletBorder,
            overflow: "hidden",
            ...cardLift,
          }}
        >
          <LinearGradient colors={[Z.walletFrom, Z.walletTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <Pressable
              onPress={() => Alert.alert("Speedza Cash", "Wallet and gift cards coming soon.")}
              android_ripple={{ color: "rgba(37,99,235,0.08)" }}
              style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: "rgba(37,99,235,0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons name="wallet-outline" size={22} color={Z.brand} />
                </View>
                <Text style={[type.walletTitle, { flex: 1 }]}>Speedza Cash & Gift Card</Text>
                <View style={{ backgroundColor: Z.newGreen, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>NEW</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#cbd5e1" />
              </View>
            </Pressable>
            <View style={{ marginTop: 12, marginBottom: 12, height: StyleSheet.hairlineWidth, backgroundColor: Z.walletRule }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <View>
                <Text style={type.balanceLead}>Available balance</Text>
                <Text style={[type.balanceAmt, { marginTop: 2 }]}>₹0</Text>
              </View>
              <Pressable
                onPress={() => Alert.alert("Add balance", "Coming soon.")}
                android_ripple={{ color: "rgba(37,99,235,0.12)" }}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Z.brand,
                  backgroundColor: "rgba(255,255,255,0.9)",
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                <Text style={type.btnOutline}>Add balance</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>

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
            icon: "cash-refund",
            title: "Your Refunds",
            onPress: () => router.push("/orders"),
          })}
          {infoRow({
            icon: "credit-card-outline",
            title: "E-Gift Cards",
            onPress: () => Alert.alert("E-Gift Cards", "Coming soon."),
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
          })}
          {infoRow({
            icon: "account-circle-outline",
            title: "Profile",
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

        <View
          style={{
            backgroundColor: Z.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: Z.line,
            padding: 14,
            marginBottom: 4,
            ...cardLift,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: Z.ink, letterSpacing: -0.2 }}>Upload grocery list photo</Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: Z.muted, fontWeight: "500", lineHeight: 18 }}>
            Send one photo of your written list. Admin will process and deliver.
          </Text>
          <View style={{ marginTop: 12, flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Pressable
              onPress={() => void pickListImage()}
              style={{
                borderWidth: 1,
                borderColor: Z.line,
                backgroundColor: "#f8fafc",
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <MaterialCommunityIcons name="image-plus" size={18} color={Z.inkSoft} />
              <Text style={{ color: Z.inkSoft, fontWeight: "600", fontSize: 13 }}>{listImageUri ? "Change photo" : "Pick photo"}</Text>
            </Pressable>
            <Pressable
              disabled={sendingList || !listImageUri}
              onPress={() => void submitListRequest()}
              style={{
                borderWidth: 1,
                borderColor: Z.brand,
                backgroundColor: Z.brand,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
                opacity: sendingList || !listImageUri ? 0.45 : 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <MaterialCommunityIcons name="send" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{sendingList ? "Sending..." : "Send to admin"}</Text>
            </Pressable>
          </View>
          {listImageUri ? (
            <View
              style={{
                marginTop: 8,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: Z.line,
                borderRadius: 8,
                overflow: "hidden",
                backgroundColor: "#fff",
              }}
            >
              <Image source={{ uri: listImageUri }} style={{ width: "100%", height: 120 }} contentFit="cover" />
            </View>
          ) : null}
          <TextInput
            value={listNote}
            onChangeText={setListNote}
            placeholder="Optional note for admin"
            placeholderTextColor={Z.muted2}
            multiline
            style={{
              marginTop: 8,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: Z.line,
              backgroundColor: "#fafafa",
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
              color: Z.ink,
              minHeight: 40,
              fontSize: 13,
              textAlignVertical: "top",
            }}
          />
          {listRequests.length > 0 ? (
            <View style={{ marginTop: 10, gap: 6 }}>
              <Text style={{ fontSize: 11, color: Z.muted2, fontWeight: "600", letterSpacing: 0.3 }}>LIST REQUEST STATUS</Text>
              {listRequests.slice(0, 4).map((r) => (
                <View
                  key={r.id}
                  style={{
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: Z.line,
                    backgroundColor: "#fafafa",
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: Z.ink, fontWeight: "600", fontSize: 12 }}>#{r.id.slice(0, 8)}</Text>
                    <Text style={{ color: Z.brand, fontWeight: "600", fontSize: 11 }}>{r.status.replace(/_/g, " ")}</Text>
                  </View>
                  <Text style={{ marginTop: 4, color: Z.muted, fontSize: 11, fontWeight: "400" }}>
                    {new Date(r.createdAt).toLocaleString()}
                  </Text>
                  {r.adminNote ? (
                    <Text style={{ marginTop: 3, color: Z.ink, fontSize: 11, fontWeight: "500" }}>Admin: {r.adminNote}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>

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
