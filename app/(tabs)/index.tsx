import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, getApiBase, getToken } from "@/lib/api";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";

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

  async function useGps() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location", "Allow location to sort stores by distance.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    setLat(pos.coords.latitude);
    setLng(pos.coords.longitude);
    setLoading(true);
    setErr(null);
    const res = await api<{ stores: StoreItem[] }>(
      `/api/stores/nearby?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&radiusKm=60&limit=30`,
    );
    setLoading(false);
    if (res.ok && res.data) setStores(res.data.stores);
    else setErr(res.error || "Could not load stores");
  }

  const slide = HERO_SLIDES[heroIndex];

  function openBrowse(key: string) {
    router.push(
      `/browse/${encodeURIComponent(key)}?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 24 + insets.bottom,
          paddingTop: 8,
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void loadAll()} tintColor={theme.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: theme.text, letterSpacing: -0.5 }}>
              Speedza
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textMuted, marginTop: 2 }}>
              Superfast · COD · Nearby stores
            </Text>
          </View>
          <Pressable
            onPress={() => void useGps()}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: theme.primarySoft,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "#a7f3d0",
            }}
          >
            <MaterialCommunityIcons name="crosshairs-gps" size={18} color={theme.primary} />
            <Text style={{ fontWeight: "700", color: theme.primary, fontSize: 13 }}>GPS</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, marginBottom: 8 }}>
            Today&apos;s match
          </Text>
          <View
            style={{
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: theme.slateLine,
              aspectRatio: 16 / 9,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color={theme.primary} />
              </View>
            )}
          </View>
        </View>

        <View style={{ marginHorizontal: 16, borderRadius: 20, overflow: "hidden", marginBottom: 20 }}>
          <View
            style={{
              backgroundColor: "#f5f5f4",
              paddingVertical: 8,
              alignItems: "center",
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textMuted }}>
              ✦ Live prices · Trusted stores
            </Text>
          </View>
          <View style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
            <View
              style={{
                borderRadius: 16,
                overflow: "hidden",
                minHeight: 200,
              }}
            >
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  opacity: 0.95,
                }}
              >
                <View style={{ flex: 1, backgroundColor: slide.bg[0] }} />
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    backgroundColor: slide.bg[2],
                    opacity: 0.35,
                  }}
                />
              </View>
              <View style={{ flexDirection: "row", padding: 16, alignItems: "center" }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: slide.subText, textTransform: "uppercase" }}>
                    {slide.eyebrow}
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: "900", color: slide.text, marginTop: 6, lineHeight: 24 }}>
                    {slide.title}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: slide.subText, marginTop: 6 }}>
                    {slide.subtitle}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                    <Pressable
                      onPress={() => {}}
                      style={{ backgroundColor: "#0f172a", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Explore nearby</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push("/cart")}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.85)",
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "rgba(0,0,0,0.08)",
                      }}
                    >
                      <Text style={{ color: theme.text, fontWeight: "800", fontSize: 13 }}>Cart</Text>
                    </Pressable>
                  </View>
                </View>
                <Image
                  source={{ uri: slide.image }}
                  style={{ width: SCREEN_W * 0.32, height: 100, borderRadius: 12 }}
                  contentFit="cover"
                />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingBottom: 12 }}>
                {HERO_SLIDES.map((s, i) => (
                  <Pressable key={s.id} onPress={() => setHeroIndex(i)}>
                    <View
                      style={{
                        height: 6,
                        borderRadius: 3,
                        width: i === heroIndex ? 22 : 6,
                        backgroundColor: i === heroIndex ? "rgba(15,23,42,0.75)" : "rgba(0,0,0,0.2)",
                      }}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>

        {mains.length > 0 ? (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.text, paddingHorizontal: 16, marginBottom: 10 }}>
              Shop by category
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {mains.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => openBrowse(m.key)}
                  style={{
                    width: 96,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 20,
                      backgroundColor: theme.bgElevated,
                      borderWidth: 1,
                      borderColor: theme.border,
                      overflow: "hidden",
                      marginBottom: 6,
                    }}
                  >
                    {m.subcategories[0]?.imageUrl ? (
                      <Image
                        source={{ uri: resolveMediaUrl(m.subcategories[0].imageUrl) ?? "" }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <MaterialCommunityIcons name="shape-outline" size={28} color={theme.textDim} />
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={2} style={{ fontSize: 11, fontWeight: "700", color: theme.text, textAlign: "center" }}>
                    {m.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

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
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: "800", color: theme.text }}>Stores near you</Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textMuted, marginTop: 4 }}>
                {stores.length} outlet{stores.length !== 1 ? "s" : ""} · by distance
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {["Fast delivery", "Verified", "Best offers"].map((chip) => (
              <View
                key={chip}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: theme.bgElevated,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textMuted }}>{chip}</Text>
              </View>
            ))}
          </View>

          {stores.map((s) => {
            const img = resolveMediaUrl(s.imageUrl ?? undefined);
            return (
              <Pressable
                key={s.id}
                onPress={() => router.push(`/store/${s.id}`)}
                style={{
                  backgroundColor: theme.bgElevated,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.border,
                  marginBottom: 12,
                  overflow: "hidden",
                }}
              >
                <View style={{ aspectRatio: 16 / 10, backgroundColor: theme.slateLine }}>
                  {img ? (
                    <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <MaterialCommunityIcons name="storefront-outline" size={40} color={theme.textDim} />
                    </View>
                  )}
                </View>
                <View style={{ padding: 14 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: theme.text }}>{s.name}</Text>
                  <Text style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }} numberOfLines={2}>
                    {s.address}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: theme.primary }}>
                      {s.distanceKm.toFixed(1)} km
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: theme.textDim, textTransform: "capitalize" }}>
                      · {s.shopVertical?.replace(/-/g, " ") || "store"}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
