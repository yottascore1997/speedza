import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { ShopMarketHeader, type ShopHeaderMain } from "@/components/ShopMarketHeader";
import { CategoryPromoBanner } from "@/components/CategoryPromoBanner";
import { CategoryFoodGridAd, isFoodMainCategory } from "@/components/CategoryFoodGridAd";
import { GroceryListUploadCard } from "@/components/GroceryListUploadCard";

const DEFAULT_LAT = 28.4595;
const DEFAULT_LNG = 77.0266;

/** Purple food hero — fixed appetizing decor (pizza, burger, cold drink). */
const FOOD_BANNER_DECOR = {
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=700&h=500&fit=crop&q=85",
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=700&h=500&fit=crop&q=85",
  coldDrink:
    "https://images.unsplash.com/photo-1626115649875-369d62c6281b?w=600&h=600&fit=crop&q=85",
} as const;

/** Premium personal care hub — spa / skincare aesthetic */
const PERSONAL_CARE_HERO = {
  primary:
    "https://images.unsplash.com/photo-1556228578-0d85b1a2d891?auto=format&fit=crop&w=900&h=720&q=88",
} as const;

const personalCareHeroShadow = Platform.select({
  ios: {
    shadowColor: "#4a044e",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
  },
  android: { elevation: 8 },
  default: {},
});

const personalCareTileShadow = Platform.select({
  ios: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
  default: {},
});

function mapMainKeyForCatalog(routeSlug: string): string {
  const s = routeSlug.trim().toLowerCase();
  if (s === "food") return "food-beverages";
  return routeSlug;
}

type CatalogCategory = {
  id: string;
  name: string;
  imageUrl?: string | null;
  products: { imageUrl?: string | null }[];
};

type CatalogRes = {
  mainCategory: { id: string; key: string; name: string } | null;
  categories: CatalogCategory[];
};

type StoreItem = {
  id: string;
  name: string;
  address: string;
  distanceKm: number;
  shopVertical?: string | null;
  imageUrl?: string | null;
  etaMin?: number;
  matchedProducts?: number;
};

/** `/api/shop/food-subcategory-stores` row — same source as food subcategory screen. */
type FoodSubcategoryStoreApi = {
  id: string;
  name: string;
  address: string;
  distanceKm: number;
  imageUrl?: string | null;
  etaMin?: number;
  matchedProducts?: number;
};

async function loadFoodHubStoreRail(
  mainKeyForProducts: string,
  la: number,
  ln: number,
  subs: CatalogCategory[],
): Promise<StoreItem[]> {
  if (subs.length > 0) {
    const results = await Promise.all(
      subs.slice(0, 6).map((sub) =>
        api<{ stores: FoodSubcategoryStoreApi[] }>(
          `/api/shop/food-subcategory-stores?vertical=${encodeURIComponent(mainKeyForProducts)}&lat=${encodeURIComponent(String(la))}&lng=${encodeURIComponent(String(ln))}&limit=24&masterCategoryId=${encodeURIComponent(sub.id)}&subname=${encodeURIComponent(sub.name)}`,
        ),
      ),
    );
    const byId = new Map<string, StoreItem>();
    for (const res of results) {
      if (!res.ok || !res.data?.stores) continue;
      for (const st of res.data.stores) {
        const row: StoreItem = {
          id: st.id,
          name: st.name,
          address: st.address,
          distanceKm: st.distanceKm,
          imageUrl: st.imageUrl ?? null,
          shopVertical: "food",
          etaMin: typeof st.etaMin === "number" ? st.etaMin : undefined,
          matchedProducts: typeof st.matchedProducts === "number" ? st.matchedProducts : undefined,
        };
        const prev = byId.get(st.id);
        if (!prev || row.distanceKm < prev.distanceKm) byId.set(st.id, row);
      }
    }
    const merged = [...byId.values()].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 50);
    if (merged.length > 0) return merged;
  }
  const nearby = await api<{ stores: StoreItem[] }>(
    `/api/stores/nearby?lat=${encodeURIComponent(String(la))}&lng=${encodeURIComponent(String(ln))}&limit=50&vertical=food`,
  );
  return nearby.ok && nearby.data?.stores ? nearby.data.stores : [];
}

function firstPreviewImage(c: CatalogCategory): string | undefined {
  if (c.imageUrl?.trim()) return resolveMediaUrl(c.imageUrl) ?? undefined;
  const hit = c.products.find((p) => p.imageUrl?.trim());
  return hit?.imageUrl ? resolveMediaUrl(hit.imageUrl) ?? undefined : undefined;
}

function isFreshMainCategory(slug: string, title: string): boolean {
  const k = `${slug} ${title}`.toLowerCase().replace(/_/g, "-");
  return (
    k.includes("fresh") ||
    k.includes("fruit") ||
    k.includes("vegetable") ||
    k.includes("fruits-vegetables")
  );
}

function isFashionMainCategory(slug: string, title: string): boolean {
  const k = `${slug} ${title}`.toLowerCase().replace(/_/g, "-");
  return k.includes("fashion") || k.includes("apparel") || k.includes("clothing");
}

function isPersonalCareMainCategory(slug: string, title: string): boolean {
  const k = `${slug} ${title}`.toLowerCase().replace(/_/g, "-");
  return (
    k.includes("personal-care") ||
    k.includes("personal care") ||
    k.includes("personal") ||
    k.includes("beauty") ||
    k.includes("hygiene") ||
    k.includes("grooming") ||
    k.includes("wellness") ||
    k.includes("skincare") ||
    k.includes("skin-care") ||
    k.includes("body care") ||
    k.includes("body-care")
  );
}

function isGroceryListMainCategory(slug: string, title: string): boolean {
  const k = `${slug} ${title}`.toLowerCase().replace(/_/g, "-");
  return k.includes("grocery") || k.includes("daily") || k.includes("essential");
}

type FoodSpotlightProduct = {
  id: string;
  name: string;
  price: unknown;
  mrp?: unknown;
  discountPercent?: number | null;
  imageUrl?: string | null;
  stock?: number;
};

function etaMinutesFromDistanceKm(d: number): number {
  return Math.max(12, Math.min(52, Math.round(10 + d * 2.2)));
}

function storeDeliveryEtaMin(st: StoreItem): number {
  if (typeof st.etaMin === "number" && Number.isFinite(st.etaMin)) return Math.max(10, Math.round(st.etaMin));
  return etaMinutesFromDistanceKm(st.distanceKm);
}

const foodStoreRowShadow = Platform.select({
  ios: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  android: { elevation: 2 },
  default: {},
});

function numPriceFood(p: unknown): number {
  if (typeof p === "number" && Number.isFinite(p)) return p;
  if (typeof p === "string") {
    const n = parseFloat(p);
    return Number.isFinite(n) ? n : 0;
  }
  return Number(p) || 0;
}

function maxFoodDiscountPercent(products: FoodSpotlightProduct[]): number {
  let m = 0;
  for (const p of products) {
    if (typeof p.discountPercent === "number" && p.discountPercent > m) m = p.discountPercent;
    const price = numPriceFood(p.price);
    const mr = numPriceFood(p.mrp);
    if (mr > 0 && price > 0 && price < mr) {
      const pct = Math.round(((mr - price) / mr) * 100);
      if (pct > m) m = pct;
    }
  }
  return m;
}

function maxRupeeSaveOnMenu(products: FoodSpotlightProduct[]): number {
  let m = 0;
  for (const p of products) {
    const price = numPriceFood(p.price);
    const mr = numPriceFood(p.mrp);
    if (mr > 0 && price > 0 && price < mr) m = Math.max(m, Math.round(mr - price));
  }
  return m;
}

function discountPctFoodProduct(p: FoodSpotlightProduct): number {
  if (typeof p.discountPercent === "number" && p.discountPercent > 0) return Math.round(p.discountPercent);
  const price = numPriceFood(p.price);
  const mr = numPriceFood(p.mrp);
  if (mr > 0 && price > 0 && price < mr) return Math.round(((mr - price) / mr) * 100);
  return 0;
}

function foodEmojiForName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("beverage") || n.includes("drink")) return "🥤";
  if (n.includes("burger") || n.includes("sandwich")) return "🍔";
  if (n.includes("pizza")) return "🍕";
  if (n.includes("biryani") || n.includes("rice") || n.includes("meal")) return "🍛";
  if (n.includes("healthy") || n.includes("salad")) return "🥗";
  if (n.includes("breakfast") || n.includes("egg")) return "🍳";
  if (n.includes("dessert") || n.includes("sweet")) return "🍰";
  if (n.includes("snack")) return "🍟";
  return "🍽️";
}

export default function CategoryHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { slug, lat, lng } = useLocalSearchParams<{
    slug: string | string[];
    lat?: string;
    lng?: string;
  }>();

  const s = decodeURIComponent(Array.isArray(slug) ? slug[0] : slug || "grocery");
  const catalogMainKey = mapMainKeyForCatalog(s);
  const la = Number(lat) || DEFAULT_LAT;
  const ln = Number(lng) || DEFAULT_LNG;

  const [mains, setMains] = useState<ShopHeaderMain[]>([]);
  const [data, setData] = useState<CatalogRes | null>(null);
  const [foodStores, setFoodStores] = useState<StoreItem[]>([]);
  const [foodSpotlightProducts, setFoodSpotlightProducts] = useState<FoodSpotlightProduct[]>([]);
  const [personalCareSpotlightProducts, setPersonalCareSpotlightProducts] = useState<FoodSpotlightProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const gap = 8;
  const pad = 16;
  const cell = (width - pad * 2 - gap * 2) / 3;

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [tree, cat] = await Promise.all([
        api<{ mains: ShopHeaderMain[] }>("/api/master/shop-tree"),
        api<CatalogRes>(`/api/master/catalog?mainKey=${encodeURIComponent(catalogMainKey)}`),
      ]);
      if (tree.ok && tree.data?.mains) setMains(tree.data.mains);
      if (cat.ok && cat.data) setData(cat.data);
      else setErr(cat.error || "Could not load categories");

      const displayName = cat.data?.mainCategory?.name ?? s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const shouldLoadFoodStores = isFoodMainCategory(catalogMainKey, displayName);
      setFoodStores([]);
      setFoodSpotlightProducts([]);

      const mainKeyForProducts = cat.data?.mainCategory?.key ?? catalogMainKey;

      if (shouldLoadFoodStores) {
        setPersonalCareSpotlightProducts([]);
        const catalogSubs = cat.data?.categories ?? [];
        const [hubStores, quick] = await Promise.all([
          loadFoodHubStoreRail(mainKeyForProducts, la, ln, catalogSubs),
          api<{ products: FoodSpotlightProduct[] }>(
            `/api/shop/category-quick?vertical=${encodeURIComponent(mainKeyForProducts)}&lat=${encodeURIComponent(String(la))}&lng=${encodeURIComponent(String(ln))}&limit=40`,
          ),
        ]);
        setFoodStores(hubStores);
        if (quick.ok && quick.data?.products) {
          setFoodSpotlightProducts(quick.data.products.filter((p) => (typeof p.stock === "number" ? p.stock > 0 : true)));
        }
      } else if (
        isPersonalCareMainCategory(catalogMainKey, displayName) &&
        !isFreshMainCategory(s, displayName)
      ) {
        const quick = await api<{ products: FoodSpotlightProduct[] }>(
          `/api/shop/category-quick?vertical=${encodeURIComponent(mainKeyForProducts)}&lat=${encodeURIComponent(String(la))}&lng=${encodeURIComponent(String(ln))}&limit=40`,
        );
        if (quick.ok && quick.data?.products) {
          setPersonalCareSpotlightProducts(
            quick.data.products.filter((p) => (typeof p.stock === "number" ? p.stock > 0 : true)),
          );
        } else {
          setPersonalCareSpotlightProducts([]);
        }
      } else {
        setPersonalCareSpotlightProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [catalogMainKey, la, ln, s]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = data?.mainCategory?.name ?? s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const catalogKey = data?.mainCategory?.key ?? s;
  const categories = data?.categories ?? [];
  const showFoodGridAds = isFoodMainCategory(catalogMainKey, title);
  const showFreshTheme = isFreshMainCategory(s, title);
  const showPersonalCarePremium =
    !showFoodGridAds && !showFreshTheme && isPersonalCareMainCategory(catalogMainKey, title);
  const showGroceryListReminder = isGroceryListMainCategory(catalogMainKey, title);
  const foodDisplayStores = foodStores;
  const maxFoodDiscount = maxFoodDiscountPercent(foodSpotlightProducts);
  const maxRupeeSave = maxRupeeSaveOnMenu(foodSpotlightProducts);
  const cuisineBrowseTiles = categories
    .map((c) => ({ category: c, image: firstPreviewImage(c) }))
    .filter((row): row is { category: CatalogCategory; image: string } => Boolean(row.image));
  const collectionTiles = cuisineBrowseTiles.slice(0, 8);
  const promoSpotImage = FOOD_BANNER_DECOR.pizza;
  const foodCanvas = "#fbf3df";
  const freshCanvas = "#eaf7ff";
  const personalCareCanvas = "#faf7fb";
  const pageBg = showFreshTheme ? freshCanvas : showFoodGridAds ? foodCanvas : showPersonalCarePremium ? personalCareCanvas : theme.bg;

  const pcMaxDiscount = maxFoodDiscountPercent(personalCareSpotlightProducts);
  const pcMaxRupeeSave = maxRupeeSaveOnMenu(personalCareSpotlightProducts);
  const personalCareOfferRail = useMemo(() => {
    return [...personalCareSpotlightProducts].sort((a, b) => discountPctFoodProduct(b) - discountPctFoodProduct(a));
  }, [personalCareSpotlightProducts]);
  const pcCardW = Math.max(108, Math.min(132, Math.round((width - 52) / 2.65)));
  const pcImgH = Math.round(pcCardW * 0.82);
  const pcSearchSeed = title.trim().length >= 2 ? title.trim() : "care";

  function openSub(sub: CatalogCategory) {
    const href =
      `/category/${encodeURIComponent(s)}/${encodeURIComponent(sub.id)}?lat=${encodeURIComponent(String(la))}&lng=${encodeURIComponent(String(ln))}&catalogKey=${encodeURIComponent(catalogKey)}&subname=${encodeURIComponent(sub.name)}` as Href;
    router.push(href);
  }

  function goCategory(key: string) {
    const href =
      `/category/${encodeURIComponent(key)}?lat=${encodeURIComponent(String(la))}&lng=${encodeURIComponent(String(ln))}` as Href;
    router.replace(href);
  }

  function orderNowFromBanner() {
    if (categories.length > 0) openSub(categories[0]);
    else router.push({ pathname: "/search", params: { q: title } } as Href);
  }

  return (
    <View style={{ flex: 1, backgroundColor: pageBg }}>
      <ShopMarketHeader
        safeTop={insets.top}
        mains={mains}
        activeKey={s}
        onShopPress={() => router.replace("/")}
        onCategoryPress={goCategory}
      />

      {err && !loading ? (
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 8,
            padding: 12,
            borderRadius: 12,
            backgroundColor: theme.roseBg,
            borderWidth: 1,
            borderColor: theme.roseBorder,
          }}
        >
          <Text style={{ color: theme.roseText, fontWeight: "600" }}>{err}</Text>
        </View>
      ) : null}

      {loading && !data ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingBottom: 24 + insets.bottom,
            paddingHorizontal: pad,
            paddingTop: showFoodGridAds ? 8 : showPersonalCarePremium ? 10 : 4,
            backgroundColor: pageBg,
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={theme.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {showFreshTheme ? (
            <View
              style={{
                marginBottom: 12,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "#bae6fd",
                overflow: "hidden",
                backgroundColor: "#dff3ff",
              }}
            >
              <View style={{ alignItems: "center", paddingTop: 14, paddingBottom: 8 }}>
                <Text style={{ color: "#047857", fontSize: 46, fontWeight: "900", letterSpacing: -0.7 }}>Fresh</Text>
                <Text style={{ color: "#0e7490", fontSize: 15, fontWeight: "900", marginTop: -2 }}>
                  Fruits & Vegetables
                </Text>
              </View>
              <View style={{ paddingHorizontal: 10, paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                {["Veggies", "Fruits", "Mangoes & Melons", "New Launches"].map((x) => (
                  <View
                    key={x}
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      backgroundColor: "#ffffff",
                      borderWidth: 1,
                      borderColor: "#dbeafe",
                      paddingVertical: 8,
                      paddingHorizontal: 8,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#0f172a", fontSize: 11, fontWeight: "800", textAlign: "center" }} numberOfLines={2}>
                      {x}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : showFoodGridAds ? (
            <View style={{ marginBottom: 18 }}>
              <View
                style={{
                  borderRadius: 26,
                  overflow: "hidden",
                  backgroundColor: "#2e1065",
                  elevation: 6,
                  shadowColor: "#1e1b4b",
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.35,
                  shadowRadius: 20,
                }}
              >
                <LinearGradient
                  colors={["#1e1b4b", "#4c1d95", "#5b21b6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ minHeight: 194, padding: 18 }}
                >
                  <Image
                    source={{ uri: FOOD_BANNER_DECOR.burger }}
                    style={{ position: "absolute", right: -10, top: 22, width: 164, height: 132, borderRadius: 24 }}
                    contentFit="cover"
                  />
                  <Image
                    source={{ uri: FOOD_BANNER_DECOR.pizza }}
                    style={{ position: "absolute", right: 82, bottom: 13, width: 132, height: 88, borderRadius: 22 }}
                    contentFit="cover"
                  />
                  <Image
                    source={{ uri: FOOD_BANNER_DECOR.coldDrink }}
                    style={{ position: "absolute", right: 0, bottom: 9, width: 88, height: 78, borderRadius: 18 }}
                    contentFit="cover"
                  />
                  <View style={{ width: "52%" }}>
                    <Text style={{ color: "#c4b5fd", fontSize: 10, fontWeight: "900", letterSpacing: 0.9 }}>UP TO</Text>
                    <Text style={{ color: "#ffffff", fontSize: 36, lineHeight: 38, fontWeight: "900", letterSpacing: -1 }}>
                      {maxFoodDiscount >= 5 ? `${Math.round(maxFoodDiscount)}% OFF` : "MENU DEALS"}
                    </Text>
                    {maxRupeeSave > 0 ? (
                      <Text style={{ color: "#f5f3ff", fontSize: 14, fontWeight: "900", marginTop: 5 }}>Save up to ₹{maxRupeeSave}</Text>
                    ) : (
                      <Text style={{ color: "#f5f3ff", fontSize: 14, fontWeight: "900", marginTop: 5 }}>From nearby kitchens</Text>
                    )}
                    <Text style={{ color: "#ddd6fe", fontSize: 11.5, fontWeight: "800", marginTop: 6 }}>Picked from live catalog prices</Text>
                    {foodDisplayStores.length > 0 ? (
                      <Text style={{ color: "#e9d5ff", fontSize: 10.5, fontWeight: "800", marginTop: 16 }}>
                        {foodDisplayStores.length} restaurant{foodDisplayStores.length === 1 ? "" : "s"} near you
                      </Text>
                    ) : null}
                    <Pressable
                      onPress={orderNowFromBanner}
                      style={{ marginTop: 13, alignSelf: "flex-start", borderRadius: 10, backgroundColor: "#ffffff", paddingHorizontal: 15, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}
                    >
                      <Text style={{ color: "#1e1b4b", fontSize: 11, fontWeight: "900" }}>Order Now</Text>
                      <MaterialCommunityIcons name="arrow-right" size={15} color="#1e1b4b" />
                    </Pressable>
                  </View>
                  <View style={{ position: "absolute", right: 18, top: 18, width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.95)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" }}>
                    <Text style={{ color: "#4c1d95", fontSize: 10, fontWeight: "900", textAlign: "center" }}>
                      FREE{"\n"}DELIVERY
                    </Text>
                  </View>
                </LinearGradient>
              </View>

              <View style={{ marginTop: 14, borderRadius: 16, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#fee2e2", flexDirection: "row", paddingVertical: 12 }}>
                {[
                  { icon: "lightning-bolt" as const, title: "Lightning", sub: foodDisplayStores.length ? `${foodDisplayStores.length} kitchens nearby` : "Stores on Speedza", color: "#f59e0b" },
                  { icon: "brightness-percent" as const, title: "Live offers", sub: foodSpotlightProducts.length ? `${foodSpotlightProducts.length} dishes in range` : "Browse menus", color: "#f97316" },
                  { icon: "shield-star" as const, title: "Speedza One", sub: "Free delivery", color: "#111827" },
                  { icon: "cash" as const, title: "Fair prices", sub: "From partner stores", color: "#22c55e" },
                ].map((item, index) => (
                  <View key={item.title} style={{ flex: 1, alignItems: "center", borderLeftWidth: index === 0 ? 0 : 1, borderLeftColor: "#f1f5f9", paddingHorizontal: 4 }}>
                    <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
                    <Text numberOfLines={1} style={{ marginTop: 5, color: "#111827", fontSize: 10, fontWeight: "900" }}>{item.title}</Text>
                    <Text numberOfLines={1} style={{ marginTop: 2, color: "#64748b", fontSize: 8, fontWeight: "700" }}>{item.sub}</Text>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Browse menus</Text>
                  <Pressable onPress={() => router.push({ pathname: "/search", params: { q: title } } as Href)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ color: "#334155", fontSize: 12, fontWeight: "800" }}>See All</Text>
                    <MaterialCommunityIcons name="arrow-right" size={15} color="#334155" />
                  </Pressable>
                </View>
                {cuisineBrowseTiles.length === 0 ? (
                  <Text style={{ color: "#64748b", fontSize: 13, fontWeight: "700", paddingVertical: 8 }}>Categories will appear when the catalog is ready.</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -pad, paddingHorizontal: pad }} contentContainerStyle={{ gap: 14, paddingRight: 18 }}>
                    {cuisineBrowseTiles.map((row) => (
                      <Pressable key={row.category.id} onPress={() => openSub(row.category)} style={{ width: 72, alignItems: "center" }}>
                        <View style={{ width: 64, height: 64, borderRadius: 32, overflow: "hidden", backgroundColor: "#fee2e2" }}>
                          <Image source={{ uri: row.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                        </View>
                        <Text numberOfLines={1} style={{ marginTop: 8, color: "#111827", fontSize: 10, fontWeight: "800", textAlign: "center" }}>
                          {row.category.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={{ flexDirection: "row", gap: 12, marginTop: 22 }}>
                <Pressable onPress={orderNowFromBanner} style={{ flex: 1, borderRadius: 20, backgroundColor: "#fed7aa", padding: 15, minHeight: 126, overflow: "hidden", elevation: 3 }}>
                  {promoSpotImage ? (
                    <Image source={{ uri: promoSpotImage }} style={{ position: "absolute", right: -10, bottom: -6, width: 116, height: 98, borderRadius: 20 }} contentFit="cover" />
                  ) : null}
                  <LinearGradient colors={["#fed7aa", "rgba(254,215,170,0.3)"]} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "70%" }} />
                  <Text style={{ color: "#7c2d12", fontSize: 10, fontWeight: "900" }}>FROM CATALOG</Text>
                  <Text style={{ color: "#111827", fontSize: 19, fontWeight: "900", marginTop: 4 }}>
                    {maxFoodDiscount >= 5 ? `Up to ${Math.round(maxFoodDiscount)}% off` : "Top picks near you"}
                  </Text>
                  <Text style={{ color: "#7c2d12", fontSize: 10, fontWeight: "700", marginTop: 3 }}>Live dishes & combos</Text>
                  <View style={{ alignSelf: "flex-start", marginTop: 14, borderRadius: 8, backgroundColor: "#111827", paddingHorizontal: 10, paddingVertical: 7 }}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>Order Now</Text>
                  </View>
                </Pressable>
                <View style={{ flex: 1, borderRadius: 20, backgroundColor: "#ede9fe", padding: 15, minHeight: 126, overflow: "hidden", elevation: 3 }}>
                  <MaterialCommunityIcons name="moped" size={82} color="#f97316" style={{ position: "absolute", right: -4, bottom: 4, opacity: 0.8 }} />
                  <Text style={{ color: "#4c1d95", fontSize: 10, fontWeight: "900" }}>SPEEDZA ONE</Text>
                  <Text style={{ color: "#111827", fontSize: 14, lineHeight: 18, fontWeight: "900", marginTop: 4 }}>Unlimited FREE Delivery</Text>
                  <Text style={{ color: "#4c1d95", fontSize: 10, fontWeight: "700", marginTop: 3 }}>+ Extra 10% OFF</Text>
                  <View style={{ alignSelf: "flex-start", marginTop: 14, borderRadius: 8, backgroundColor: "#4c1d95", paddingHorizontal: 10, paddingVertical: 7 }}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>Join Now</Text>
                  </View>
                </View>
              </View>

              <View style={{ marginTop: 22 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Collections</Text>
                  <Pressable onPress={() => router.push({ pathname: "/search", params: { q: title } } as Href)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ color: "#334155", fontSize: 12, fontWeight: "800" }}>See All</Text>
                    <MaterialCommunityIcons name="arrow-right" size={15} color="#334155" />
                  </Pressable>
                </View>
                {collectionTiles.length === 0 ? (
                  <Text style={{ color: "#64748b", fontSize: 13, fontWeight: "700", paddingVertical: 8 }}>Collections use your live menu categories.</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -pad, paddingHorizontal: pad }} contentContainerStyle={{ gap: 12, paddingRight: 18 }}>
                    {collectionTiles.map((row) => (
                      <Pressable key={row.category.id} onPress={() => openSub(row.category)} style={{ width: 172, height: 96, borderRadius: 14, overflow: "hidden" }}>
                        <Image source={{ uri: row.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                        <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
                        <Text numberOfLines={1} style={{ position: "absolute", left: 10, bottom: 10, right: 10, color: "#fff", fontSize: 13, fontWeight: "900" }}>
                          {row.category.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={{ marginTop: 22 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Best Restaurants Near You</Text>
                  <Pressable onPress={() => router.push({ pathname: "/search", params: { q: title } } as Href)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ color: "#334155", fontSize: 12, fontWeight: "800" }}>See All</Text>
                    <MaterialCommunityIcons name="arrow-right" size={15} color="#334155" />
                  </Pressable>
                </View>
                {foodDisplayStores.length === 0 ? (
                  <Text style={{ color: "#64748b", fontSize: 13, fontWeight: "700", paddingVertical: 8 }}>
                    No food partner stores in range yet. Try widening search or a different pin.
                  </Text>
                ) : (
                  <View style={{ gap: 12 }}>
                    {foodDisplayStores.map((st) => {
                      const img = resolveMediaUrl(st.imageUrl ?? undefined);
                      const eta = storeDeliveryEtaMin(st);
                      const menuCount = typeof st.matchedProducts === "number" && st.matchedProducts > 0 ? st.matchedProducts : null;
                      return (
                        <Pressable
                          key={st.id}
                          onPress={() => router.push(`/store/${st.id}` as Href)}
                          style={{
                            backgroundColor: "#ffffff",
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: "#e2e8f0",
                            overflow: "hidden",
                            ...foodStoreRowShadow,
                          }}
                        >
                          <View style={{ width: "100%", aspectRatio: 2.2, backgroundColor: "#fff1f2" }}>
                            {img ? (
                              <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                            ) : (
                              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 160 }}>
                                <MaterialCommunityIcons name="storefront-outline" size={48} color="#fb7185" />
                              </View>
                            )}
                          </View>
                          <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 }}>
                            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text numberOfLines={2} style={{ color: "#0f172a", fontSize: 17, fontWeight: "900", letterSpacing: -0.35, lineHeight: 22 }}>
                                  {st.name}
                                </Text>
                                <Text numberOfLines={3} style={{ color: "#64748b", fontSize: 13, fontWeight: "600", marginTop: 8, lineHeight: 18 }}>
                                  {st.address}
                                </Text>
                              </View>
                              <MaterialCommunityIcons name="chevron-right" size={22} color="#94a3b8" style={{ marginTop: 2 }} />
                            </View>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe" }}>
                                <MaterialCommunityIcons name="bike-fast" size={16} color="#1d4ed8" />
                                <Text style={{ color: "#1e40af", fontSize: 12, fontWeight: "800" }}>{eta} min delivery</Text>
                              </View>
                              {menuCount ? (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fff7ed", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "#fed7aa" }}>
                                  <MaterialCommunityIcons name="silverware-fork-knife" size={15} color="#c2410c" />
                                  <Text style={{ color: "#9a3412", fontSize: 12, fontWeight: "800" }}>{menuCount}+ dishes</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          ) : showPersonalCarePremium ? (
            <View style={{ marginBottom: 14 }}>
              <View
                style={{
                  borderRadius: 20,
                  overflow: "hidden",
                  backgroundColor: "#2e1065",
                  ...personalCareHeroShadow,
                }}
              >
                <LinearGradient
                  colors={["#0f172a", "#4c1d95", "#831843"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    minHeight: 132,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: "#fae8ff", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }}>PERSONAL CARE</Text>
                    <Text
                      style={{ color: "#ffffff", fontSize: 22, lineHeight: 26, fontWeight: "900", letterSpacing: -0.5, marginTop: 4 }}
                      numberOfLines={2}
                    >
                      {title}
                    </Text>
                    <Text style={{ color: "#fbcfe8", fontSize: 12, fontWeight: "700", marginTop: 6, lineHeight: 16 }} numberOfLines={2}>
                      Daily hygiene & grooming — curated for your routine.
                    </Text>
                    <Pressable
                      onPress={orderNowFromBanner}
                      style={{
                        marginTop: 10,
                        alignSelf: "flex-start",
                        borderRadius: 999,
                        backgroundColor: "#ffffff",
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text style={{ color: "#4c1d95", fontSize: 11, fontWeight: "900" }}>Explore aisles</Text>
                      <MaterialCommunityIcons name="arrow-right" size={15} color="#4c1d95" />
                    </Pressable>
                  </View>
                  <View
                    style={{
                      width: Math.min(118, Math.round(width * 0.3)),
                      height: 108,
                      borderRadius: 16,
                      overflow: "hidden",
                      borderWidth: 2,
                      borderColor: "rgba(255,255,255,0.45)",
                      flexShrink: 0,
                      backgroundColor: "rgba(0,0,0,0.2)",
                    }}
                  >
                    <Image
                      source={{ uri: PERSONAL_CARE_HERO.primary }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      contentPosition="right"
                    />
                  </View>
                </LinearGradient>
              </View>

              <View style={{ marginTop: 14 }}>
                <LinearGradient
                  colors={["#fdf4ff", "#fae8ff", "#fce7f3"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 18,
                    borderWidth: 1.5,
                    borderColor: "#f0abfc",
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    marginBottom: 12,
                    overflow: "hidden",
                    ...personalCareTileShadow,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "#86198f" }}>
                          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.6 }}>LIVE OFFERS</Text>
                        </View>
                        <MaterialCommunityIcons name="brightness-percent" size={20} color="#a21caf" />
                      </View>
                      <Text style={{ marginTop: 8, color: "#4c0519", fontSize: 17, fontWeight: "900", letterSpacing: -0.4 }}>
                        {pcMaxDiscount >= 5 ? `Save up to ${Math.round(pcMaxDiscount)}%` : "Beauty & care deals near you"}
                      </Text>
                      <Text style={{ marginTop: 4, color: "#9d174d", fontSize: 12, fontWeight: "700" }} numberOfLines={2}>
                        {pcMaxRupeeSave > 0
                          ? `Up to ₹${pcMaxRupeeSave} off on MRP on select items · From partner stores`
                          : personalCareSpotlightProducts.length > 0
                            ? `${personalCareSpotlightProducts.length}+ products in stock nearby`
                            : "Browse aisles below for shampoos, soaps & more"}
                      </Text>
                    </View>
                  </View>
                  {categories.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginTop: 12, marginHorizontal: -14, paddingLeft: 14 }}
                      contentContainerStyle={{ gap: 8, paddingRight: 20 }}
                    >
                      {categories.slice(0, 8).map((c) => (
                        <Pressable
                          key={`pc-chip-${c.id}`}
                          onPress={() => openSub(c)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 999,
                            backgroundColor: "#ffffff",
                            borderWidth: 1,
                            borderColor: "#e9d5ff",
                          }}
                        >
                          <Text style={{ color: "#581c87", fontSize: 11, fontWeight: "900" }} numberOfLines={1}>
                            {c.name}
                          </Text>
                        </Pressable>
                      ))}
                      <Pressable
                        onPress={() => router.push({ pathname: "/search", params: { q: pcSearchSeed } } as Href)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 999,
                          backgroundColor: "#86198f",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>Search all</Text>
                        <MaterialCommunityIcons name="magnify" size={16} color="#fff" />
                      </Pressable>
                    </ScrollView>
                  ) : null}
                </LinearGradient>

                {personalCareOfferRail.length > 0 ? (
                  <>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                        paddingHorizontal: 2,
                      }}
                    >
                      <View>
                        <Text style={{ color: "#0f172a", fontSize: 18, fontWeight: "900", letterSpacing: -0.3 }}>Top picks for you</Text>
                        <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "600", marginTop: 3 }}>Real products · live prices</Text>
                      </View>
                      <Pressable
                        onPress={() => router.push({ pathname: "/search", params: { q: pcSearchSeed } } as Href)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                      >
                        <Text style={{ color: "#7c3aed", fontSize: 12, fontWeight: "900" }}>See all</Text>
                        <MaterialCommunityIcons name="arrow-right" size={16} color="#7c3aed" />
                      </Pressable>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginHorizontal: -pad, paddingHorizontal: pad }}
                      contentContainerStyle={{ gap: 10, paddingRight: 24, paddingBottom: 4 }}
                    >
                      {personalCareOfferRail.slice(0, 14).map((p) => {
                        const img = resolveMediaUrl(p.imageUrl ?? undefined);
                        const price = numPriceFood(p.price);
                        const mrp = numPriceFood(p.mrp);
                        const off = discountPctFoodProduct(p);
                        return (
                          <Pressable
                            key={p.id}
                            onPress={() => router.push(`/product/${p.id}` as Href)}
                            style={{
                              width: pcCardW,
                              borderRadius: 18,
                              backgroundColor: "#ffffff",
                              borderWidth: 1,
                              borderColor: "#f3e8ff",
                              overflow: "hidden",
                              ...personalCareTileShadow,
                            }}
                          >
                            <View style={{ height: pcImgH, backgroundColor: "#faf5ff", position: "relative" }}>
                              {img ? (
                                <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                              ) : (
                                <View
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <MaterialCommunityIcons name="bottle-tonic-outline" size={36} color="#d8b4fe" />
                                </View>
                              )}
                              {off > 0 ? (
                                <View
                                  style={{
                                    position: "absolute",
                                    left: 8,
                                    top: 8,
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 8,
                                    backgroundColor: "#be185d",
                                  }}
                                >
                                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>{off}% OFF</Text>
                                </View>
                              ) : null}
                            </View>
                            <View style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
                              <Text
                                numberOfLines={2}
                                style={{
                                  color: "#0f172a",
                                  fontSize: 11.5,
                                  fontWeight: "800",
                                  lineHeight: 14.5,
                                  minHeight: 29,
                                }}
                              >
                                {p.name}
                              </Text>
                              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                <Text style={{ color: "#0f172a", fontWeight: "900", fontSize: 15 }}>₹{Math.round(price)}</Text>
                                {mrp > price ? (
                                  <Text
                                    style={{
                                      color: "#94a3b8",
                                      fontWeight: "700",
                                      fontSize: 11,
                                      textDecorationLine: "line-through",
                                    }}
                                  >
                                    ₹{Math.round(mrp)}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </>
                ) : null}
              </View>
            </View>
          ) : (
            <CategoryPromoBanner
              categorySlug={s}
              categoryName={title}
              onOrderNow={orderNowFromBanner}
            />
          )}

          {showGroceryListReminder ? (
            <GroceryListUploadCard variant="compact" style={{ marginBottom: 14 }} />
          ) : null}

          {!showFoodGridAds ? (
            <>
              {showPersonalCarePremium ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: "#86198f", fontSize: 10, fontWeight: "900", letterSpacing: 1.35 }}>SHOP BY AISLE</Text>
                  <Text style={{ color: "#0f172a", fontSize: 22, fontWeight: "900", letterSpacing: -0.45, marginTop: 6 }}>{title}</Text>
                  <Text style={{ color: "#64748b", fontSize: 13, fontWeight: "600", marginTop: 6, lineHeight: 18 }}>
                    Tap a category to browse products from nearby stores.
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 18, fontWeight: "900", color: "#0c0a09", marginBottom: 12 }}>
                  {showFreshTheme ? "Fresh Fruits & Vegetables" : title}
                </Text>
              )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
              {categories.flatMap((c, index) => {
              const img = firstPreviewImage(c);
              const pc = showPersonalCarePremium;
              const tile = (
                <Pressable
                  key={c.id}
                  onPress={() => openSub(c)}
                  style={{ width: cell, alignItems: "center", marginBottom: pc ? 16 : 14 }}
                >
                  <View
                    style={{
                      width: "100%",
                      aspectRatio: 1,
                      borderRadius: showFoodGridAds ? 16 : pc ? 20 : 16,
                      overflow: "hidden",
                      backgroundColor: showFoodGridAds ? "#ffffff" : pc ? "#ffffff" : "#f5f5f4",
                      borderWidth: showFoodGridAds ? 2 : 1,
                      borderColor: showFoodGridAds ? "#facc15" : pc ? "#f3e8ff" : "#e7e5e4",
                      shadowColor: showFoodGridAds ? "#f59e0b" : "#0f172a",
                      shadowOffset: { width: 0, height: pc ? 4 : 2 },
                      shadowOpacity: showFoodGridAds ? 0.06 : pc ? 0.07 : 0.04,
                      shadowRadius: pc ? 12 : 6,
                      elevation: showFoodGridAds ? 2 : pc ? 3 : 1,
                      ...(pc ? personalCareTileShadow : {}),
                    }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <MaterialCommunityIcons
                          name={pc ? "bottle-tonic-outline" : "shopping-outline"}
                          size={pc ? 38 : 36}
                          color={pc ? "#a855f7" : theme.textMuted}
                        />
                      </View>
                    )}
                  </View>
                  {showFoodGridAds ? (
                    <View
                      style={{
                        marginTop: -18,
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "#ffffff",
                        borderWidth: 2,
                        borderColor: "#fde68a",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>{foodEmojiForName(c.name)}</Text>
                    </View>
                  ) : null}
                  <Text
                    numberOfLines={2}
                    style={{
                      marginTop: showFoodGridAds ? 6 : pc ? 10 : 8,
                      textAlign: "center",
                      fontSize: pc ? 12.5 : 12,
                      fontWeight: showFoodGridAds ? "800" : pc ? "800" : "700",
                      color: pc ? "#1e293b" : "#0c0a09",
                      lineHeight: pc ? 16 : 15,
                      paddingHorizontal: 2,
                    }}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              );

              if (!showFoodGridAds || (index + 1) % 9 !== 0) {
                return [tile];
              }

              const adSlot = (index + 1) / 9;
              const adRow = (
                <View
                  key={`food-ad-${c.id}-${adSlot}`}
                  style={{
                    width: "100%",
                    flexBasis: "100%",
                    marginBottom: 14,
                  }}
                >
                  <CategoryFoodGridAd
                    slot={adSlot}
                    onPress={() =>
                      router.push({ pathname: "/search", params: { q: title } } as Href)
                    }
                  />
                </View>
              );
              return [tile, adRow];
              })}
            </View>
            </>
          ) : null}
          {!loading && !showFoodGridAds && categories.length === 0 ? (
            <Text style={{ textAlign: "center", color: theme.textMuted, marginTop: 24, fontWeight: "600" }}>
              No subcategories in this section yet.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
