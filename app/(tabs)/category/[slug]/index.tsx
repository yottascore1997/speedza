import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { ShopMarketHeader, type ShopHeaderMain } from "@/components/ShopMarketHeader";
import { CategoryPromoBanner } from "@/components/CategoryPromoBanner";
import { CategoryFoodGridAd, isFoodMainCategory } from "@/components/CategoryFoodGridAd";

const DEFAULT_LAT = 28.4595;
const DEFAULT_LNG = 77.0266;

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
  const la = Number(lat) || DEFAULT_LAT;
  const ln = Number(lng) || DEFAULT_LNG;

  const [mains, setMains] = useState<ShopHeaderMain[]>([]);
  const [data, setData] = useState<CatalogRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const gap = 8;
  const pad = 16;
  const cell = (width - pad * 2 - gap * 2) / 3;

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    const [tree, cat] = await Promise.all([
      api<{ mains: ShopHeaderMain[] }>("/api/master/shop-tree"),
      api<CatalogRes>(`/api/master/catalog?mainKey=${encodeURIComponent(s)}`),
    ]);
    setLoading(false);
    if (tree.ok && tree.data?.mains) setMains(tree.data.mains);
    if (cat.ok && cat.data) setData(cat.data);
    else setErr(cat.error || "Could not load categories");
  }, [s]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = data?.mainCategory?.name ?? s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const catalogKey = data?.mainCategory?.key ?? s;
  const categories = data?.categories ?? [];
  const showFoodGridAds = isFoodMainCategory(s, title);
  const showFreshTheme = isFreshMainCategory(s, title);
  const foodCanvas = "#fbf3df";
  const freshCanvas = "#eaf7ff";
  const pageBg = showFreshTheme ? freshCanvas : showFoodGridAds ? foodCanvas : theme.bg;

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
            paddingTop: showFoodGridAds ? 8 : 4,
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
          ) : (
            <CategoryPromoBanner
              categorySlug={s}
              categoryName={title}
              onOrderNow={orderNowFromBanner}
            />
          )}

          <Text style={{ fontSize: 18, fontWeight: "900", color: "#0c0a09", marginBottom: 12 }}>
            {showFreshTheme ? "Fresh Fruits & Vegetables" : showFoodGridAds ? "Explore by category 💜" : title}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {categories.flatMap((c, index) => {
              const img = firstPreviewImage(c);
              const tile = (
                <Pressable
                  key={c.id}
                  onPress={() => openSub(c)}
                  style={{ width: cell, alignItems: "center", marginBottom: 14 }}
                >
                  <View
                    style={{
                      width: "100%",
                      aspectRatio: 1,
                      borderRadius: showFoodGridAds ? 18 : 16,
                      overflow: "hidden",
                      backgroundColor: showFoodGridAds ? "#fffef8" : "#f5f5f4",
                      borderWidth: 1,
                      borderColor: showFoodGridAds ? "#f4df9c" : "#e7e5e4",
                      shadowColor: showFoodGridAds ? "#78350f" : "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: showFoodGridAds ? 0.08 : 0.04,
                      shadowRadius: 8,
                      elevation: showFoodGridAds ? 3 : 1,
                    }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <MaterialCommunityIcons name="shopping-outline" size={36} color={theme.textMuted} />
                      </View>
                    )}
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{
                      marginTop: 8,
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#0c0a09",
                      lineHeight: 15,
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
          {!loading && categories.length === 0 ? (
            <Text style={{ textAlign: "center", color: theme.textMuted, marginTop: 24, fontWeight: "600" }}>
              No subcategories in this section yet.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
