import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Alert, Platform, Image } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, clearSession } from "@/lib/api";
import { cartTotalQty, getCart, subscribeCart } from "@/lib/cart";
import { theme } from "@/lib/theme";
import { getShopHeaderColors } from "@/lib/shopHeaderTheme";

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
      address: { label: string; address: string } | null;
    }>("/api/user/address");
    if (res.ok && res.data?.address) {
      const a = res.data.address;
      setDeliverLine(`${a.label} · ${a.address}`.replace(/\s+/g, " ").trim());
    } else {
      setDeliverLine("Tap to add address");
    }
  }, []);

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

      <View style={{ paddingTop: safeTop, paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Pressable
            onPress={() => router.push("/profile")}
            style={{ flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10, paddingRight: 6 }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image
                source={require("../assets/map.png")}
                style={{ width: 34, height: 34 }}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#57534e", letterSpacing: 0.2 }}>
                Speedza in
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    fontSize: 17,
                    fontWeight: "900",
                    color: "#0c0a09",
                    letterSpacing: -0.3,
                    lineHeight: 22,
                  }}
                >
                  {deliverLine}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(204, 251, 241, 0.95)",
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "rgba(13, 148, 136, 0.15)",
                  }}
                >
                  <MaterialCommunityIcons name="storefront-outline" size={14} color="#0f7669" />
                  <Text style={{ marginLeft: 4, fontSize: 11, fontWeight: "900", color: "#0f7669" }}>Nearby</Text>
                </View>
              </View>
            </View>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              onPress={() => router.push("/cart")}
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image
                source={require("../assets/trolley.png")}
                style={{ width: 38, height: 38 }}
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
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: colors.logoCircle,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.85)",
                ...iconCircleLift,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: "900", color: colors.logoText, marginTop: -1 }}>S</Text>
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
                style={{ width: 34, height: 34 }}
                resizeMode="contain"
              />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {HOME_PROMO_CHIPS.map((chip) => (
            <Pressable
              key={chip.label}
              onPress={() => onPromoChipPress(chip.label)}
              style={{
                flex: 1,
                minWidth: "22%",
                borderRadius: 16,
                paddingHorizontal: 12,
                minHeight: 52,
                backgroundColor: chip.bg,
                borderWidth: 1,
                borderColor: chip.bg === "#ffffff" ? "rgba(15,23,42,0.08)" : "transparent",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: chip.text, fontWeight: "900", fontSize: 13, textAlign: "center" }} numberOfLines={2}>
                {chip.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ paddingTop: 6, paddingBottom: 10 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8, alignItems: "flex-end", paddingBottom: 2 }}
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
            return (
              <Pressable
                key={c.id}
                onPress={() => (isHome ? onShopPress() : onCategoryPress(c.key))}
                style={{ width: 76, alignItems: "center", paddingBottom: 2 }}
              >
                <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 4, width: "100%" }}>
                  {isHome ? (
                    <Image
                      source={require("../assets/home.png")}
                      style={{ width: 33, height: 33, opacity: active ? 1 : 0.72 }}
                      resizeMode="contain"
                    />
                  ) : isDailyEssentials ? (
                    <Image
                      source={require("../assets/shopping-cart.png")}
                      style={{ width: 33, height: 33, opacity: active ? 1 : 0.72 }}
                      resizeMode="contain"
                    />
                  ) : isFood ? (
                    <Image
                      source={require("../assets/balanced-diet.png")}
                      style={{ width: 33, height: 33, opacity: active ? 1 : 0.72 }}
                      resizeMode="contain"
                    />
                  ) : isPersonalCare ? (
                    <Image
                      source={require("../assets/hair.png")}
                      style={{ width: 33, height: 33, opacity: active ? 1 : 0.72 }}
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
                      style={{ width: 33, height: 33 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name={stripIcon!}
                      size={32}
                      color={active ? "#0f172a" : inactiveColor}
                    />
                  )}
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      marginTop: 4,
                      textAlign: "center",
                      fontSize: 10,
                      fontWeight: active ? "900" : "800",
                      color: active ? "#0f172a" : inactiveColor,
                      lineHeight: 12,
                      width: "100%",
                    }}
                  >
                    {c.name}
                  </Text>
                </View>
                <View
                  style={{
                    marginTop: 4,
                    width: active ? 28 : 0,
                    height: 3,
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
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: pageTitle ? 12 : 16,
          marginBottom: pageTitle ? 0 : 0,
          zIndex: 2,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#ffffff",
              borderRadius: 14,
              paddingLeft: 14,
              paddingRight: 10,
              minHeight: 50,
              borderWidth: 1,
              borderColor: SEARCH_BORDER,
              ...headerLift,
            }}
          >
            <MaterialCommunityIcons name="magnify" size={22} color={SEARCH_ICON} />
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
                fontSize: 14,
                fontWeight: "600",
                color: "#1f2937",
                paddingVertical: 10,
              }}
            />
          </View>
          <Pressable
            onPress={() => goSearch()}
            style={{
              width: 120,
              minHeight: 50,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "rgba(30,64,175,0.14)",
              backgroundColor: "#ffffff",
              overflow: "hidden",
              justifyContent: "center",
              paddingHorizontal: 10,
            }}
          >
            <Text style={{ color: "#0891b2", fontWeight: "900", fontSize: 16, lineHeight: 16 }}>Hydration</Text>
            <Text style={{ color: "#0e7490", fontWeight: "900", fontSize: 16, lineHeight: 16, marginTop: 2 }}>Store</Text>
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
  );
}
