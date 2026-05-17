import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { CartQtyStepper, type CartQtyStepperLine } from "@/components/CartQtyStepper";
import { QuickGroceryOrderSection } from "@/components/QuickGroceryOrderSection";

const HEADER_SHOP_ACTIVE = "__shop__";

const DEFAULT_LAT = 28.4595;
const DEFAULT_LNG = 77.0266;

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
  categoryName?: string;
  store?: { id: string; name: string };
};

type HeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  bg: readonly [string, string, string];
  text: string;
  subText: string;
  image: string;
};

const { width: SCREEN_W } = Dimensions.get("window");

/** Home product rails — compact tiles so ~2.5–3 cards peek per row */
const HOME_RAIL_CARD_W = Math.max(104, Math.min(124, Math.round((SCREEN_W - 52) / 2.85)));
const HOME_RAIL_IMAGE_H = Math.round(HOME_RAIL_CARD_W * 0.64);
/** Home top banner carousel — full-bleed slides from assets/bg1–bg4 */
const HOME_BANNER_PAD = 12;
const HOME_BANNER_SLIDE_W = SCREEN_W - HOME_BANNER_PAD * 2;
const HOME_BANNER_H = Math.round(HOME_BANNER_SLIDE_W * 0.42);
const HOME_BANNER_ZOOM = 1.14;

const HOME_BANNERS = [
  require("../../assets/bg1.png"),
  require("../../assets/bg2.png"),
  require("../../assets/bg3.png"),
  require("../../assets/bg4.png"),
] as const;

function previewMainCategoryImage(m: MainCategory): string | undefined {
  const hit = m.subcategories.find((s) => s.imageUrl?.trim());
  return hit?.imageUrl ? resolveMediaUrl(hit.imageUrl) ?? undefined : undefined;
}

/** Horizontal subcategory tile width (web-style cards) */
const SUB_CARD_W = 92;
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

function discountPercentForProduct(p: ProductHit): number {
  if (typeof p.discountPercent === "number" && p.discountPercent > 0) return Math.round(p.discountPercent);
  const price = numPrice(p.price);
  const mrp = numPrice(p.mrp);
  if (mrp > 0 && price > 0 && price < mrp) return Math.round(((mrp - price) / mrp) * 100);
  return 0;
}

/** Keep home rails on one store so add-to-cart does not wipe other lines. */
function mergeHomeCatalogProducts(grocery: ProductHit[], search: ProductHit[]): ProductHit[] {
  const inStock = (p: ProductHit) => (typeof p.stock === "number" ? p.stock > 0 : true);
  const groceryList = grocery.filter(inStock);
  const searchList = search.filter(inStock);
  const anchorStoreId = groceryList.find((p) => p.store?.id?.trim())?.store?.id?.trim() ?? null;

  const deduped = [...groceryList, ...searchList].filter(
    (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i,
  );

  if (!anchorStoreId) return deduped;

  const sameStore = deduped.filter((p) => {
    const sid = p.store?.id?.trim();
    return !sid || sid === anchorStoreId;
  });
  return sameStore.length >= 6 ? sameStore : deduped;
}

function cartLineFromProductHit(p: ProductHit): CartQtyStepperLine | null {
  const storeId = p.store?.id?.trim();
  if (!storeId) return null;
  const rawDisc =
    typeof p.discountPercent === "number" && p.discountPercent > 0
      ? p.discountPercent
      : discountPercentForProduct(p);
  return {
    productId: p.id,
    storeId,
    name: p.name,
    price: numPrice(p.price),
    storeName: p.store?.name,
    imageUrl: p.imageUrl ?? null,
    unitLabel: p.unitLabel ?? null,
    mrp: numPrice(p.mrp) > 0 ? numPrice(p.mrp) : null,
    discountPercent: rawDisc > 0 ? rawDisc : null,
  };
}

function homeCategoryIconName(key: string, name: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const k = `${key} ${name}`.toLowerCase();
  if (k.includes("fruit") || k.includes("vegetable") || k.includes("fresh")) return "fruit-cherries";
  if (k.includes("grocery") || k.includes("daily") || k.includes("essential")) return "rice";
  if (k.includes("dairy") || k.includes("bread") || k.includes("egg")) return "bread-slice-outline";
  if (k.includes("beverage") || k.includes("drink")) return "bottle-soda-outline";
  if (k.includes("snack")) return "cookie-outline";
  if (k.includes("personal") || k.includes("beauty") || k.includes("care")) return "bottle-tonic-outline";
  if (k.includes("fashion")) return "tshirt-crew-outline";
  return "dots-grid";
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
  const [mains, setMains] = useState<MainCategory[]>([]);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [offerProducts, setOfferProducts] = useState<ProductHit[]>([]);
  const [dealsNine, setDealsNine] = useState<ProductHit[]>([]);
  const [browseProducts, setBrowseProducts] = useState<ProductHit[]>([]);

  const homeBannerScrollRef = useRef<ScrollView>(null);
  const [homeBannerIndex, setHomeBannerIndex] = useState(0);

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

      const [tree, banner, groceryQuick, searchExtra] = await Promise.all([
        api<{ mains: MainCategory[] }>("/api/master/shop-tree"),
        api<{ imageUrl: string | null }>("/api/shop/todays-match-banner"),
        api<{ products: ProductHit[] }>(
          `/api/shop/category-quick?vertical=${encodeURIComponent("grocery")}&lat=${encodeURIComponent(String(la))}&lng=${encodeURIComponent(String(ln))}&limit=80`,
        ),
        api<{ products: ProductHit[] }>(`/api/shop/search?q=${encodeURIComponent("in")}&limit=40`),
      ]);

      if (tree.ok && tree.data?.mains) {
        setMains(tree.data.mains);
      } else {
        setMains([]);
        if (!tree.ok) setErr(tree.error || "Could not load categories");
      }
      if (banner.ok && banner.data?.imageUrl?.trim()) {
        setBannerUrl(resolveMediaUrl(banner.data.imageUrl) ?? null);
      } else {
        setBannerUrl(`${getApiBase()}/banners/todays-match.svg`);
      }

      const mergedProducts = mergeHomeCatalogProducts(
        groceryQuick.data?.products ?? [],
        searchExtra.data?.products ?? [],
      );
      setBrowseProducts(mergedProducts.slice(0, 40));

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

    } finally {
      setLoading(false);
    }
  }, [resolveCoords]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const heroSlides = useMemo((): HeroSlide[] => {
    const out: HeroSlide[] = [];
    for (const m of mains) {
      const img = previewMainCategoryImage(m);
      if (!img) continue;
      const th = featuredTheme(m.key);
      out.push({
        id: m.key,
        eyebrow: "Speedza",
        title: m.name,
        subtitle: m.subcategories.length ? `${m.subcategories.length} aisles to explore` : "Browse on Speedza",
        image: img,
        bg: th.shell,
        text: th.title,
        subText: th.sub,
      });
    }
    return out;
  }, [mains]);

  const activeHeroSlide = useMemo((): HeroSlide => {
    if (heroSlides.length > 0) return heroSlides[heroIndex % heroSlides.length]!;
    return {
      id: "shop",
      eyebrow: "Speedza",
      title: "Speedza Market",
      subtitle: "Groceries & essentials near you",
      image: bannerUrl ?? `${getApiBase()}/banners/todays-match.svg`,
      bg: ["#dbeafe", "#60a5fa", "#1d4ed8"] as const,
      text: "#172554",
      subText: "#1e3a8a",
    };
  }, [heroSlides, heroIndex, bannerUrl]);

  const flashDealProducts = useMemo(() => {
    if (dealsNine.length > 0) return dealsNine.slice(0, 12);
    const discounted = browseProducts.filter((p) => discountPercentForProduct(p) >= 5);
    if (discounted.length > 0) return discounted.slice(0, 12);
    return browseProducts.slice(0, 12);
  }, [dealsNine, browseProducts]);

  const bestSellingRail = useMemo(() => {
    if (offerProducts.length > 0) return offerProducts.slice(0, 8);
    return browseProducts.slice(0, 8);
  }, [offerProducts, browseProducts]);

  const moreBrowseRail = useMemo(() => browseProducts.slice(8, 20), [browseProducts]);

  useEffect(() => {
    setHeroIndex(0);
  }, [heroSlides.length]);

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const t = setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroSlides.length);
    }, 4500);
    return () => clearInterval(t);
  }, [heroSlides.length]);

  useEffect(() => {
    if (HOME_BANNERS.length <= 1) return;
    const t = setInterval(() => {
      setHomeBannerIndex((prev) => {
        const next = (prev + 1) % HOME_BANNERS.length;
        homeBannerScrollRef.current?.scrollTo({ x: next * HOME_BANNER_SLIDE_W, animated: true });
        return next;
      });
    }, 4200);
    return () => clearInterval(t);
  }, []);

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
          paddingBottom: 36 + insets.bottom,
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void loadAll()} tintColor={theme.brandNavOrange} />
        }
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
      >
        <ShopMarketHeader
          safeTop={insets.top}
          mains={mains}
          activeKey={HEADER_SHOP_ACTIVE}
          onShopPress={() => router.replace("/")}
          onCategoryPress={(key) => openCategory(key)}
        />

        <View
          style={{
            paddingTop: 8,
            paddingHorizontal: HOME_BANNER_PAD,
            paddingBottom: 14,
            backgroundColor: "#ffffff",
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
          }}
        >
          <View
            style={{
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: "#f1f5f9",
              ...bannerCardShadow,
            }}
          >
            <ScrollView
              ref={homeBannerScrollRef}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              bounces={false}
              decelerationRate="fast"
              removeClippedSubviews={false}
              onMomentumScrollEnd={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                const idx = Math.round(x / Math.max(1, HOME_BANNER_SLIDE_W));
                setHomeBannerIndex(Math.max(0, Math.min(idx, HOME_BANNERS.length - 1)));
              }}
              style={{ width: HOME_BANNER_SLIDE_W, height: HOME_BANNER_H }}
            >
              {HOME_BANNERS.map((src, i) => (
                <View
                  key={`home-banner-${i}`}
                  style={{
                    width: HOME_BANNER_SLIDE_W,
                    height: HOME_BANNER_H,
                    overflow: "hidden",
                    backgroundColor: "#f1f5f9",
                  }}
                >
                  <Image
                    source={src}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: HOME_BANNER_SLIDE_W * HOME_BANNER_ZOOM,
                      height: HOME_BANNER_H * HOME_BANNER_ZOOM,
                    }}
                    contentFit="cover"
                    contentPosition="left"
                  />
                </View>
              ))}
            </ScrollView>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: 10,
                left: 0,
                right: 0,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 6,
              }}
            >
              {HOME_BANNERS.map((_, i) => (
                <View
                  key={`home-banner-dot-${i}`}
                  style={{
                    width: i === homeBannerIndex ? 18 : 6,
                    height: 6,
                    borderRadius: 99,
                    backgroundColor: i === homeBannerIndex ? "#ffffff" : "rgba(255,255,255,0.55)",
                  }}
                />
              ))}
            </View>
          </View>

          <View
            style={{
              marginTop: 12,
              borderRadius: 16,
              backgroundColor: "#1e3d2a",
              paddingHorizontal: 6,
              paddingVertical: 8,
              flexDirection: "row",
              justifyContent: "space-between",
              ...bannerCardShadow,
            }}
          >
            {[
              { icon: "truck-fast-outline" as const, title: "10-15 mins", sub: "Fast Delivery" },
              { icon: "brightness-percent" as const, title: "Best Prices", sub: "Everyday" },
              { icon: "shield-check" as const, title: "100% Original", sub: "Products" },
              { icon: "headphones" as const, title: "24x7", sub: "Support" },
            ].map((item, index) => (
              <View
                key={item.title}
                style={{
                  flex: 1,
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  borderLeftWidth: index === 0 ? 0 : 1,
                  borderLeftColor: "rgba(255,255,255,0.18)",
                }}
              >
                <MaterialCommunityIcons name={item.icon} size={19} color="#f4fff0" />
                <View style={{ alignItems: "center" }}>
                  <Text numberOfLines={1} style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{item.title}</Text>
                  <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.76)", fontSize: 7.5, fontWeight: "700" }}>{item.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 12, marginHorizontal: 12, paddingVertical: 4, paddingHorizontal: 0 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 2, alignItems: "flex-start" }}>
            {[...mains.slice(0, 8), { id: "view-all", key: "__all__", name: "View All", subcategories: [] }].map((m) => {
              const img = m.key !== "__all__" ? previewMainCategoryImage(m) : undefined;
              const th = m.key !== "__all__" ? featuredTheme(m.key) : null;
              const ring = m.key === "__all__" ? "#22c55e" : th?.border ?? "#16a34a";
              const softFill = m.key === "__all__" ? "#f0fdf4" : th ? `${String(th.shell[1])}35` : "#f0fdf4";
              return (
                <Pressable
                  key={m.id}
                  onPress={() => (m.key === "__all__" ? router.push("/categories") : openCategory(m.key))}
                  style={{ width: 70, alignItems: "center" }}
                >
                  <View
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 29,
                      padding: 3,
                      backgroundColor: ring,
                      ...Platform.select({
                        ios: {
                          shadowColor: ring,
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.22,
                          shadowRadius: 6,
                        },
                        android: { elevation: 4 },
                        default: {},
                      }),
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 25,
                        backgroundColor: softFill,
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        borderWidth: 1.5,
                        borderColor: "#ffffff",
                      }}
                    >
                      {img ? (
                        <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                      ) : (
                        <MaterialCommunityIcons name={homeCategoryIconName(m.key, m.name)} size={26} color={ring} />
                      )}
                    </View>
                  </View>
                  <Text numberOfLines={2} style={{ marginTop: 6, color: "#0f172a", fontSize: 10.5, lineHeight: 12.5, fontWeight: "900", textAlign: "center" }}>
                    {m.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 18 }}>
          {[
            { title: "Mega Savings\nOn Staples", sub: "Up to 30% OFF", bg: "#fff6d8", color: "#b45309", action: "Shop Now", icon: "rice" as const },
            { title: "Personal Care\nEssentials", sub: "Up to 25% OFF", bg: "#eaf3ff", color: "#1d4ed8", action: "Shop Now", icon: "bottle-tonic-outline" as const },
          ].map((card, idx) => (
            <Pressable
              key={card.title}
              onPress={() => {
                const hit = mains[idx + 1] ?? mains[idx];
                if (hit) openCategory(hit.key);
              }}
              style={{ flex: 1, borderRadius: 19, backgroundColor: card.bg, padding: 14, overflow: "hidden", minHeight: 126, ...subCardShadow }}
            >
              <MaterialCommunityIcons
                name={card.icon}
                size={62}
                color={card.color}
                style={{ position: "absolute", right: -4, bottom: 0, opacity: 0.23 }}
              />
              <Text style={{ color: "#0f172a", fontSize: 13.5, lineHeight: 17, fontWeight: "900" }}>{card.title}</Text>
              <Text style={{ marginTop: 6, color: card.color, fontSize: 11, fontWeight: "900" }}>{card.sub}</Text>
              <View style={{ alignSelf: "flex-start", marginTop: 16, borderRadius: 999, backgroundColor: card.color, paddingHorizontal: 11, paddingVertical: 6 }}>
                <Text style={{ color: "#fff", fontSize: 9.5, fontWeight: "900" }}>{card.action}</Text>
              </View>
            </Pressable>
          ))}
        </View>

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
                source={{ uri: bannerUrl as string }}
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

        <View style={{ marginTop: 6, marginBottom: 8 }}>
          <View style={{ paddingHorizontal: 0, marginBottom: 14, marginTop: 22 }}>
            <View
              style={{
                paddingHorizontal: SECTION_PAD,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <MaterialCommunityIcons name="lightning-bolt" size={20} color="#f59e0b" />
                <Text style={{ color: "#0f172a", fontSize: 18, fontWeight: "900" }}>Flash Deals</Text>
              </View>
              <Pressable onPress={() => router.push("/search" as Href)} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Text style={{ color: "#334155", fontSize: 12, fontWeight: "800" }}>View All</Text>
                <MaterialCommunityIcons name="arrow-right" size={15} color="#334155" />
              </Pressable>
            </View>
            {flashDealProducts.length === 0 ? (
              <Text style={{ paddingHorizontal: SECTION_PAD, color: theme.textMuted, fontWeight: "600", fontSize: 13 }}>
                Deals will show here once products load for your area.
              </Text>
            ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews={false}
              style={{
                marginHorizontal: -SECTION_PAD,
                paddingHorizontal: SECTION_PAD + 16,
                paddingVertical: 4,
              }}
              contentContainerStyle={{ gap: 16, alignItems: "stretch", paddingRight: 20, paddingBottom: 10 }}
            >
              {flashDealProducts.map((p) => {
                const img = resolveMediaUrl(p.imageUrl ?? undefined);
                const price = numPrice(p.price);
                const mrp = numPrice(p.mrp);
                const offAmt = Math.max(0, Math.round(mrp - price));
                const cartLine = cartLineFromProductHit(p);
                return (
                  <View
                    key={`deal-${p.id}`}
                    style={{
                      width: 116,
                      borderRadius: 16,
                      borderWidth: 0,
                      backgroundColor: "#ffffff",
                      overflow: "hidden",
                    }}
                  >
                    <View style={{ height: 96, backgroundColor: "#f8fafc", borderRadius: 15, overflow: "hidden" }}>
                      <Pressable style={{ flex: 1 }} onPress={() => router.push(`/product/${p.id}` as Href)}>
                        {img ? <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                      </Pressable>
                      <View style={{ position: "absolute", right: 6, bottom: 6, zIndex: 2 }}>
                        {cartLine ? (
                          <CartQtyStepper
                            line={cartLine}
                            fabPlus
                            maxQty={typeof p.stock === "number" ? Math.max(0, p.stock) : 999}
                            canAdd={typeof p.stock !== "number" || p.stock > 0}
                          />
                        ) : (
                          <Pressable
                            onPress={() => router.push(`/product/${p.id}` as Href)}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 15,
                              backgroundColor: "#2f9e44",
                              borderWidth: 1,
                              borderColor: "#ffffff",
                              alignItems: "center",
                              justifyContent: "center",
                              ...Platform.select({
                                ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
                                android: { elevation: 2 },
                                default: {},
                              }),
                            }}
                            hitSlop={10}
                          >
                            <MaterialCommunityIcons name="plus" size={19} color="#fff" />
                          </Pressable>
                        )}
                      </View>
                    </View>
                    <Pressable onPress={() => router.push(`/product/${p.id}` as Href)} style={{ paddingHorizontal: 3, paddingTop: 8, paddingBottom: 6 }}>
                      <Text numberOfLines={2} ellipsizeMode="tail" style={{ color: theme.text, fontWeight: "800", fontSize: 11.5, lineHeight: 14.5, minHeight: 29 }}>
                        {p.name}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5, flexWrap: "nowrap", marginTop: 5 }}>
                        <Text style={{ color: "#0f172a", fontWeight: "900", fontSize: 14 }}>₹{Math.round(price)}</Text>
                        {mrp > price ? (
                          <Text style={{ color: "#94a3b8", fontWeight: "700", fontSize: 10.5, textDecorationLine: "line-through" }}>₹{Math.round(mrp)}</Text>
                        ) : null}
                      </View>
                      {offAmt > 0 ? (
                        <Text style={{ color: "#15803d", fontWeight: "900", fontSize: 10.5, marginTop: 3 }}>{Math.round((offAmt / Math.max(mrp, 1)) * 100)}% OFF</Text>
                      ) : null}
                      {!!p.unitLabel && (
                        <Text numberOfLines={1} style={{ color: theme.textMuted, fontWeight: "600", fontSize: 9.5, marginTop: 3 }}>
                          {p.unitLabel}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
            )}
          </View>

          <LinearGradient
            colors={["#f3e8ff", "#ede9fe", "#f5d0fe"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              marginHorizontal: SECTION_PAD,
              marginBottom: 14,
              borderRadius: 22,
              paddingHorizontal: 16,
              paddingVertical: 17,
              overflow: "hidden",
              flexDirection: "row",
              alignItems: "center",
              ...bannerCardShadow,
            }}
          >
            <MaterialCommunityIcons
              name="gift-outline"
              size={86}
              color="#a855f7"
              style={{ position: "absolute", right: 8, bottom: -8, opacity: 0.26, transform: [{ rotate: "12deg" }] }}
            />
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>club</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ color: "#1e1b4b", fontSize: 16, fontWeight: "900" }}>Join Speedza Club</Text>
              <Text numberOfLines={1} style={{ marginTop: 4, color: "#5b21b6", fontSize: 11.5, fontWeight: "700" }}>
                Free delivery · Extra discounts · Early access
              </Text>
            </View>
            <Pressable style={{ borderRadius: 999, backgroundColor: "#111827", paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>Join Now</Text>
            </Pressable>
          </LinearGradient>

          <View
            style={{
              marginHorizontal: SECTION_PAD,
              marginBottom: 14,
              borderRadius: 22,
              overflow: "hidden",
              ...bannerCardShadow,
            }}
          >
            <Image
              source={require("../../assets/dairybg2.png")}
              style={{ width: "100%", aspectRatio: 2 }}
              contentFit="cover"
              contentPosition="left center"
            />
          </View>

          <View style={{ marginBottom: 14 }}>
            <View style={{ paddingHorizontal: SECTION_PAD, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{ color: "#0f172a", fontSize: 18, fontWeight: "900", letterSpacing: -0.2 }}>
                Best Selling Products
              </Text>
              <Pressable onPress={() => router.push("/search" as Href)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ color: "#475569", fontSize: 12, fontWeight: "800" }}>View All</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color="#475569" />
              </Pressable>
            </View>
            {bestSellingRail.length === 0 ? (
              <Text style={{ paddingHorizontal: SECTION_PAD, color: theme.textMuted, fontWeight: "600", fontSize: 13 }}>
                Best sellers will appear from your nearby catalog.
              </Text>
            ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews={false}
              style={{ marginHorizontal: -SECTION_PAD, paddingHorizontal: SECTION_PAD + 10, paddingVertical: 2 }}
              contentContainerStyle={{ gap: 8, paddingRight: 14, paddingBottom: 10, paddingTop: 2 }}
            >
              {bestSellingRail.map((p) => {
                const img = resolveMediaUrl(p.imageUrl ?? undefined);
                const price = numPrice(p.price);
                const disc = discountPercentForProduct(p);
                const cartLine = cartLineFromProductHit(p);
                return (
                  <View
                    key={`best-selling-${p.id}`}
                    style={{
                      width: HOME_RAIL_CARD_W,
                      borderRadius: 14,
                      backgroundColor: "#ffffff",
                      borderWidth: 1,
                      borderColor: "#eef2f6",
                      padding: 8,
                      ...subCardShadow,
                    }}
                  >
                    <Pressable onPress={() => router.push(`/product/${p.id}` as Href)}>
                      <View
                        style={{
                          height: HOME_RAIL_IMAGE_H,
                          borderRadius: 10,
                          backgroundColor: "#f8fafc",
                          overflow: "hidden",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {img ? <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                      </View>
                      {disc > 0 ? (
                        <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-end", gap: 2, marginTop: 4 }}>
                          <MaterialCommunityIcons name="tag-outline" size={10} color="#15803d" />
                          <Text style={{ color: "#15803d", fontSize: 9, fontWeight: "900" }}>{disc}% off</Text>
                        </View>
                      ) : (
                        <View style={{ height: 14, marginTop: 4 }} />
                      )}
                      <Text numberOfLines={2} style={{ marginTop: 3, color: "#0f172a", fontSize: 10.5, lineHeight: 13, fontWeight: "800", minHeight: 26 }}>
                        {p.name}
                      </Text>
                      <Text numberOfLines={1} style={{ color: "#64748b", fontSize: 9.5, fontWeight: "700", marginTop: 2 }}>
                        {p.unitLabel ?? p.store?.name ?? ""}
                      </Text>
                      <Text style={{ color: "#0f172a", fontSize: 13.5, fontWeight: "900", marginTop: 5 }}>₹{Math.round(price)}</Text>
                    </Pressable>
                    <View style={{ marginTop: 7 }}>
                      {cartLine ? (
                        <CartQtyStepper
                          line={cartLine}
                          dense
                          compact
                          maxQty={typeof p.stock === "number" ? Math.max(0, p.stock) : 999}
                          canAdd={typeof p.stock !== "number" || p.stock > 0}
                        />
                      ) : (
                        <Pressable
                          onPress={() => router.push(`/product/${p.id}` as Href)}
                          style={{
                            borderRadius: 10,
                            backgroundColor: "#f1f5f9",
                            paddingVertical: 7,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "800" }}>Open to add</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            )}
          </View>

          <View style={{ marginBottom: 14 }}>
            <View style={{ paddingHorizontal: SECTION_PAD, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{ color: "#0f172a", fontSize: 18, fontWeight: "900", letterSpacing: -0.2 }}>
                More picks for you
              </Text>
              <Pressable onPress={() => router.push("/search" as Href)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ color: "#475569", fontSize: 12, fontWeight: "800" }}>View All</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color="#475569" />
              </Pressable>
            </View>
            {moreBrowseRail.length === 0 ? (
              <Text style={{ paddingHorizontal: SECTION_PAD, color: theme.textMuted, fontWeight: "600", fontSize: 13 }}>
                More products appear as your browse feed fills in.
              </Text>
            ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews={false}
              style={{ marginHorizontal: -SECTION_PAD, paddingHorizontal: SECTION_PAD + 10, paddingVertical: 2 }}
              contentContainerStyle={{ gap: 8, paddingRight: 14, paddingBottom: 10, paddingTop: 2 }}
            >
              {moreBrowseRail.map((p) => {
                const img = resolveMediaUrl(p.imageUrl ?? undefined);
                const price = numPrice(p.price);
                const mrp = numPrice(p.mrp);
                const cartLine = cartLineFromProductHit(p);
                return (
                  <View
                    key={`more-${p.id}`}
                    style={{
                      width: HOME_RAIL_CARD_W,
                      borderRadius: 14,
                      backgroundColor: "#ffffff",
                      borderWidth: 1,
                      borderColor: "#eef2f6",
                      padding: 8,
                      ...subCardShadow,
                    }}
                  >
                    <Pressable onPress={() => router.push(`/product/${p.id}` as Href)}>
                      <View
                        style={{
                          height: HOME_RAIL_IMAGE_H,
                          borderRadius: 10,
                          backgroundColor: "#f8fafc",
                          overflow: "hidden",
                        }}
                      >
                        {img ? <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                      </View>
                      <Text numberOfLines={2} style={{ marginTop: 5, color: "#0f172a", fontSize: 10.5, lineHeight: 13, fontWeight: "800", minHeight: 26 }}>
                        {p.name}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 4 }}>
                        <Text style={{ color: "#0f172a", fontSize: 13.5, fontWeight: "900" }}>₹{Math.round(price)}</Text>
                        {mrp > price ? (
                          <Text style={{ color: "#94a3b8", fontSize: 9.5, fontWeight: "700", textDecorationLine: "line-through" }}>₹{Math.round(mrp)}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                    <View style={{ marginTop: 7 }}>
                      {cartLine ? (
                        <CartQtyStepper
                          line={cartLine}
                          dense
                          compact
                          maxQty={typeof p.stock === "number" ? Math.max(0, p.stock) : 999}
                          canAdd={typeof p.stock !== "number" || p.stock > 0}
                        />
                      ) : (
                        <Pressable
                          onPress={() => router.push(`/product/${p.id}` as Href)}
                          style={{
                            borderRadius: 10,
                            backgroundColor: "#f1f5f9",
                            paddingVertical: 7,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: "#64748b", fontSize: 10, fontWeight: "800" }}>Open to add</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            )}
          </View>

          <View style={{ marginHorizontal: SECTION_PAD, marginBottom: 18 }}>
            <QuickGroceryOrderSection variant="home" />
          </View>

          <View style={{ marginHorizontal: SECTION_PAD, marginBottom: 14, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#eef2f6", paddingVertical: 13, flexDirection: "row" }}>
            {[
              { icon: "shield-check-outline" as const, title: "100% Secure", sub: "Your data is safe with us" },
              { icon: "credit-card-check-outline" as const, title: "Multiple Payments", sub: "UPI, Cards, Wallets & COD" },
              { icon: "headphones" as const, title: "24/7 Support", sub: "We are always here to help" },
            ].map((item, index) => (
              <View key={item.title} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 8, borderLeftWidth: index === 0 ? 0 : 1, borderLeftColor: "#e2e8f0" }}>
                <MaterialCommunityIcons name={item.icon} size={24} color="#2f9e44" />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: "#0f172a", fontSize: 10.5, fontWeight: "900" }}>{item.title}</Text>
                  <Text numberOfLines={1} style={{ color: "#64748b", fontSize: 8.8, fontWeight: "700" }}>{item.sub}</Text>
                </View>
              </View>
            ))}
          </View>

          {mains.map((m) => {
            const k = normMainKey(m.key);
            const featured =
              k.includes("daily") ||
              k.includes("essential") ||
              k.includes("personal") ||
              k.includes("beauty") ||
              k.includes("care");
            if (featured) {
              const th = featuredTheme(m.key);
              return (
                <View key={`${m.id}-featured`} style={{ marginBottom: 16, marginHorizontal: SECTION_PAD }}>
                  <LinearGradient
                    colors={[...th.shell]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: th.border,
                      paddingTop: 10,
                      paddingBottom: 10,
                    }}
                  >
                    <View style={{ paddingHorizontal: 12 }}>
                      <Text
                        style={{ marginTop: 6, fontSize: 17, fontWeight: "900", color: th.title, letterSpacing: -0.4 }}
                        numberOfLines={1}
                      >
                        {m.name}
                      </Text>
                      <Text style={{ marginTop: 2, fontSize: 11.5, fontWeight: "600", color: th.sub }} numberOfLines={1}>
                        Handpicked seasonal finds
                      </Text>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingLeft: 12, paddingRight: 10, paddingTop: 10 }}
                      decelerationRate="fast"
                    >
                      {m.subcategories.map((sub, idx) => {
                        const thumb = sub.imageUrl?.trim() ? resolveMediaUrl(sub.imageUrl) : undefined;
                        return (
                          <View key={sub.id} style={{ width: 108, marginRight: idx === m.subcategories.length - 1 ? 0 : 8 }}>
                            <Pressable onPress={() => openSubcategory(m.key, sub)}>
                              <View style={{ borderRadius: 14, overflow: "hidden", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb" }}>
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
                                  <View style={{ position: "absolute", left: 6, top: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 6, paddingVertical: 2 }}>
                                    <Text style={{ fontSize: 8, fontWeight: "900", color: "#111827" }}>MUST TRY</Text>
                                  </View>
                                  <View style={{ position: "absolute", right: 6, bottom: 6, borderRadius: 999, backgroundColor: "rgba(17,24,39,0.72)", paddingHorizontal: 8, paddingVertical: 3 }}>
                                    <Text style={{ fontSize: 10, fontWeight: "900", color: "#fff" }}>OPEN</Text>
                                  </View>
                                </View>
                                <Text numberOfLines={2} style={{ minHeight: 36, paddingHorizontal: 8, paddingVertical: 6, fontSize: 11.5, fontWeight: "800", color: "#111827", lineHeight: 14 }}>
                                  {sub.name}
                                </Text>
                              </View>
                            </Pressable>
                            <Pressable
                              onPress={() => openSubcategory(m.key, sub)}
                              style={{ marginTop: 6, borderRadius: 999, backgroundColor: "#dc2626", paddingVertical: 6, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                            >
                              <Text style={{ color: "#fff", fontSize: 9.5, fontWeight: "900" }}>Browse</Text>
                              <MaterialCommunityIcons name="chevron-right" size={14} color="#fff" />
                            </Pressable>
                          </View>
                        );
                      })}
                    </ScrollView>

                    <Pressable
                      onPress={() => openCategory(m.key)}
                      style={{ marginHorizontal: 12, marginTop: 10, borderRadius: 999, backgroundColor: "#10b981", paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                    >
                      <View style={{ flexDirection: "row", marginRight: 12 }}>
                        {m.subcategories.slice(0, 3).map((sub, i) => {
                          const thumb = sub.imageUrl?.trim() ? resolveMediaUrl(sub.imageUrl) : undefined;
                          return (
                            <View
                              key={sub.id}
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
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
                      <Text style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: "900", color: "#fff" }}>
                        See all subcategories
                      </Text>
                      <MaterialCommunityIcons name="chevron-right" size={18} color="#fff" />
                    </Pressable>
                  </LinearGradient>
                </View>
              );
            }

            return (
              <View key={`${m.id}-subs`} style={{ marginBottom: 16 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: SECTION_PAD,
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 16,
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
                    <Text style={{ color: theme.primary, fontWeight: "800", fontSize: 12 }}>See all</Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={theme.primary} />
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
                            marginRight: idx === m.subcategories.length - 1 ? 0 : 9,
                          }}
                        >
                          <View
                            style={{
                              backgroundColor: theme.bgElevated,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: theme.border,
                              padding: 6,
                              ...subCardShadow,
                            }}
                          >
                            <View
                              style={{
                                width: "100%",
                                aspectRatio: 1,
                                borderRadius: 10,
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
                                  <MaterialCommunityIcons name="tag-outline" size={24} color={theme.textDim} />
                                </View>
                              )}
                            </View>
                            <Text
                              numberOfLines={2}
                              style={{
                                marginTop: 6,
                                fontSize: 10.5,
                                fontWeight: "800",
                                color: theme.text,
                                lineHeight: 13,
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

          <View style={{ paddingHorizontal: SECTION_PAD, marginBottom: 14 }}>
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
                paddingVertical: 16,
                paddingHorizontal: 14,
                minHeight: 88,
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
