import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Alert, Platform, Image, Modal } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { api, clearSession } from "@/lib/api";
import { cartTotalQty, getCart, subscribeCart } from "@/lib/cart";
import { theme } from "@/lib/theme";
import { getShopHeaderColors } from "@/lib/shopHeaderTheme";
import { rms, rs } from "@/lib/responsive";

const SHOP_KEY = "__shop__";

const SEARCH_BORDER = "rgba(15, 23, 42, 0.12)";
const SEARCH_ICON = "#334155";
const HOME_PROMO_CHIPS = [
  { label: "Speedza", bg: "#ffffff", text: "#6d28d9" },
  { label: "50% OFF ZONE", bg: "#111827", text: "#ffffff" },
  { label: "Super Mall.", bg: "#2563eb", text: "#ffffff" },
  { label: "Fresh", bg: "#16a34a", text: "#ffffff" },
] as const;

const headerLift = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
  },
  android: { elevation: 5 },
  default: {},
});

const iconCircleLift = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  android: { elevation: 3 },
  default: {},
});

function normKey(k: string): string {
  return k.toLowerCase().replace(/\s+/g, "-").trim();
}

/** Strip icons only (no product images) — compact + consistent. */
function categoryStripIconName(key: string, displayName: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const k = normKey(key);
  const n = displayName.toLowerCase();
  if (k.includes("food") || n.includes("food") || n.includes("meal")) return "food-apple-outline";
  if (k.includes("beverage") || k.includes("drink") || n.includes("beverage") || n.includes("drink"))
    return "cup-outline";
  if (k.includes("grocery") || k.includes("daily") || k.includes("essential") || n.includes("daily"))
    return "shopping-outline";
  if (k.includes("household") || n.includes("household") || n.includes("cleaning")) return "spray-bottle";
  if (k.includes("vegetable") || k.includes("fruit") || n.includes("vegetable") || n.includes("fruit"))
    return "carrot";
  if (k.includes("snack")) return "cookie";
  if (k.includes("frozen") || k.includes("dairy") || n.includes("dairy")) return "snowflake";
  if (k.includes("personal") || k.includes("beauty") || n.includes("beauty")) return "face-woman-outline";
  if (k.includes("pharma") || n.includes("medicine") || n.includes("health")) return "pill";
  if (k.includes("pet")) return "paw";
  if (k.includes("baby") || n.includes("baby")) return "baby-face-outline";
  return "tag-outline";
}

export type ShopHeaderMain = {
  id: string;
  key: string;
  name: string;
  subcategories: { imageUrl?: string | null }[];
};

type Props = {
  safeTop: number;
  mains: ShopHeaderMain[];
  activeKey: string;
  onShopPress: () => void;
  onCategoryPress: (key: string) => void;
  pageTitle?: string;
  onBackPress?: () => void;
};

async function refreshCartCount(set: (n: number) => void) {
  const lines = await getCart();
  set(cartTotalQty(lines));
}

export function ShopMarketHeader({
  safeTop,
  mains,
  activeKey,
  onShopPress,
  onCategoryPress,
  pageTitle,
  onBackPress,
}: Props) {
  const router = useRouter();
  const [deliverLine, setDeliverLine] = useState("Set delivery address");
  const [search, setSearch] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressMode, setAddressMode] = useState<"current" | "manual">("current");
  const [addressText, setAddressText] = useState("");
  const [addressLat, setAddressLat] = useState<number | null>(null);
  const [addressLng, setAddressLng] = useState<number | null>(null);

  const colors = useMemo(() => getShopHeaderColors(activeKey), [activeKey]);

  const categories = useMemo(() => {
    const home = {
      id: "home-tab",
      key: SHOP_KEY,
      name: "Home",
      subcategories: [] as { imageUrl?: string | null }[],
    };
    return [home, ...mains];
  }, [mains]);

  function findMainKeyByTerms(terms: string[]): string | null {
    const hit = mains.find((m) => {
      const hay = `${m.key} ${m.name}`.toLowerCase().replace(/_/g, "-");
      return terms.some((t) => hay.includes(t));
    });
    return hit?.key ?? null;
  }

  function onPromoChipPress(label: string) {
    const n = label.toLowerCase();
    if (n.includes("speedza")) {
      onShopPress();
      return;
    }
    if (n.includes("fresh")) {
      const key = findMainKeyByTerms(["fresh", "fruit", "vegetable", "fruits-vegetables"]);
      if (key) onCategoryPress(key);
      else onShopPress();
      return;
    }
    if (n.includes("super mall")) {
      const key = findMainKeyByTerms(["grocery", "daily", "essentials"]);
      if (key) onCategoryPress(key);
      else onShopPress();
      return;
    }
    if (n.includes("50%")) {
      const key = findMainKeyByTerms(["deals", "offers", "sale", "grocery"]);
      if (key) onCategoryPress(key);
      else onShopPress();
      return;
    }
    onShopPress();
  }

  const syncCart = useCallback(() => {
    void refreshCartCount(setCartCount);
  }, []);

  useEffect(() => {
    syncCart();
    return subscribeCart(syncCart);
  }, [syncCart]);

  useFocusEffect(
    useCallback(() => {
      syncCart();
    }, [syncCart]),
  );

  const loadAddress = useCallback(async () => {
    const res = await api<{
      address: { label: string; address: string; latitude: number; longitude: number } | null;
    }>("/api/user/address");
    if (res.ok && res.data?.address) {
      const a = res.data.address;
      setDeliverLine(`${a.label} · ${a.address}`.replace(/\s+/g, " ").trim());
      setAddressText(a.address);
      setAddressLat(a.latitude);
      setAddressLng(a.longitude);
    } else {
      setDeliverLine("Tap to add address");
    }
  }, []);

  async function useCurrentLocationAddress() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permission needed", "Allow location permission first.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const la = pos.coords.latitude;
    const ln = pos.coords.longitude;
    setAddressLat(la);
    setAddressLng(ln);
    const rev = await Location.reverseGeocodeAsync({ latitude: la, longitude: ln }).catch(() => []);
    if (rev.length) {
      const r = rev[0]!;
      const line = [r.name, r.street, r.city, r.region, r.postalCode].filter(Boolean).join(", ");
      if (line.trim()) setAddressText(line);
    }
    Alert.alert("Location captured", "Current location selected.");
  }

  async function saveDeliveryAddress() {
    let finalAddress = addressText.trim();
    let la = addressLat;
    let ln = addressLng;

    if (addressMode === "current") {
      if (la == null || ln == null) {
        Alert.alert("Location", "Tap 'Use current location' first.");
        return;
      }
      if (!finalAddress) finalAddress = "Current location";
    } else {
      if (!finalAddress) {
        Alert.alert("Address", "Please type your address.");
        return;
      }
      if (la == null || ln == null) {
        const geo = await Location.geocodeAsync(finalAddress).catch(() => []);
        if (!geo.length) {
          Alert.alert("Address", "Could not map this address. Please type a clearer address.");
          return;
        }
        la = geo[0]!.latitude;
        ln = geo[0]!.longitude;
        setAddressLat(la);
        setAddressLng(ln);
      }
    }

    setSavingAddress(true);
    const res = await api("/api/user/address", {
      method: "POST",
      body: JSON.stringify({
        label: "Home",
        address: finalAddress,
        latitude: la,
        longitude: ln,
      }),
    });
    setSavingAddress(false);
    if (!res.ok) {
      Alert.alert("Error", res.error || "Could not save address.");
      return;
    }
    await loadAddress();
    setAddressModalOpen(false);
    Alert.alert("Saved", "Delivery address updated.");
  }

  useEffect(() => {
    void loadAddress();
  }, [loadAddress]);

  useFocusEffect(
    useCallback(() => {
      void loadAddress();
    }, [loadAddress]),
  );

  function goSearch() {
    const q = search.trim();
    router.push({ pathname: "/search", params: { q } });
  }

  async function signOut() {
    Alert.alert("Sign out?", "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "OUT",
        style: "destructive",
        onPress: async () => {
          await clearSession();
          router.replace("/login");
        },
      },
    ]);
  }

  const gradientColors = [...colors.headerGradient] as [string, string, ...string[]];
  const badgeRing = colors.headerGradient[2];

  return (
    <>
    <LinearGradient
      colors={gradientColors}
      locations={[0, 0.42, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ width: "100%", zIndex: 20, elevation: 8 }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: safeTop + 8,
          right: -24,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: "rgba(255,255,255,0.14)",
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: safeTop + 52,
          left: -40,
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: "rgba(255,255,255,0.1)",
        }}
      />

      <View style={{ paddingTop: safeTop, paddingHorizontal: rs(12), paddingBottom: rs(4) }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Pressable
            onPress={() => setAddressModalOpen(true)}
            style={{ flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10, paddingRight: 6 }}
          >
            <View
              style={{
                width: rs(32),
                height: rs(32),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image
                source={require("../assets/map.png")}
                style={{ width: rs(26), height: rs(26) }}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: rms(10), fontWeight: "800", color: "#57534e", letterSpacing: 0.2 }}>
                Speedza in
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    fontSize: rms(13.5),
                    fontWeight: "900",
                    color: "#0c0a09",
                    letterSpacing: -0.3,
                    lineHeight: rms(17),
                  }}
                >
                  {deliverLine}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(204, 251, 241, 0.95)",
                    paddingHorizontal: rs(7),
                    paddingVertical: rs(3),
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "rgba(13, 148, 136, 0.15)",
                  }}
                >
                  <MaterialCommunityIcons name="storefront-outline" size={rs(12)} color="#0f7669" />
                  <Text style={{ marginLeft: rs(4), fontSize: rms(10), fontWeight: "900", color: "#0f7669" }}>Nearby</Text>
                </View>
              </View>
            </View>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: rs(8) }}>
            <Pressable
              onPress={() => router.push("/cart")}
              style={{
                width: rs(34),
                height: rs(34),
                borderRadius: rs(9),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image
                source={require("../assets/trolley.png")}
                style={{ width: rs(30), height: rs(30) }}
                resizeMode="contain"
              />
              {cartCount > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: theme.badgeRed,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                    borderWidth: 2,
                    borderColor: badgeRing,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>
                    {cartCount > 99 ? "99+" : cartCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <View
              style={{
                width: rs(34),
                height: rs(34),
                borderRadius: rs(17),
                backgroundColor: colors.logoCircle,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.85)",
                ...iconCircleLift,
              }}
            >
              <Text style={{ fontSize: rms(14), fontWeight: "900", color: colors.logoText, marginTop: -1 }}>S</Text>
            </View>

            <Pressable
              onPress={() => void signOut()}
              style={{
                paddingHorizontal: 2,
                paddingVertical: 2,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image
                source={require("../assets/switch.png")}
                style={{ width: rs(28), height: rs(28) }}
                resizeMode="contain"
              />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: rs(12), paddingBottom: rs(5) }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rs(7) }}>
          {HOME_PROMO_CHIPS.map((chip) => (
            <Pressable
              key={chip.label}
              onPress={() => onPromoChipPress(chip.label)}
              style={{
                flex: 1,
                minWidth: "22%",
                borderRadius: rs(13),
                paddingHorizontal: rs(9),
                minHeight: rs(38),
                backgroundColor: chip.bg,
                borderWidth: 1,
                borderColor: chip.bg === "#ffffff" ? "rgba(15,23,42,0.08)" : "transparent",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: chip.text, fontWeight: "900", fontSize: rms(10.5), textAlign: "center" }} numberOfLines={2}>
                {chip.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ paddingTop: rs(2), paddingBottom: rs(4) }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: rs(10), gap: rs(6), alignItems: "flex-end", paddingBottom: 1 }}
        >
          {categories.map((c) => {
            const isHome = c.key === SHOP_KEY;
            const active = activeKey === SHOP_KEY ? isHome : c.key === activeKey;
            const stripIcon = !isHome ? categoryStripIconName(c.key, c.name) : null;
            const inactiveColor = colors.chipInactive;
            const categoryKey = `${c.key} ${c.name}`.toLowerCase();
            const isFood = categoryKey.includes("food") || categoryKey.includes("meal");
            const isDailyEssentials =
              categoryKey.includes("grocery") || categoryKey.includes("daily") || categoryKey.includes("essential");
            const isBeverages = categoryKey.includes("beverage") || categoryKey.includes("drink");
            const isPersonalCare =
              categoryKey.includes("personal") || categoryKey.includes("beauty") || categoryKey.includes("care");
            const isSnacks = categoryKey.includes("snack");
            const isHousehold = categoryKey.includes("household") || categoryKey.includes("cleaning");
            return (
              <Pressable
                key={c.id}
                onPress={() => (isHome ? onShopPress() : onCategoryPress(c.key))}
                style={{ width: rs(66), alignItems: "center", paddingBottom: 1 }}
              >
                <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: rs(2), width: "100%" }}>
                  {isHome ? (
                    <Image
                      source={require("../assets/home.png")}
                      style={{ width: rs(28), height: rs(28), opacity: active ? 1 : 0.72 }}
                      resizeMode="contain"
                    />
                  ) : isDailyEssentials ? (
                    <Image
                      source={require("../assets/shopping-cart.png")}
                      style={{ width: rs(28), height: rs(28), opacity: active ? 1 : 0.72 }}
                      resizeMode="contain"
                    />
                  ) : isFood ? (
                    <Image
                      source={require("../assets/balanced-diet.png")}
                      style={{ width: rs(28), height: rs(28), opacity: active ? 1 : 0.72 }}
                      resizeMode="contain"
                    />
                  ) : isPersonalCare ? (
                    <Image
                      source={require("../assets/hair.png")}
                      style={{ width: rs(28), height: rs(28), opacity: active ? 1 : 0.72 }}
                      resizeMode="contain"
                    />
                  ) : isHousehold ? (
                    <Image
                      source={require("../assets/household.png")}
                      style={{ width: rs(28), height: rs(28), opacity: active ? 1 : 0.72 }}
                      resizeMode="contain"
                    />
                  ) : isSnacks ? (
                    <Image
                      source={require("../assets/snaks.png")}
                      style={{ width: 33, height: 33, opacity: active ? 1 : 0.72 }}
                      resizeMode="contain"
                    />
                  ) : isBeverages ? (
                    <Image
                      source={require("../assets/drink.png")}
                      style={{ width: rs(28), height: rs(28) }}
                      resizeMode="contain"
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name={stripIcon!}
                      size={rs(26)}
                      color={active ? "#0f172a" : inactiveColor}
                    />
                  )}
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      marginTop: 2,
                      textAlign: "center",
                      fontSize: rms(9),
                      fontWeight: active ? "900" : "800",
                      color: active ? "#0f172a" : inactiveColor,
                      lineHeight: rms(10),
                      width: "100%",
                    }}
                  >
                    {c.name}
                  </Text>
                </View>
                <View
                  style={{
                    marginTop: 2,
                    width: active ? rs(28) : 0,
                    height: 2,
                    borderRadius: 2,
                    backgroundColor: active ? "#0f172a" : "transparent",
                  }}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View
        style={{
          marginTop: 0,
          paddingHorizontal: rs(12),
          paddingTop: 2,
          paddingBottom: pageTitle ? 8 : 10,
          marginBottom: pageTitle ? 0 : 0,
          zIndex: 2,
        }}
      >
          <View style={{ flexDirection: "row", alignItems: "center", gap: rs(8) }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#ffffff",
              borderRadius: rs(12),
              paddingLeft: 14,
              paddingRight: 10,
              minHeight: rs(42),
              borderWidth: 1,
              borderColor: SEARCH_BORDER,
              ...headerLift,
            }}
          >
            <MaterialCommunityIcons name="magnify" size={rs(18)} color={SEARCH_ICON} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder='Search for "Iphone"'
              placeholderTextColor="#6b7280"
              returnKeyType="search"
              onSubmitEditing={() => goSearch()}
              style={{
                flex: 1,
                marginLeft: 8,
                fontSize: rms(12),
                fontWeight: "600",
                color: "#1f2937",
                paddingVertical: 8,
              }}
            />
          </View>
          <Pressable
            onPress={() => goSearch()}
            style={{
              width: rs(98),
              minHeight: rs(42),
              borderRadius: rs(12),
              borderWidth: 1,
              borderColor: "rgba(30,64,175,0.14)",
              backgroundColor: "#ffffff",
              overflow: "hidden",
              justifyContent: "center",
              paddingHorizontal: 10,
            }}
          >
            <Text style={{ color: "#0891b2", fontWeight: "900", fontSize: rms(13), lineHeight: rms(14) }}>Hydration</Text>
            <Text style={{ color: "#0e7490", fontWeight: "900", fontSize: rms(13), lineHeight: rms(14), marginTop: 1 }}>Store</Text>
          </Pressable>
        </View>

        {pageTitle ? (
          <View
            style={{
              marginTop: 10,
              backgroundColor: "#ffffff",
              borderRadius: 14,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: "#d6d3d1",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <View style={{ minHeight: 30, justifyContent: "center" }}>
              {onBackPress ? (
                <Pressable
                  onPress={onBackPress}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    paddingHorizontal: 8,
                    paddingVertical: 5,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "#d6d3d1",
                    backgroundColor: "#fafaf9",
                  }}
                >
                  <Text style={{ fontWeight: "800", color: "#1c1917", fontSize: 11 }}>← Back</Text>
                </Pressable>
              ) : null}
              <Text style={{ textAlign: "center", fontSize: 16, fontWeight: "900", color: "#0c0a09" }}>
                {pageTitle}
              </Text>
            </View>
            <Text
              style={{
                marginTop: 5,
                textAlign: "center",
                fontSize: 11,
                fontWeight: "600",
                color: "#57534e",
                lineHeight: 15,
              }}
            >
              Choose a category, then browse products nearby.
            </Text>
          </View>
        ) : null}
      </View>
    </LinearGradient>
    
    <Modal visible={addressModalOpen} transparent animationType="fade" onRequestClose={() => setAddressModalOpen(false)}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 18 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#e7e5e4" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 16, fontWeight: "900", color: "#0f172a" }}>Delivery Address</Text>
            <Pressable onPress={() => setAddressModalOpen(false)}>
              <MaterialCommunityIcons name="close" size={22} color="#475569" />
            </Pressable>
          </View>
          <Text style={{ marginTop: 4, color: "#64748b", fontWeight: "600", fontSize: 12 }}>
            Choose one option and save.
          </Text>

          <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => setAddressMode("current")}
              style={{
                flex: 1,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: addressMode === "current" ? "#16a34a" : "#e2e8f0",
                backgroundColor: addressMode === "current" ? "#ecfdf5" : "#fff",
                paddingVertical: 10,
              }}
            >
              <Text style={{ textAlign: "center", fontWeight: "900", color: "#0f172a", fontSize: 12 }}>
                Current location
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAddressMode("manual")}
              style={{
                flex: 1,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: addressMode === "manual" ? "#16a34a" : "#e2e8f0",
                backgroundColor: addressMode === "manual" ? "#ecfdf5" : "#fff",
                paddingVertical: 10,
              }}
            >
              <Text style={{ textAlign: "center", fontWeight: "900", color: "#0f172a", fontSize: 12 }}>
                Type manually
              </Text>
            </Pressable>
          </View>

          {addressMode === "current" ? (
            <Pressable
              onPress={() => void useCurrentLocationAddress()}
              style={{
                marginTop: 10,
                borderWidth: 1,
                borderColor: "#cbd5e1",
                backgroundColor: "#f8fafc",
                borderRadius: 10,
                paddingVertical: 11,
              }}
            >
              <Text style={{ textAlign: "center", fontWeight: "900", color: "#0f172a" }}>Use current location</Text>
            </Pressable>
          ) : (
            <TextInput
              value={addressText}
              onChangeText={setAddressText}
              placeholder="Type full address"
              placeholderTextColor="#94a3b8"
              multiline
              style={{
                marginTop: 10,
                minHeight: 88,
                borderWidth: 1,
                borderColor: "#cbd5e1",
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 10,
                color: "#0f172a",
                fontWeight: "600",
              }}
            />
          )}

          <Pressable
            onPress={() => void saveDeliveryAddress()}
            disabled={savingAddress}
            style={{
              marginTop: 12,
              backgroundColor: "#16a34a",
              borderRadius: 10,
              paddingVertical: 12,
              opacity: savingAddress ? 0.7 : 1,
            }}
          >
            <Text style={{ textAlign: "center", color: "#fff", fontWeight: "900" }}>
              {savingAddress ? "Saving..." : "Save address"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    </>
  );
}
