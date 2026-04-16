import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, getApiBase, getToken } from "@/lib/api";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { ShopMarketHeader } from "@/components/ShopMarketHeader";
import { FREE_DELIVERY_MIN_SUBTOTAL } from "@/lib/free-delivery";

const HEADER_SHOP_ACTIVE = "__shop__";

const DEFAULT_LAT = 28.4595;
const DEFAULT_LNG = 77.0266;

type StoreItem = {
  id: string;
  name: string;
  address: string;
  distanceKm: number;
  shopVertical: string;
  imageUrl?: string | null;
};

type MainCategory = {
  id: string;
  key: string;
  name: string;
  subcategories: { id: string; name: string; imageUrl?: string | null }[];
};

const HERO_SLIDES = [
  {
    id: "grocery",
    eyebrow: "Speedza",
    title: "Grocery specials",
    subtitle: "Fresh pantry picks & fast delivery.",
    bg: ["#facc15", "#eab308", "#a16207"] as const,
    text: "#2f2200",
    subText: "#4f3a00",
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=500&fit=crop&q=80",
  },
  {
    id: "vegetables",
    eyebrow: "Farm Fresh",
    title: "Fruits & vegetables",
    subtitle: "Seasonal quality at your door.",
    bg: ["#bbf7d0", "#4ade80", "#15803d"] as const,
    text: "#073b1d",
    subText: "#14532d",
    image:
      "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=800&h=500&fit=crop&q=80",
  },
  {
    id: "daily",
    eyebrow: "Daily Needs",
    title: "Daily essentials",
    subtitle: "Milk, bread, snacks & more.",
    bg: ["#dbeafe", "#93c5fd", "#60a5fa"] as const,
    text: "#172554",
    subText: "#1e3a8a",
    image:
      "https://images.unsplash.com/photo-1601599561213-832382fd07ba?w=800&h=500&fit=crop&q=80",
  },
] as const;

const { width: SCREEN_W } = Dimensions.get("window");

/** 2-column main category tiles under “Shop by category” */
const CATEGORY_GRID_GAP = 10;
const CATEGORY_GRID_PAD = 20;
const categoryTileW = (SCREEN_W - CATEGORY_GRID_PAD * 2 - CATEGORY_GRID_GAP) / 2;

function previewMainCategoryImage(m: MainCategory): string | undefined {
  const hit = m.subcategories.find((s) => s.imageUrl?.trim());
  return hit?.imageUrl ? resolveMediaUrl(hit.imageUrl) ?? undefined : undefined;
}

/** Horizontal subcategory tile width (web-style cards) */
const SUB_CARD_W = 104;
const SECTION_PAD = 16;

const subCardShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 3 },
  default: {},
});

/** Home banners — light lift, not heavy */
const bannerCardShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
  default: {},
});

function heroCategoryKey(slideId: string): string {
  if (slideId === "daily") return "daily-essentials";
  return slideId;
}

function normMainKey(v: string) {
  return v.trim().toLowerCase().replace(/\s+/g, "-");
}

function featuredTheme(mainKey: string) {
  const k = normMainKey(mainKey);
  if (k.includes("daily") || k.includes("essential") || k.includes("grocery")) {
    return {
      shell: ["#86efac", "#4ade80", "#22c55e"] as const,
      border: "#16a34a",
      title: "#052e16",
      sub: "#166534",
      accent: "#15803d",
    };
  }
  if (k.includes("food") || k.includes("meal")) {
    return {
      shell: ["#f8e7aa", "#f9e5a0", "#f4de95"] as const,
      border: "#e7c768",
      title: "#7c2d12",
      sub: "#92400e",
      accent: "#f59e0b",
    };
  }
  return {
    shell: ["#f9dbe9", "#f8d5e5", "#f5d0e0"] as const,
    border: "#e8b6cf",
    title: "#831843",
    sub: "#9d174d",
    accent: "#ec4899",
  };
}

export default function ShopHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [mains, setMains] = useState<MainCategory[]>([]);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const resolveCoords = useCallback(async () => {
    const token = await getToken();
    if (token) {
      const addr = await api<{ address: { latitude: number; longitude: number } | null }>(
        "/api/user/address",
      );
      if (addr.ok && addr.data?.address) {
        return { la: addr.data.address.latitude, ln: addr.data.address.longitude };
      }
    }
    return { la: DEFAULT_LAT, ln: DEFAULT_LNG };
  }, []);

  const loadAll = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const { la, ln } = await resolveCoords();
      setLat(la);
      setLng(ln);

      const [nearby, tree, banner] = await Promise.all([
        api<{ stores: StoreItem[] }>(
          `/api/stores/nearby?lat=${la}&lng=${ln}&radiusKm=60&limit=30`,
        ),
        api<{ mains: MainCategory[] }>("/api/master/shop-tree"),
        api<{ imageUrl: string | null }>("/api/shop/todays-match-banner"),
      ]);

      if (nearby.ok && nearby.data) setStores(nearby.data.stores);
      else setErr(nearby.error || "Could not load stores");

      if (tree.ok && tree.data) setMains(tree.data.mains);
      if (banner.ok && banner.data?.imageUrl?.trim()) {
        setBannerUrl(resolveMediaUrl(banner.data.imageUrl) ?? null);
      } else {
        setBannerUrl(`${getApiBase()}/banners/todays-match.svg`);
      }
    } finally {
      setLoading(false);
    }
  }, [resolveCoords]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const t = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, 4500);
    return () => clearInterval(t);
  }, []);

  const slide = HERO_SLIDES[heroIndex];

  function openCategory(key: string) {
    const href =
      `/category/${encodeURIComponent(key)}?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}` as Href;
    router.push(href);
  }

  function openSubcategory(mainKey: string, sub: { id: string; name: string }) {
    const href =
      `/category/${encodeURIComponent(mainKey)}/${encodeURIComponent(sub.id)}?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&catalogKey=${encodeURIComponent(mainKey)}&subname=${encodeURIComponent(sub.name)}` as Href;
    router.push(href);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.homeCanvasBg }}>
      <ScrollView
        style={{ backgroundColor: theme.homeCanvasBg }}
        contentContainerStyle={{
          paddingBottom: 24 + insets.bottom,
        }}
        stickyHeaderIndices={[0]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void loadAll()} tintColor={theme.brandNavOrange} />
        }
        showsVerticalScrollIndicator={false}
      >
        <ShopMarketHeader
          safeTop={insets.top}
          mains={mains}
          activeKey={HEADER_SHOP_ACTIVE}
          onShopPress={() => router.replace("/")}
          onCategoryPress={(key) => openCategory(key)}
        />

        <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "800",
                color: theme.text,
                letterSpacing: -0.3,
              }}
            >
              Today&apos;s event
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Pressable
                onPress={() => router.push("/account")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 999,
                  backgroundColor: "#7f1d1d",
                  borderWidth: 1,
                  borderColor: "#fecaca",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <MaterialCommunityIcons name="file-image-plus-outline" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 10.5, letterSpacing: 0.2 }}>
                  Upload list
                </Text>
              </Pressable>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#22c55e" }} />
                <Text style={{ fontSize: 10, fontWeight: "700", color: theme.textMuted, letterSpacing: 0.2 }}>
                  Live
                </Text>
              </View>
            </View>
          </View>
          <View
            style={{
              borderRadius: 14,
              overflow: "hidden",
              backgroundColor: theme.slateLine,
              aspectRatio: 2.2,
              borderWidth: 1,
              borderColor: theme.border,
              ...bannerCardShadow,
            }}
          >
            {bannerUrl ? (
              <Image
                source={{ uri: bannerUrl }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 120 }}>
                <ActivityIndicator color={theme.brandNavOrange} />
              </View>
            )}
          </View>
          <Pressable
            onPress={() => router.push("/account")}
            style={{
              marginTop: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#fecaca",
              backgroundColor: "#7f1d1d",
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              ...bannerCardShadow,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name="file-image-plus-outline" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>
                Upload list photo & order
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.88)", fontWeight: "700", fontSize: 11, marginTop: 2 }}>
                Kirana list ki photo bhejo, admin confirm karke delivery karega.
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={{ marginHorizontal: 16, marginBottom: 14, borderRadius: 16, ...bannerCardShadow }}>
          <View style={{ borderRadius: 16, overflow: "hidden", backgroundColor: slide.bg[1] }}>
            <LinearGradient
              colors={[slide.bg[0], slide.bg[1], slide.bg[2]]}
              locations={[0, 0.52, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ paddingTop: 12, paddingBottom: 10, paddingHorizontal: 14 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1, paddingRight: 10, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "800",
                      color: slide.subText,
                      letterSpacing: 1.1,
                      opacity: 0.88,
                    }}
                  >
                    {slide.eyebrow.toUpperCase()}
                  </Text>
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: "800",
                      color: slide.text,
                      marginTop: 3,
                      letterSpacing: -0.35,
                      lineHeight: 21,
                    }}
                    numberOfLines={2}
                  >
                    {slide.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: slide.subText,
                      marginTop: 3,
                      opacity: 0.88,
                      lineHeight: 14,
                    }}
                    numberOfLines={1}
                  >
                    {slide.subtitle}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    <Pressable
                      onPress={() => openCategory(heroCategoryKey(slide.id))}
                      style={{ borderRadius: 10, overflow: "hidden" }}
                    >
                      <LinearGradient
                        colors={[...theme.placeOrderGradient]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={{ paddingHorizontal: 14, paddingVertical: 8 }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>Shop</Text>
                      </LinearGradient>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push("/cart")}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.92)",
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "rgba(0,0,0,0.06)",
                      }}
                    >
                      <Text style={{ color: theme.text, fontWeight: "800", fontSize: 12 }}>Cart</Text>
                    </Pressable>
                  </View>
                </View>
                <Image
                  source={{ uri: slide.image }}
                  style={{
                    width: SCREEN_W * 0.26,
                    height: 86,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: "rgba(255,255,255,0.65)",
                  }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 5,
                  marginTop: 8,
                }}
              >
                {HERO_SLIDES.map((s, i) => (
                  <Pressable key={s.id} onPress={() => setHeroIndex(i)} hitSlop={8}>
                    <View
                      style={{
                        height: 4,
                        borderRadius: 2,
                        width: i === heroIndex ? 18 : 4,
                        backgroundColor: i === heroIndex ? slide.text : "rgba(255,255,255,0.45)",
                      }}
                    />
                  </Pressable>
                ))}
              </View>
            </LinearGradient>
          </View>
        </View>

        <View style={{ marginTop: 4, marginBottom: 8 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "900",
              color: theme.brandRust,
              marginBottom: 14,
              letterSpacing: -0.2,
              paddingHorizontal: SECTION_PAD,
            }}
          >
            Shop by category
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              paddingHorizontal: CATEGORY_GRID_PAD,
              marginBottom: 8,
            }}
          >
            {mains.map((m, i) => {
              const img = previewMainCategoryImage(m);
              const n = m.subcategories.length;
              const subLabel = n === 1 ? "1 subcategory" : `${n} subcategories`;
              const isRightCol = i % 2 === 1;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => openCategory(m.key)}
                  style={{
                    width: categoryTileW,
                    marginRight: isRightCol ? 0 : CATEGORY_GRID_GAP,
                    marginBottom: CATEGORY_GRID_GAP,
                  }}
                >
                  <View
                    style={{
                      borderRadius: 14,
                      overflow: "hidden",
                      aspectRatio: 4 / 3,
                      backgroundColor: theme.slateLine,
                    }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <MaterialCommunityIcons name="view-grid-outline" size={34} color={theme.textDim} />
                      </View>
                    )}
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.78)"]}
                      locations={[0.4, 1]}
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        paddingTop: 36,
                        paddingHorizontal: 10,
                        paddingBottom: 10,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }} numberOfLines={2}>
                        {m.name}
                      </Text>
                      <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "700", marginTop: 3 }}>
                        {subLabel}
                      </Text>
                    </LinearGradient>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {mains.map((m) => {
            const k = normMainKey(m.key);
            const featured =
              k.includes("daily") ||
              k.includes("essential") ||
              k.includes("food") ||
              k.includes("personal") ||
              k.includes("beauty") ||
              k.includes("care");
            if (featured) {
              const th = featuredTheme(m.key);
              return (
                <View key={`${m.id}-featured`} style={{ marginBottom: 22, marginHorizontal: SECTION_PAD }}>
                  <LinearGradient
                    colors={[...th.shell]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 24,
                      borderWidth: 1.5,
                      borderColor: th.border,
                      paddingTop: 14,
                      paddingBottom: 14,
                    }}
                  >
                    <View style={{ paddingHorizontal: 14 }}>
                      <Text
                        style={{ marginTop: 10, fontSize: 20, fontWeight: "900", color: th.title, letterSpacing: -0.5 }}
                        numberOfLines={1}
                      >
                        {m.name}
                      </Text>
                      <Text style={{ marginTop: 3, fontSize: 16 / 1.2, fontWeight: "600", color: th.sub }} numberOfLines={1}>
                        Handpicked seasonal finds
                      </Text>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingLeft: 14, paddingRight: 10, paddingTop: 14 }}
                      decelerationRate="fast"
                    >
                      {m.subcategories.map((sub, idx) => {
                        const thumb = sub.imageUrl?.trim() ? resolveMediaUrl(sub.imageUrl) : undefined;
                        return (
                          <View key={sub.id} style={{ width: 128, marginRight: idx === m.subcategories.length - 1 ? 0 : 9 }}>
                            <Pressable onPress={() => openSubcategory(m.key, sub)}>
                              <View style={{ borderRadius: 16, overflow: "hidden", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb" }}>
                                <View style={{ width: "100%", aspectRatio: 1 }}>
                                  {thumb ? (
                                    <Image
                                      source={{ uri: thumb }}
                                      style={{ width: "100%", height: "100%" }}
                                      contentFit="cover"
                                      cachePolicy="memory-disk"
                                    />
                                  ) : (
                                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f3f4f6" }}>
                                      <MaterialCommunityIcons name="tag-outline" size={28} color={theme.textDim} />
                                    </View>
                                  )}
                                  <View style={{ position: "absolute", left: 8, top: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 8, paddingVertical: 3 }}>
                                    <Text style={{ fontSize: 10, fontWeight: "900", color: "#111827" }}>MUST TRY</Text>
                                  </View>
                                  <View style={{ position: "absolute", right: 8, bottom: 8, borderRadius: 999, backgroundColor: "rgba(17,24,39,0.72)", paddingHorizontal: 10, paddingVertical: 4 }}>
                                    <Text style={{ fontSize: 12, fontWeight: "900", color: "#fff" }}>OPEN</Text>
                                  </View>
                                </View>
                                <Text numberOfLines={2} style={{ minHeight: 42, paddingHorizontal: 9, paddingVertical: 7, fontSize: 13.5, fontWeight: "800", color: "#111827" }}>
                                  {sub.name}
                                </Text>
                              </View>
                            </Pressable>
                            <Pressable
                              onPress={() => openSubcategory(m.key, sub)}
                              style={{ marginTop: 7, borderRadius: 999, backgroundColor: "#dc2626", paddingVertical: 7, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                            >
                              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>Browse products</Text>
                              <MaterialCommunityIcons name="chevron-right" size={16} color="#fff" />
                            </Pressable>
                          </View>
                        );
                      })}
                    </ScrollView>

                    <Pressable
                      onPress={() => openCategory(m.key)}
                      style={{ marginHorizontal: 14, marginTop: 14, borderRadius: 999, backgroundColor: "#10b981", paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                    >
                      <View style={{ flexDirection: "row", marginRight: 12 }}>
                        {m.subcategories.slice(0, 3).map((sub, i) => {
                          const thumb = sub.imageUrl?.trim() ? resolveMediaUrl(sub.imageUrl) : undefined;
                          return (
                            <View
                              key={sub.id}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                overflow: "hidden",
                                borderWidth: 2,
                                borderColor: "#fff",
                                marginLeft: i === 0 ? 0 : -8,
                                backgroundColor: "#d1fae5",
                              }}
                            >
                              {thumb ? (
                                <Image source={{ uri: thumb }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" />
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                      <Text style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: "900", color: "#fff" }}>
                        See all subcategories
                      </Text>
                      <MaterialCommunityIcons name="chevron-right" size={22} color="#fff" />
                    </Pressable>
                  </LinearGradient>
                </View>
              );
            }

            return (
              <View key={`${m.id}-subs`} style={{ marginBottom: 22 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: SECTION_PAD,
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 18,
                      fontWeight: "900",
                      color: theme.text,
                      letterSpacing: -0.3,
                      paddingRight: 8,
                    }}
                    numberOfLines={1}
                  >
                    {m.name}
                  </Text>
                  <Pressable
                    onPress={() => openCategory(m.key)}
                    style={{ flexDirection: "row", alignItems: "center" }}
                    hitSlop={8}
                  >
                    <Text style={{ color: theme.primary, fontWeight: "800", fontSize: 13 }}>See all</Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={theme.primary} />
                  </Pressable>
                </View>
                {m.subcategories.length === 0 ? null : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingLeft: SECTION_PAD, paddingRight: 12 }}
                    decelerationRate="fast"
                  >
                    {m.subcategories.map((sub, idx) => {
                      const thumb = sub.imageUrl?.trim() ? resolveMediaUrl(sub.imageUrl) : undefined;
                      return (
                        <Pressable
                          key={sub.id}
                          onPress={() => openSubcategory(m.key, sub)}
                          style={{
                            width: SUB_CARD_W,
                            marginRight: idx === m.subcategories.length - 1 ? 0 : 12,
                          }}
                        >
                          <View
                            style={{
                              backgroundColor: theme.bgElevated,
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: theme.border,
                              padding: 8,
                              ...subCardShadow,
                            }}
                          >
                            <View
                              style={{
                                width: "100%",
                                aspectRatio: 1,
                                borderRadius: 12,
                                overflow: "hidden",
                                backgroundColor: theme.slateLine,
                              }}
                            >
                              {thumb ? (
                                <Image
                                  source={{ uri: thumb }}
                                  style={{ width: "100%", height: "100%" }}
                                  contentFit="cover"
                                  cachePolicy="memory-disk"
                                />
                              ) : (
                                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                                  <MaterialCommunityIcons name="tag-outline" size={28} color={theme.textDim} />
                                </View>
                              )}
                            </View>
                            <Text
                              numberOfLines={2}
                              style={{
                                marginTop: 8,
                                fontSize: 12,
                                fontWeight: "800",
                                color: theme.text,
                                lineHeight: 15,
                                textAlign: "center",
                              }}
                            >
                              {sub.name}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            );
          })}
        </View>

        {err ? (
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 16,
              padding: 14,
              borderRadius: 14,
              backgroundColor: theme.roseBg,
              borderWidth: 1,
              borderColor: theme.roseBorder,
            }}
          >
            <Text style={{ color: theme.roseText, fontWeight: "600", fontSize: 14 }}>{err}</Text>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 16 }}>
          <Pressable
            onPress={() => router.push({ pathname: "/search", params: { q: "" } })}
            style={{
              marginBottom: 16,
              borderRadius: 14,
              overflow: "hidden",
              backgroundColor: theme.adBannerGradient[0],
              ...bannerCardShadow,
            }}
            accessibilityRole="button"
            accessibilityLabel="Sponsored offer, open search"
          >
            <LinearGradient
              colors={[...theme.adBannerGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: 10, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "800",
                    color: "rgba(255,255,255,0.85)",
                    letterSpacing: 1.2,
                  }}
                >
                  AD · SPONSORED
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "900",
                    color: "#ffffff",
                    marginTop: 4,
                    letterSpacing: -0.2,
                  }}
                  numberOfLines={2}
                >
                  Flat deals on groceries & snacks
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.92)", marginTop: 2 }} numberOfLines={1}>
                  Tap to search offers · Code SPEEDZA10
                </Text>
              </View>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.22)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialCommunityIcons name="arrow-right" size={22} color="#ffffff" />
              </View>
            </LinearGradient>
          </Pressable>

        </View>
      </ScrollView>
    </View>
  );
}
