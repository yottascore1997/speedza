import { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
import * as ImagePicker from "expo-image-picker";
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

type ProductHit = {
  id: string;
  name: string;
  price: unknown;
  mrp?: unknown;
  discountPercent?: number | null;
  imageUrl?: string | null;
  unitLabel?: string | null;
  stock?: number;
  store?: { id: string; name: string };
};

/** Demo row — “Deals starting at ₹9” carousel (replace with API when ready) */
const DEALS_CAROUSEL_DUMMY: ProductHit[] = [
  {
    id: "deal-dummy-1",
    name: "Pampers Premium Care Small",
    price: 19,
    mrp: 74,
    imageUrl: "https://images.unsplash.com/photo-1584515933487-779824d29309?w=400&h=400&fit=crop&q=80",
    unitLabel: "1 pack (4 pcs)",
    stock: 99,
  },
  {
    id: "deal-dummy-2",
    name: "Zoff Gravy Mix Masala",
    price: 15,
    mrp: 45,
    imageUrl: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&h=400&fit=crop&q=80",
    unitLabel: "50 g",
    stock: 99,
  },
  {
    id: "deal-dummy-3",
    name: "Amul Gold Full Cream Milk",
    price: 28,
    mrp: 32,
    imageUrl: "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&h=400&fit=crop&q=80",
    unitLabel: "500 ml",
    stock: 99,
  },
  {
    id: "deal-dummy-4",
    name: "Lay's Classic Salted Chips",
    price: 12,
    mrp: 20,
    imageUrl: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&h=400&fit=crop&q=80",
    unitLabel: "52 g",
    stock: 99,
  },
  {
    id: "deal-dummy-5",
    name: "Nescafe Classic Coffee",
    price: 22,
    mrp: 40,
    imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&h=400&fit=crop&q=80",
    unitLabel: "50 g",
    stock: 99,
  },
  {
    id: "deal-dummy-6",
    name: "Dettol Antiseptic Liquid",
    price: 9,
    mrp: 18,
    imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop&q=80",
    unitLabel: "125 ml",
    stock: 99,
  },
];

const HERO_SLIDES = [
  {
    id: "grocery",
    eyebrow: "Speedza",
    title: "Grocery specials",
    subtitle: "Fresh pantry picks & fast delivery.",
    bg: ["#dbeafe", "#60a5fa", "#1d4ed8"] as const,
    text: "#172554",
    subText: "#1e3a8a",
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

/** 3-column compact main category tiles under “Shop by category” */
const CATEGORY_GRID_GAP = 5;
const CATEGORY_GRID_PAD = 14;
const categoryTileW = (SCREEN_W - CATEGORY_GRID_PAD * 2 - CATEGORY_GRID_GAP * 2) / 3;

function previewMainCategoryImage(m: MainCategory): string | undefined {
  const hit = m.subcategories.find((s) => s.imageUrl?.trim());
  return hit?.imageUrl ? resolveMediaUrl(hit.imageUrl) ?? undefined : undefined;
}

/** Horizontal subcategory tile width (web-style cards) */
const SUB_CARD_W = 104;
const SECTION_PAD = 16;

/** 4 coupon tiles in one row — no horizontal scroll */
const COUPON_ROW_GAP = 6;
const couponTileW = (SCREEN_W - SECTION_PAD * 2 - COUPON_ROW_GAP * 3) / 4;

/** Premium soft diagonal fills (per tile) */
const COUPON_GRADIENTS = [
  ["#eff6ff", "#bfdbfe"] as const,
  ["#ecfdf5", "#a7f3d0"] as const,
  ["#fdf2f8", "#fbcfe8"] as const,
  ["#f8fafc", "#cbd5e1"] as const,
];
const COUPON_BORDER = [
  "rgba(59,130,246,0.38)",
  "rgba(16,185,129,0.4)",
  "rgba(236,72,153,0.36)",
  "rgba(100,116,139,0.42)",
];

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

/** Deals carousel product cards — light lift (compact UI) */
const dealsCardShadow = Platform.select({
  ios: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
  default: {},
});

function heroCategoryKey(slideId: string): string {
  if (slideId === "daily") return "daily-essentials";
  return slideId;
}

function normMainKey(v: string) {
  return v.trim().toLowerCase().replace(/\s+/g, "-");
}

function numPrice(p: unknown): number {
  if (typeof p === "number" && Number.isFinite(p)) return p;
  if (typeof p === "string") {
    const n = parseFloat(p);
    return Number.isFinite(n) ? n : 0;
  }
  return Number(p) || 0;
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
      accent: "#2563eb",
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
  const [sendingList, setSendingList] = useState(false);
  const [offerProducts, setOfferProducts] = useState<ProductHit[]>([]);
  const [dealsNine, setDealsNine] = useState<ProductHit[]>([]);
  const [bestSelling, setBestSelling] = useState<ProductHit[]>([]);

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

      const [nearby, tree, banner, productsA, productsE] = await Promise.all([
        api<{ stores: StoreItem[] }>(
          `/api/stores/nearby?lat=${la}&lng=${ln}&radiusKm=60&limit=30`,
        ),
        api<{ mains: MainCategory[] }>("/api/master/shop-tree"),
        api<{ imageUrl: string | null }>("/api/shop/todays-match-banner"),
        api<{ products: ProductHit[] }>(`/api/shop/search?q=${encodeURIComponent("a")}&limit=50`),
        api<{ products: ProductHit[] }>(`/api/shop/search?q=${encodeURIComponent("e")}&limit=50`),
      ]);

      if (nearby.ok && nearby.data) setStores(nearby.data.stores);
      else setErr(nearby.error || "Could not load stores");

      if (tree.ok && tree.data) setMains(tree.data.mains);
      if (banner.ok && banner.data?.imageUrl?.trim()) {
        setBannerUrl(resolveMediaUrl(banner.data.imageUrl) ?? null);
      } else {
        setBannerUrl(`${getApiBase()}/banners/todays-match.svg`);
      }

      const mergedProducts = [...(productsA.data?.products ?? []), ...(productsE.data?.products ?? [])]
        .filter((p) => (typeof p.stock === "number" ? p.stock > 0 : true))
        .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);

      const offers = mergedProducts
        .filter((p) => numPrice(p.mrp) > 0 && numPrice(p.price) > 0 && numPrice(p.price) < numPrice(p.mrp))
        .sort((a, b) => numPrice(b.mrp) - numPrice(b.price) - (numPrice(a.mrp) - numPrice(a.price)))
        .slice(0, 8);
      setOfferProducts(offers);

      const dealRange = mergedProducts
        .filter((p) => {
          const price = numPrice(p.price);
          return price >= 9 && price <= 30;
        })
        .sort((a, b) => numPrice(a.price) - numPrice(b.price))
        .slice(0, 12);
      setDealsNine(dealRange);

      const best = mergedProducts
        .sort((a, b) => {
          const da = typeof a.discountPercent === "number" ? a.discountPercent : 0;
          const db = typeof b.discountPercent === "number" ? b.discountPercent : 0;
          if (db !== da) return db - da;
          return numPrice(a.price) - numPrice(b.price);
        })
        .slice(0, 12);
      setBestSelling(best);
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

  async function uploadListFromHome() {
    const token = await getToken();
    if (!token) {
      Alert.alert("Sign in required", "Please login first, then upload your grocery list photo.");
      router.push("/login");
      return;
    }

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
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setSendingList(true);
    try {
      const imageUri = result.assets[0].uri;
      const ext = imageUri.split(".").pop()?.toLowerCase() || "jpg";
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const fd = new FormData();
      fd.append("file", { uri: imageUri, name: `list.${ext}`, type: mime } as any);

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

      const addr = await api<{ address: { address: string } | null }>("/api/user/address");
      const createRes = await api("/api/list-requests", {
        method: "POST",
        body: JSON.stringify({
          imageUrl: upJson.imageUrl,
          note: "",
          address: addr.ok && addr.data?.address?.address ? addr.data.address.address : "",
        }),
      });
      if (!createRes.ok) {
        Alert.alert("Request failed", createRes.error || "Could not create request");
        return;
      }

      Alert.alert(
        "List sent",
        "Admin received your grocery list photo. You can track status in Account.",
        [
          { text: "OK" },
          { text: "Open Account", onPress: () => router.push("/account") },
        ],
      );
    } finally {
      setSendingList(false);
    }
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

        {false ? (
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#22c55e" }} />
              <Text style={{ fontSize: 10, fontWeight: "700", color: theme.textMuted, letterSpacing: 0.2 }}>
                Live
              </Text>
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
          {/* Temporarily hidden upload card. Keep this block for quick re-enable later.
          <Pressable
            onPress={() => void uploadListFromHome()}
            style={{
              marginTop: 12,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: "#fca5a5",
              backgroundColor: "#7f1d1d",
              paddingHorizontal: 15,
              paddingVertical: 14,
              gap: 12,
              ...bannerCardShadow,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    backgroundColor: "rgba(255,255,255,0.14)",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.18)",
                  }}
                >
                  <MaterialCommunityIcons name="file-image-plus-outline" size={24} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: -0.2 }}>
                    Upload Your Grocery List
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.86)", fontWeight: "700", fontSize: 11.5, marginTop: 3, lineHeight: 16 }}>
                    Send your written list photo and get your order delivered fast.
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#fff" />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
                <MaterialCommunityIcons name="camera-outline" size={14} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 10.5 }}>Photo upload</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
                <MaterialCommunityIcons name="truck-fast-outline" size={14} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 10.5 }}>Home delivery</Text>
              </View>
            </View>
            <View style={{ marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 10, paddingVertical: 9 }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11, letterSpacing: 0.3 }}>
                How it works
              </Text>
              <Text style={{ marginTop: 4, color: "rgba(255,255,255,0.9)", fontWeight: "700", fontSize: 10.5, lineHeight: 15 }}>
                1) Upload photo  •  2) Admin reviews list  •  3) Groceries delivered to your home
              </Text>
            </View>
            <View style={{ marginTop: 12, borderRadius: 14, overflow: "hidden" }}>
              <LinearGradient
                colors={sendingList ? ["#9ca3af", "#6b7280"] : ["#ffffff", "#ffe4e6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
              >
                {sendingList ? (
                  <ActivityIndicator size="small" color="#111827" />
                ) : (
                  <MaterialCommunityIcons name="cloud-upload-outline" size={18} color="#7f1d1d" />
                )}
                <Text style={{ color: sendingList ? "#111827" : "#7f1d1d", fontWeight: "900", fontSize: 13 }}>
                  {sendingList ? "Uploading..." : "Upload now"}
                </Text>
              </LinearGradient>
            </View>
          </Pressable>
          */}
          </View>
        ) : null}

        <View style={{ marginTop: 12, marginHorizontal: 16, marginBottom: 14, borderRadius: 20, ...bannerCardShadow }}>
          <View style={{ borderRadius: 20, overflow: "hidden", backgroundColor: slide.bg[1] }}>
            <LinearGradient
              colors={[slide.bg[0], slide.bg[1], slide.bg[2]]}
              locations={[0, 0.52, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ paddingTop: 14, paddingBottom: 12, paddingHorizontal: 14 }}
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

        <View style={{ marginTop: 6, marginBottom: 8 }}>
          <View style={{ paddingHorizontal: SECTION_PAD, marginBottom: 18 }}>
            <Text style={{ fontSize: 15, fontWeight: "900", color: theme.text, marginBottom: 8, letterSpacing: -0.3 }}>
              Coupons & Offers
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: COUPON_ROW_GAP,
                paddingTop: 0,
                paddingBottom: 2,
                alignItems: "stretch",
              }}
            >
              {[50, 100, 150, 200].map((off, idx) => {
                const g = COUPON_GRADIENTS[idx % 4];
                const borderC = COUPON_BORDER[idx % 4];
                const accent = ["#1e3a8a", "#14532d", "#831843", "#334155"][idx % 4];
                const accentMuted = ["#1d4ed8", "#166534", "#9d174d", "#475569"][idx % 4];
                return (
                <LinearGradient
                  key={`coupon-${off}`}
                  colors={[...g]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: couponTileW,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: borderC,
                    paddingVertical: 7,
                    paddingHorizontal: 4,
                    alignItems: "center",
                    overflow: "hidden",
                    ...subCardShadow,
                  }}
                >
                  <Image
                    source={require("../../assets/discount.png")}
                    style={{ width: 22, height: 22, marginBottom: 3 }}
                    contentFit="contain"
                  />
                  <Text
                    style={{
                      color: accent,
                      fontSize: 7.5,
                      fontWeight: "900",
                      letterSpacing: 0.2,
                      lineHeight: 10,
                    }}
                  >
                    FLAT
                  </Text>
                  <Text
                    style={{
                      color: accentMuted,
                      fontSize: couponTileW < 72 ? 11 : 12,
                      lineHeight: couponTileW < 72 ? 14 : 15,
                      fontWeight: "900",
                      marginTop: 2,
                      textAlign: "center",
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    ₹{off}
                    <Text style={{ color: accent, fontSize: couponTileW < 72 ? 8 : 9, fontWeight: "900" }}> OFF</Text>
                  </Text>
                  <View
                    style={{
                      marginTop: 4,
                      borderRadius: 999,
                      backgroundColor: "#0a0a0a",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.12)",
                      paddingHorizontal: 4,
                      paddingVertical: 3,
                      alignSelf: "stretch",
                    }}
                  >
                    <Text
                      style={{ color: "#ffffff", fontSize: 8, fontWeight: "800", lineHeight: 11, textAlign: "center" }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      above ₹{idx === 0 ? 59 : idx === 1 ? 119 : idx === 2 ? 179 : 239}
                    </Text>
                  </View>
                </LinearGradient>
                );
              })}
            </View>

            <ScrollView
              horizontal
              style={{ marginTop: 8 }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: 6,
                paddingTop: 0,
                paddingBottom: 0,
                alignItems: "center",
              }}
            >
              {offerProducts.slice(0, 4).map((p, i) => {
                const price = numPrice(p.price);
                const mrp = numPrice(p.mrp);
                const save = Math.max(0, Math.round(mrp - price));
                return (
                  <Pressable
                    key={`offer-${p.id}`}
                    onPress={() => router.push(`/product/${p.id}` as Href)}
                    style={{
                      width: 188,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#e2e8f0",
                      backgroundColor: "#f8fafc",
                      paddingVertical: 6,
                      paddingHorizontal: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      ...subCardShadow,
                    }}
                  >
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          backgroundColor: "#eff6ff",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: "#dbeafe",
                        }}
                      >
                        <MaterialCommunityIcons name={i % 2 === 0 ? "wallet-giftcard" : "credit-card-outline"} size={14} color="#1d4ed8" />
                      </View>
                      <View style={{ flex: 1, paddingVertical: 0 }}>
                        <Text numberOfLines={2} style={{ color: "#0f172a", fontWeight: "900", fontSize: 10.5, lineHeight: 13 }}>
                          Flat ₹{save} off on orders above ₹{Math.max(99, Math.round(price))}
                        </Text>
                        <Text numberOfLines={1} style={{ color: "#334155", fontWeight: "700", fontSize: 8.5, marginTop: 1, lineHeight: 11 }}>
                          Use code: {i % 2 === 0 ? "TRYSPEEDZA" : "SPEEDZAFAST"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
            </ScrollView>
          </View>

          <View style={{ paddingHorizontal: SECTION_PAD, marginBottom: 14, marginTop: 4, alignItems: "center" }}>
            {/* Wider than section inset — extra bleed vs coupons row so heading uses more horizontal space */}
            <View
              style={{
                width: SCREEN_W - SECTION_PAD * 2 + 44,
                marginHorizontal: -22,
                alignSelf: "center",
                alignItems: "center",
              }}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.9}
                style={{
                  fontSize: 17,
                  fontWeight: "800",
                  color: "#1D6B32",
                  letterSpacing: 0.12,
                  lineHeight: 20,
                  textAlign: "center",
                  textTransform: "uppercase",
                  width: "100%",
                }}
              >
                Deals starting at ₹9
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.9}
                style={{
                  marginTop: 3,
                  fontSize: 11,
                  color: "#545E6B",
                  fontWeight: "400",
                  textAlign: "center",
                  lineHeight: 14,
                  width: "100%",
                }}
              >
                Add Any 5 Items
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{
                marginTop: 10,
                marginHorizontal: -SECTION_PAD,
                paddingHorizontal: SECTION_PAD,
                paddingVertical: 10,
                backgroundColor: "#f0fdf4",
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#dcfce7",
              }}
              contentContainerStyle={{ gap: 8, alignItems: "stretch", paddingRight: 2 }}
            >
              <View
                style={{
                  width: 92,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "#bbf7d0",
                  backgroundColor: "#ecfdf5",
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: 168,
                  ...bannerCardShadow,
                }}
              >
                <Text
                  numberOfLines={3}
                  style={{
                    color: "#0f172a",
                    fontSize: 9,
                    fontWeight: "900",
                    letterSpacing: 0.45,
                    textAlign: "center",
                    lineHeight: 11,
                  }}
                >
                  BEST OF ALL
                </Text>
                <View
                  style={{
                    marginTop: 8,
                    backgroundColor: "#166534",
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 70,
                    ...Platform.select({
                      ios: {
                        shadowColor: "#14532d",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.28,
                        shadowRadius: 4,
                      },
                      android: { elevation: 3 },
                      default: {},
                    }),
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "900", letterSpacing: 0.45 }}>DEALS</Text>
                </View>
              </View>
              {DEALS_CAROUSEL_DUMMY.map((p) => {
                const img = resolveMediaUrl(p.imageUrl ?? undefined);
                const price = numPrice(p.price);
                const mrp = numPrice(p.mrp);
                const offAmt = Math.max(0, Math.round(mrp - price));
                return (
                  <Pressable
                    key={`deal-${p.id}`}
                    onPress={() => {
                      if (p.id.startsWith("deal-dummy-")) {
                        Alert.alert("Demo product", "Yeh abhi sample product hai. Real deals jald hi catalog se aayenge.");
                        return;
                      }
                      router.push(`/product/${p.id}` as Href);
                    }}
                    style={{
                      width: 138,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "#eef2f6",
                      backgroundColor: theme.bgElevated,
                      overflow: "hidden",
                      ...dealsCardShadow,
                    }}
                  >
                    <View style={{ height: 96, backgroundColor: "#f8fafc", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
                      {img ? <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                      <View style={{ position: "absolute", right: 6, bottom: 6 }}>
                        <View
                          style={{
                            width: 32,
                            height: 28,
                            borderRadius: 10,
                            backgroundColor: "#fff",
                            borderWidth: 1,
                            borderColor: "#fda4af",
                            alignItems: "center",
                            justifyContent: "center",
                            ...Platform.select({
                              ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
                              android: { elevation: 2 },
                              default: {},
                            }),
                          }}
                        >
                          <MaterialCommunityIcons name="plus" size={18} color="#e11d48" />
                        </View>
                      </View>
                    </View>
                    <View style={{ paddingHorizontal: 8, paddingTop: 7, paddingBottom: 9 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
                        <View style={{ borderRadius: 8, backgroundColor: "#16a34a", paddingHorizontal: 7, paddingVertical: 3 }}>
                          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14, letterSpacing: 0.15 }}>₹{Math.round(price)}</Text>
                        </View>
                        {mrp > price ? (
                          <Text style={{ color: "#94a3b8", fontWeight: "700", fontSize: 11, textDecorationLine: "line-through" }}>₹{Math.round(mrp)}</Text>
                        ) : null}
                      </View>
                      {offAmt > 0 ? (
                        <>
                          <Text style={{ color: "#15803d", fontWeight: "900", fontSize: 12, marginTop: 4 }}>₹{offAmt} OFF</Text>
                          <View
                            style={{
                              marginTop: 5,
                              borderTopWidth: 1,
                              borderColor: "rgba(148,163,184,0.55)",
                              borderStyle: "dashed",
                              width: "100%",
                            }}
                          />
                        </>
                      ) : null}
                      <Text numberOfLines={2} ellipsizeMode="tail" style={{ color: theme.text, fontWeight: "800", fontSize: 12, lineHeight: 15, marginTop: 6 }}>
                        {p.name}
                      </Text>
                      {!!p.unitLabel && (
                        <Text numberOfLines={1} style={{ color: theme.textMuted, fontWeight: "600", fontSize: 10, marginTop: 3 }}>
                          {p.unitLabel}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={{ paddingHorizontal: SECTION_PAD, marginBottom: 16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 0 }}>
              {bestSelling.slice(0, 8).map((p) => {
                const img = resolveMediaUrl(p.imageUrl ?? undefined);
                const price = numPrice(p.price);
                const mrp = numPrice(p.mrp);
                return (
                  <Pressable
                    key={`best-${p.id}`}
                    onPress={() => router.push(`/product/${p.id}` as Href)}
                    style={{
                      width: 150,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#e8eef5",
                      backgroundColor: theme.bgElevated,
                      overflow: "hidden",
                      ...subCardShadow,
                    }}
                  >
                    <View style={{ height: 96, backgroundColor: "#f8fafc", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
                      {img ? <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                    </View>
                    <View style={{ padding: 7 }}>
                      <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: "800", color: theme.text, minHeight: 30 }}>
                        {p.name}
                      </Text>
                      <ProductPriceOfferRow
                        compact
                        layout="premiumGrid"
                        sellingPrice={price}
                        mrp={mrp}
                        discountPercent={p.discountPercent}
                        style={{ marginTop: 4 }}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <Text
            style={{
              fontSize: 17,
              fontWeight: "900",
              color: theme.text,
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
              justifyContent: "space-between",
              paddingHorizontal: CATEGORY_GRID_PAD,
              marginBottom: 8,
            }}
          >
            {mains.map((m, i) => {
              const img = previewMainCategoryImage(m);
              const n = m.subcategories.length;
              const subLabel = n === 1 ? "1 subcategory" : `${n} subcategories`;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => openCategory(m.key)}
                  style={{
                    width: categoryTileW,
                    marginBottom: CATEGORY_GRID_GAP,
                  }}
                >
                  <View
                    style={{
                      borderRadius: 12,
                      overflow: "hidden",
                      aspectRatio: 0.88,
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
                        paddingTop: 18,
                        paddingHorizontal: 7,
                        paddingBottom: 6,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "900" }} numberOfLines={2}>
                        {m.name}
                      </Text>
                      <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 9, fontWeight: "700", marginTop: 1 }}>
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
