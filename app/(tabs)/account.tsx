import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import { premiumAlert } from "@/lib/premiumAlert";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { api, clearSession, getToken, getUser, type User } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/assets";
import { theme } from "@/lib/theme";
import { QuickGroceryOrderSection, type QuickGroceryListRequest } from "@/components/QuickGroceryOrderSection";
import { rms, rs } from "@/lib/responsive";
import { getHomeShopHeaderColors } from "@/lib/shopHeaderTheme";

const homeHeader = getHomeShopHeaderColors();
const headerGradient = [...homeHeader.headerGradient] as [string, string, string];
const headerInk = homeHeader.logoText;
const headerInkSoft = homeHeader.chipInactive;

type AddressRow = {
  label?: string | null;
  address: string;
};

const ALLOWED_ROLES = new Set(["CUSTOMER", "STORE_OWNER", "DELIVERY", "ADMIN"]);

const cardLift = Platform.select({
  ios: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 4 },
  default: {},
});

function ProfileMenuRow(props: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
  iconColors: readonly [string, string];
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: rs(14),
        paddingHorizontal: rs(14),
        borderBottomWidth: props.isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: "#f1f5f9",
        backgroundColor: pressed ? "#f8fafc" : "transparent",
      })}
    >
      <LinearGradient
        colors={props.iconColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: rs(42),
          height: rs(42),
          borderRadius: rs(13),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name={props.icon} size={22} color="#fff" />
      </LinearGradient>
      <View style={{ flex: 1, marginLeft: rs(12), paddingRight: rs(8) }}>
        <Text style={{ fontSize: rms(15), fontWeight: "800", color: "#0f172a", letterSpacing: -0.2 }}>
          {props.title}
        </Text>
        {props.subtitle ? (
          <Text style={{ marginTop: 2, fontSize: rms(12), fontWeight: "600", color: "#64748b" }} numberOfLines={1}>
            {props.subtitle}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          width: rs(28),
          height: rs(28),
          borderRadius: rs(9),
          backgroundColor: "#f1f5f9",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name="chevron-right" size={18} color="#94a3b8" />
      </View>
    </Pressable>
  );
}

function QuickAction(props: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        paddingVertical: rs(12),
        borderRadius: rs(14),
        backgroundColor: pressed ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.58)",
        borderWidth: 1,
        borderColor: "rgba(138,59,29,0.14)",
      })}
    >
      <MaterialCommunityIcons name={props.icon} size={22} color={headerInk} />
      <Text style={{ marginTop: rs(6), fontSize: rms(11), fontWeight: "800", color: headerInk, textAlign: "center" }}>
        {props.label}
      </Text>
    </Pressable>
  );
}

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
    router.replace("/login");
  }

  const canvas = "#f4f7fb";

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: canvas, paddingTop: insets.top }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={theme.brandNavOrange} />
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: canvas }}>
        <LinearGradient
          colors={headerGradient}
          locations={[0, 0.42, 1]}
          style={{ paddingTop: insets.top + rs(20), paddingBottom: rs(28), paddingHorizontal: rs(22) }}
        >
          <Text style={{ color: headerInk, fontSize: rms(26), fontWeight: "900", letterSpacing: -0.5 }}>Profile</Text>
          <Text style={{ color: headerInkSoft, marginTop: rs(8), fontSize: rms(14), fontWeight: "600", lineHeight: rms(20) }}>
            Sign in to manage orders, address and your Speedza account.
          </Text>
        </LinearGradient>
        <View style={{ padding: rs(20), flex: 1 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: rs(18), padding: rs(20), ...cardLift }}>
            <MaterialCommunityIcons name="account-lock-outline" size={40} color={theme.brandNavOrange} />
            <Text style={{ marginTop: rs(12), color: "#0f172a", fontWeight: "900", fontSize: rms(17) }}>You&apos;re not signed in</Text>
            <Pressable
              onPress={() => router.push("/login")}
              style={{
                marginTop: rs(18),
                backgroundColor: homeHeader.goBtn,
                borderRadius: rs(14),
                paddingVertical: rs(14),
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: rms(15) }}>Sign in</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (roleErr) {
    return (
      <View style={{ flex: 1, backgroundColor: canvas, paddingTop: insets.top + rs(16), paddingHorizontal: rs(20) }}>
        <View
          style={{
            backgroundColor: "#fffbeb",
            borderRadius: rs(16),
            borderWidth: 1,
            borderColor: "#fde68a",
            padding: rs(18),
            ...cardLift,
          }}
        >
          <Text style={{ color: "#78350f", fontWeight: "800", fontSize: rms(15), lineHeight: rms(22) }}>
            Customer account required for this page.
          </Text>
          <Pressable
            onPress={() => router.push("/login")}
            style={{ marginTop: rs(14), borderRadius: rs(12), overflow: "hidden" }}
          >
            <LinearGradient colors={["#2563eb", "#1d4ed8"]} style={{ paddingVertical: rs(12), alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>Customer login</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  const displayName = user.name || "Customer";
  const addressPreview = address?.address?.trim()
    ? address.address.length > 42
      ? `${address.address.slice(0, 42)}…`
      : address.address
    : "Add delivery address";

  return (
    <View style={{ flex: 1, backgroundColor: canvas }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: rs(28) + insets.bottom }}>
        <LinearGradient
          colors={headerGradient}
          locations={[0, 0.42, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{
            paddingTop: insets.top + rs(14),
            paddingHorizontal: rs(20),
            paddingBottom: rs(22),
            borderBottomLeftRadius: rs(28),
            borderBottomRightRadius: rs(28),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: rs(18) }}>
            <Text style={{ color: headerInk, fontSize: rms(22), fontWeight: "900", letterSpacing: -0.4 }}>Profile</Text>
            <Pressable
              onPress={() => router.push("/profile")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: rs(4),
                paddingHorizontal: rs(12),
                paddingVertical: rs(7),
                borderRadius: rs(999),
                backgroundColor: pressed ? "rgba(255,255,255,0.85)" : homeHeader.logoCircle,
                borderWidth: 1,
                borderColor: "rgba(138,59,29,0.2)",
              })}
            >
              <MaterialCommunityIcons name="pencil-outline" size={16} color={headerInk} />
              <Text style={{ color: headerInk, fontWeight: "800", fontSize: rms(12) }}>Edit</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: rs(72),
                height: rs(72),
                borderRadius: rs(36),
                borderWidth: 3,
                borderColor: "#ffffff",
                overflow: "hidden",
                backgroundColor: homeHeader.deliverGold,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <MaterialCommunityIcons name="account" size={36} color={headerInk} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: rs(14), minWidth: 0 }}>
              <Text style={{ color: headerInk, fontSize: rms(20), fontWeight: "900", letterSpacing: -0.3 }} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={{ color: headerInkSoft, fontSize: rms(14), fontWeight: "600", marginTop: rs(4) }}>
                {user.phone}
              </Text>
              <View
                style={{
                  alignSelf: "flex-start",
                  marginTop: rs(8),
                  paddingHorizontal: rs(10),
                  paddingVertical: rs(4),
                  borderRadius: rs(8),
                  backgroundColor: "rgba(255,255,255,0.55)",
                  borderWidth: 1,
                  borderColor: "rgba(138,59,29,0.12)",
                }}
              >
                <Text style={{ color: headerInk, fontSize: rms(10), fontWeight: "800", letterSpacing: 0.6 }}>
                  SPEEDZA MEMBER
                </Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: rs(8), marginTop: rs(18) }}>
            <QuickAction icon="clipboard-text-outline" label="Orders" onPress={() => router.push("/orders")} />
            <QuickAction icon="map-marker-outline" label="Address" onPress={() => router.push("/profile")} />
            <QuickAction icon="lifebuoy" label="Help" onPress={() => router.push("/help")} />
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: rs(18), marginTop: rs(-12) }}>
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: rs(18),
              borderWidth: 1,
              borderColor: "#e2e8f0",
              overflow: "hidden",
              ...cardLift,
            }}
          >
            <Pressable
              onPress={() => router.push("/profile")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                padding: rs(14),
                backgroundColor: pressed ? "#f8fafc" : "#fff",
              })}
            >
              <View
                style={{
                  width: rs(40),
                  height: rs(40),
                  borderRadius: rs(12),
                  backgroundColor: "#ecfdf5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialCommunityIcons name="home-map-marker" size={22} color="#047857" />
              </View>
              <View style={{ flex: 1, marginLeft: rs(12) }}>
                <Text style={{ fontSize: rms(11), fontWeight: "800", color: "#64748b", letterSpacing: 0.5 }}>DELIVERY TO</Text>
                <Text style={{ marginTop: rs(3), fontSize: rms(13.5), fontWeight: "700", color: "#0f172a" }} numberOfLines={2}>
                  {addressPreview}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#94a3b8" />
            </Pressable>
          </View>
        </View>

        <Text
          style={{
            marginTop: rs(22),
            marginBottom: rs(10),
            marginHorizontal: rs(22),
            fontSize: rms(11),
            fontWeight: "800",
            color: "#94a3b8",
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          Your account
        </Text>

        <View
          style={{
            marginHorizontal: rs(18),
            backgroundColor: "#fff",
            borderRadius: rs(18),
            borderWidth: 1,
            borderColor: "#e2e8f0",
            overflow: "hidden",
            ...cardLift,
          }}
        >
          <ProfileMenuRow
            icon="shopping-outline"
            title="Your orders"
            subtitle="Track & reorder"
            iconColors={["#2563eb", "#1d4ed8"]}
            onPress={() => router.push("/orders")}
          />
          <ProfileMenuRow
            icon="cash-refund"
            title="Refunds"
            subtitle="Status & history"
            iconColors={["#7c3aed", "#6d28d9"]}
            onPress={() => router.push("/orders")}
          />
          <ProfileMenuRow
            icon="message-text-outline"
            title="Help & support"
            subtitle="FAQs and contact"
            iconColors={["#0891b2", "#0e7490"]}
            onPress={() => router.push("/help")}
          />
          <ProfileMenuRow
            icon="map-marker-multiple-outline"
            title="Saved addresses"
            subtitle={address ? "1 saved address" : "Tap to add"}
            iconColors={["#059669", "#047857"]}
            onPress={() => router.push("/profile")}
            isLast
          />
        </View>

        <Pressable
          onPress={() =>
            premiumAlert("Sign out?", "You will need to sign in again.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => void logout() },
            ])
          }
          style={({ pressed }) => ({
            marginHorizontal: rs(18),
            marginTop: rs(14),
            backgroundColor: "#fff",
            borderRadius: rs(16),
            borderWidth: 1,
            borderColor: "#fecaca",
            paddingVertical: rs(14),
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: rs(8),
            opacity: pressed ? 0.9 : 1,
            ...cardLift,
          })}
        >
          <MaterialCommunityIcons name="logout" size={20} color="#dc2626" />
          <Text style={{ fontSize: rms(14), fontWeight: "800", color: "#dc2626" }}>Sign out</Text>
        </Pressable>

        <Text
          style={{
            marginTop: rs(24),
            marginBottom: rs(10),
            marginHorizontal: rs(22),
            fontSize: rms(11),
            fontWeight: "800",
            color: "#94a3b8",
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          More from Speedza
        </Text>

        <View style={{ paddingHorizontal: rs(18) }}>
          <QuickGroceryOrderSection variant="profile" listRequests={listRequests} onRequestsUpdated={setListRequests} />
        </View>

        {user.role === "DELIVERY" ? (
          <Pressable
            onPress={() => router.push("/delivery")}
            style={({ pressed }) => ({
              marginHorizontal: rs(18),
              marginTop: rs(12),
              flexDirection: "row",
              alignItems: "center",
              gap: rs(12),
              backgroundColor: "#fff",
              borderRadius: rs(16),
              borderWidth: 1,
              borderColor: "#e2e8f0",
              padding: rs(14),
              opacity: pressed ? 0.92 : 1,
              ...cardLift,
            })}
          >
            <LinearGradient colors={["#2563eb", "#1d4ed8"]} style={{ width: rs(42), height: rs(42), borderRadius: rs(13), alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name="bike-fast" size={22} color="#fff" />
            </LinearGradient>
            <Text style={{ flex: 1, fontWeight: "800", color: "#0f172a", fontSize: rms(15) }}>Delivery dashboard</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#94a3b8" />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
