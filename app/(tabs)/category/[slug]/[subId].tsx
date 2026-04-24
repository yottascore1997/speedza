import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, useNavigation, type Href } from "expo-router";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { CartQtyStepper } from "@/components/CartQtyStepper";
import { ProductPriceOfferRow } from "@/components/ProductPriceOfferRow";
import { cartTotalQty, getCart, subscribeCart, type CartLine } from "@/lib/cart";

const DEFAULT_LAT = 28.4595;
const DEFAULT_LNG = 77.0266;
const RAIL_W = 78;
const RAIL_GAP = 8;
const FILTER_CHIPS = ["Filters", "Sort", "Type", "Price"] as const;

type ProductRow = {
  id: string;
  name: string;
  price: unknown;
  mrp?: unknown;
  discountPercent?: number | null;
  stock?: number;
  imageUrl?: string | null;
  unitLabel?: string | null;
  store: { id: string; name: string; distanceKm: number; etaMin?: number };
};

type RailCat = { id: string; name: string; imageUrl?: string | null };
type MainCat = { id: string; key: string; name: string };
type TopCategory = MainCat & { isHome?: boolean };
const SHOP_KEY = "__shop__";

function normKey(k: string): string {
  return k.toLowerCase().replace(/\s+/g, "-").trim();
}

function categoryStripIconName(key: string, displayName: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const k = normKey(key);
  const n = displayName.toLowerCase();
  if (k.includes("food") || n.includes("food") || n.includes("meal")) return "food-apple-outline";
  if (k.includes("beverage") || k.includes("drink") || n.includes("beverage") || n.includes("drink")) return "cup-outline";
  if (k.includes("grocery") || k.includes("daily") || k.includes("essential") || n.includes("daily")) return "shopping-outline";
  if (k.includes("household") || n.includes("household") || n.includes("cleaning")) return "spray-bottle";
  if (k.includes("vegetable") || k.includes("fruit") || n.includes("vegetable") || n.includes("fruit")) return "carrot";
  if (k.includes("snack")) return "cookie";
  if (k.includes("frozen") || k.includes("dairy") || n.includes("dairy")) return "snowflake";
  if (k.includes("personal") || k.includes("beauty") || n.includes("beauty")) return "face-woman-outline";
  if (k.includes("pharma") || n.includes("medicine") || n.includes("health")) return "pill";
  if (k.includes("pet")) return "paw";
  if (k.includes("baby") || n.includes("baby")) return "baby-face-outline";
  return "tag-outline";
}

const cardShadow =
  Platform.OS === "ios"
    ? {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      }
    : { elevation: 3 };

function numPrice(p: unknown): number {
  if (typeof p === "string") {
    const n = parseFloat(p);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof p === "number" && Number.isFinite(p)) return p;
  if (p && typeof p === "object" && "toNumber" in p && typeof (p as { toNumber: () => number }).toNumber === "function") {
    try {
      return (p as { toNumber: () => number }).toNumber();
    } catch {
      return 0;
    }
  }
  return Number(p) || 0;
}

function railThumb(c: RailCat): string | undefined {
  if (c.imageUrl?.trim()) return resolveMediaUrl(c.imageUrl) ?? undefined;
  return undefined;
}

/** Daily essentials vertical — hide seller name on tiles (Zepto-style). */
function isDailyEssentialsContext(slug: string, catalogKey: string) {
  const k = `${slug} ${catalogKey}`.toLowerCase();
  return k.includes("daily-essential");
}

function isFoodContext(slug: string, catalogKey: string) {
  const k = `${slug} ${catalogKey}`.toLowerCase();
  return k.includes("food") || k.includes("meal");
}

export default function CategorySubProductsScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    slug: string | string[];
    subId: string | string[];
    lat?: string;
    lng?: string;
    catalogKey?: string;
    subname?: string;
  }>();
  const { width } = useWindowDimensions();
  const gap = 8;
  const mainPad = 10;
  const rightW = width - RAIL_W - RAIL_GAP;
  const colW = (rightW - mainPad * 2 - gap) / 2;

  const slug = decodeURIComponent(Array.isArray(params.slug) ? params.slug[0] : params.slug || "grocery");
  const subIdRaw = Array.isArray(params.subId) ? params.subId[0] : params.subId || "";
  const subId = decodeURIComponent(subIdRaw);
  const la = Number(params.lat) || DEFAULT_LAT;
  const ln = Number(params.lng) || DEFAULT_LNG;
  const catalogKey = (params.catalogKey as string)?.trim() || slug;
  const subnameQ = (params.subname as string)?.trim() || "";

  const hideStoreName = useMemo(() => isDailyEssentialsContext(slug, catalogKey), [slug, catalogKey]);
  const foodMode = useMemo(() => isFoodContext(slug, catalogKey), [slug, catalogKey]);
  const viewCartBarWidth = Math.min(268, width - 44);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [mains, setMains] = useState<MainCat[]>([]);
  const [railCats, setRailCats] = useState<RailCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cartQty, setCartQty] = useState(0);
  const [cartFirstLine, setCartFirstLine] = useState<CartLine | null>(null);

  const pageTitle = useMemo(() => {
    if (subnameQ) return subnameQ;
    return subId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }, [subId, subnameQ]);
  const topCategories = useMemo<TopCategory[]>(
    () => [{ id: "home-tab", key: SHOP_KEY, name: "Home", isHome: true }, ...mains],
    [mains],
  );

  const syncCart = useCallback(() => {
    void getCart().then((lines) => {
      setCartQty(cartTotalQty(lines));
      setCartFirstLine(lines[0] ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    if (!subId || subId === "all") {
      setErr("Invalid subcategory");
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);
    const q = new URLSearchParams({
      vertical: catalogKey,
      lat: String(la),
      lng: String(ln),
      radiusKm: "60",
      limit: "48",
      masterCategoryId: subId,
    });
    const res = await api<{ products: ProductRow[] }>(`/api/shop/category-quick?${q.toString()}`);
    setLoading(false);
    if (res.ok && res.data) setProducts(res.data.products);
    else setErr(res.error || "Could not load");
  }, [catalogKey, la, ln, subId]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    void (async () => {
      const tree = await api<{ mains: MainCat[] }>("/api/master/shop-tree");
      if (tree.ok && tree.data?.mains) setMains(tree.data.mains);
      else setMains([]);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await api<{ categories: RailCat[] }>(
        `/api/master/catalog?mainKey=${encodeURIComponent(catalogKey)}`,
      );
      if (res.ok && res.data?.categories) {
        setRailCats(res.data.categories.map((c) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl })));
      } else setRailCats([]);
    })();
  }, [catalogKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    syncCart();
    return subscribeCart(syncCart);
  }, [syncCart]);

  function goCategory(key: string) {
    if (key === SHOP_KEY) {
      router.replace("/");
      return;
    }
    const href =
      `/category/${encodeURIComponent(key)}?lat=${encodeURIComponent(String(la))}&lng=${encodeURIComponent(String(ln))}` as Href;
    router.replace(href);
  }

  function goSub(c: RailCat) {
    const href =
      `/category/${encodeURIComponent(slug)}/${encodeURIComponent(c.id)}?lat=${encodeURIComponent(String(la))}&lng=${encodeURIComponent(String(ln))}&catalogKey=${encodeURIComponent(catalogKey)}&subname=${encodeURIComponent(c.name)}` as Href;
    router.replace(href);
  }

  const firstThumbUri = cartFirstLine?.imageUrl
    ? resolveMediaUrl(cartFirstLine.imageUrl ?? undefined)
    : undefined;

  const foodStores = useMemo(() => {
    if (!foodMode) return [];
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        distanceKm: number;
        etaMin?: number;
        cover?: string;
        productCount: number;
      }
    >();
    for (const p of products) {
      const sid = p.store?.id;
      if (!sid) continue;
      const prev = map.get(sid);
      if (prev) {
        prev.productCount += 1;
        if (!prev.cover && p.imageUrl) prev.cover = p.imageUrl;
        continue;
      }
      map.set(sid, {
        id: sid,
        name: p.store.name,
        distanceKm: Number(p.store.distanceKm) || 0,
        etaMin: p.store.etaMin,
        cover: p.imageUrl ?? undefined,
        productCount: 1,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [foodMode, products]);

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f4" }}>
      <View style={{ backgroundColor: "#fff", paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: "#57534e" }}>Select your category</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, backgroundColor: "#fff" }}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8, alignItems: "flex-end", paddingBottom: 6 }}
      >
        {topCategories.map((c) => {
          const active = c.key === SHOP_KEY ? false : c.key === slug || c.key === catalogKey;
          const stripIcon = !c.isHome ? categoryStripIconName(c.key, c.name) : null;
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
              onPress={() => goCategory(c.key)}
              style={{
                width: 76,
                alignItems: "center",
                paddingBottom: 2,
              }}
            >
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 4, width: "100%" }}>
                {c.isHome ? (
                  <Image
                    source={require("../../../../assets/home.png")}
                    style={{ width: 33, height: 33, opacity: 1 }}
                    contentFit="contain"
                  />
                ) : isDailyEssentials ? (
                  <Image
                    source={require("../../../../assets/shopping-cart.png")}
                    style={{ width: 33, height: 33, opacity: 1 }}
                    contentFit="contain"
                  />
                ) : isFood ? (
                  <Image
                    source={require("../../../../assets/balanced-diet.png")}
                    style={{ width: 33, height: 33, opacity: 1 }}
                    contentFit="contain"
                  />
                ) : isPersonalCare ? (
                  <Image
                    source={require("../../../../assets/hair.png")}
                    style={{ width: 33, height: 33, opacity: 1 }}
                    contentFit="contain"
                  />
                ) : isSnacks ? (
                  <Image
                    source={require("../../../../assets/snaks.png")}
                    style={{ width: 33, height: 33, opacity: 1 }}
                    contentFit="contain"
                  />
                ) : isBeverages ? (
                  <Image
                    source={require("../../../../assets/drink.png")}
                    style={{ width: 33, height: 33, opacity: 1 }}
                    contentFit="contain"
                  />
                ) : isHousehold ? (
                  <Image
                    source={require("../../../../assets/household.png")}
                    style={{ width: 33, height: 33, opacity: 1 }}
                    contentFit="contain"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name={stripIcon!}
                    size={32}
                    color={active ? "#0f172a" : "#94a3b8"}
                  />
                )}
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{
                    marginTop: 4,
                    textAlign: "center",
                    fontSize: 10,
                    fontWeight: "900",
                    color: "#0f172a",
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
      <View style={{ backgroundColor: "#fff", paddingHorizontal: 12, paddingBottom: 6 }}>
        <Text numberOfLines={1} style={{ fontSize: 28, fontWeight: "800", color: "#1f2937" }}>
          {pageTitle}
        </Text>
      </View>

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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 8,
          alignItems: "center",
        }}
      >
        {FILTER_CHIPS.map((label) => (
          <Pressable
            key={label}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#e7e5e4",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#44403c" }}>{label}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#78716c" />
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ flex: 1, flexDirection: "row", paddingLeft: 8, gap: RAIL_GAP }}>
        <ScrollView
          style={{ width: RAIL_W, flexGrow: 0 }}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 4, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {railCats.map((c) => {
            const active = c.id === subId;
            const thumb = railThumb(c);
            return (
              <Pressable
                key={c.id}
                onPress={() => goSub(c)}
                style={{
                  width: RAIL_W,
                  alignItems: "center",
                  paddingVertical: 8,
                  borderRadius: 14,
                  backgroundColor: active ? "#f0fdf4" : "#fff",
                  borderWidth: 1,
                  borderColor: active ? "#86efac" : "#e7e5e4",
                  overflow: "hidden",
                }}
              >
                {active ? (
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 6,
                      bottom: 6,
                      width: 3,
                      borderRadius: 2,
                      backgroundColor: "#16a34a",
                    }}
                  />
                ) : null}
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    overflow: "hidden",
                    backgroundColor: "#f5f5f4",
                    borderWidth: 1,
                    borderColor: active ? "#86efac" : "#e7e5e4",
                  }}
                >
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <MaterialCommunityIcons name="tag-outline" size={20} color={theme.textDim} />
                    </View>
                  )}
                </View>
                <Text
                  numberOfLines={2}
                  style={{
                    marginTop: 6,
                    fontSize: 9,
                    fontWeight: "800",
                    color: active ? theme.primaryDark : "#44403c",
                    textAlign: "center",
                    lineHeight: 12,
                    paddingHorizontal: 2,
                  }}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ flex: 1, minWidth: 0 }}>
          {loading && products.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 40 }}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : foodMode ? (
            <FlatList
              key="food-list-single-column"
              data={foodStores}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingBottom: 28 + insets.bottom,
                paddingTop: 4,
                paddingHorizontal: 8,
                gap: 10,
              }}
              refreshControl={
                <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={theme.primary} />
              }
              ListEmptyComponent={
                !loading ? (
                  <Text style={{ textAlign: "center", color: theme.textMuted, marginTop: 32, paddingHorizontal: mainPad }}>
                    No food stores found in this subcategory nearby.
                  </Text>
                ) : null
              }
              renderItem={({ item }) => {
                const img = resolveMediaUrl(item.cover ?? undefined);
                const rating = (4 + Math.min(0.9, (item.productCount % 9) * 0.1)).toFixed(1);
                const eta = typeof item.etaMin === "number" ? `${Math.max(10, Math.round(item.etaMin))} mins` : "25-35 mins";
                return (
                  <Pressable
                    onPress={() => router.push(`/store/${item.id}` as Href)}
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: "#ece7e1",
                      overflow: "hidden",
                      ...cardShadow,
                    }}
                  >
                    <View style={{ height: 154, backgroundColor: "#f1f5f9" }}>
                      {img ? <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                      <View
                        style={{
                          position: "absolute",
                          left: 10,
                          bottom: 10,
                          borderRadius: 8,
                          backgroundColor: "rgba(0,0,0,0.72)",
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>{item.productCount}+ items at great prices</Text>
                      </View>
                      <View
                        style={{
                          position: "absolute",
                          right: 10,
                          bottom: 10,
                          borderRadius: 8,
                          backgroundColor: "#ffffff",
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderWidth: 1,
                          borderColor: "#e5e7eb",
                        }}
                      >
                        <Text style={{ color: "#111827", fontSize: 11, fontWeight: "900" }}>{eta.toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}>
                      <Text numberOfLines={2} style={{ fontSize: 18, lineHeight: 23, fontWeight: "900", color: "#0c0a09" }}>
                        {item.name}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                        <View
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: "#16a34a",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 5,
                          }}
                        >
                          <MaterialCommunityIcons name="star" size={11} color="#fff" />
                        </View>
                        <Text style={{ color: "#374151", fontSize: 14, fontWeight: "800" }}>
                          {rating} <Text style={{ color: "#6b7280", fontWeight: "700" }}>({item.productCount * 12}+)</Text>
                        </Text>
                        <Text style={{ color: "#9ca3af", fontWeight: "700" }}> {" "}•{" "}</Text>
                        <Text style={{ color: "#374151", fontSize: 14, fontWeight: "700" }}>
                          {(Number(item.distanceKm) || 0).toFixed(1)} km
                        </Text>
                      </View>
                      <Text numberOfLines={1} style={{ marginTop: 5, color: "#6b7280", fontWeight: "700", fontSize: 13 }}>
                        Fast food, Chinese, Snacks
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 }}>
                        <View
                          style={{
                            borderWidth: 1,
                            borderColor: "#fde68a",
                            borderRadius: 999,
                            paddingHorizontal: 9,
                            paddingVertical: 4,
                            backgroundColor: "#fffbeb",
                          }}
                        >
                          <Text style={{ color: "#92400e", fontWeight: "900", fontSize: 11 }}>Up to 50% OFF</Text>
                        </View>
                        <Text style={{ color: "#16a34a", fontWeight: "900", fontSize: 12 }}>Open Store</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              }}
            />
          ) : (
            <FlatList
              key="product-grid-2-cols"
              data={products}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={{ gap, paddingHorizontal: mainPad }}
              contentContainerStyle={{
                paddingBottom: cartQty > 0 ? 100 + insets.bottom : 28 + insets.bottom,
                paddingTop: 4,
                gap,
              }}
              refreshControl={
                <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={theme.primary} />
              }
              ListEmptyComponent={
                !loading ? (
                  <Text style={{ textAlign: "center", color: theme.textMuted, marginTop: 32, paddingHorizontal: mainPad }}>
                    No products in this subcategory nearby.
                  </Text>
                ) : null
              }
              renderItem={({ item }) => {
                const img = resolveMediaUrl(item.imageUrl ?? undefined);
                const price = numPrice(item.price);
                const mrp = numPrice(item.mrp);
                const stock = typeof item.stock === "number" && Number.isFinite(item.stock) ? item.stock : 999;
                const inStock = stock > 0;
                return (
                  <View style={{ width: colW }}>
                    <View
                      style={{
                        backgroundColor: "#fff",
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: "#e7e5e4",
                        ...cardShadow,
                      }}
                    >
                      <View
                        style={{
                          borderTopLeftRadius: 16,
                          borderTopRightRadius: 16,
                          overflow: "hidden",
                          backgroundColor: "#fafaf9",
                        }}
                      >
                        <Pressable onPress={() => router.push(`/product/${item.id}` as Href)}>
                          <View style={{ aspectRatio: 1 }}>
                            {img ? (
                              <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                            ) : (
                              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                                <MaterialCommunityIcons name="image-outline" size={36} color={theme.textDim} />
                              </View>
                            )}
                          </View>
                        </Pressable>
                      </View>

                      <Pressable onPress={() => router.push(`/product/${item.id}` as Href)} style={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 4 }}>
                        {item.unitLabel?.trim() ? (
                          <View
                            style={{
                              alignSelf: "flex-start",
                              marginBottom: 6,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 6,
                              backgroundColor: "#e0f2fe",
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "900", color: "#0369a1" }}>
                              {item.unitLabel.trim()}
                            </Text>
                          </View>
                        ) : null}
                        <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: "900", color: "#0c0a09", lineHeight: 17 }}>
                          {item.name}
                        </Text>
                        <ProductPriceOfferRow
                          compact
                          layout="premiumGrid"
                          sellingPrice={price}
                          mrp={mrp}
                          discountPercent={item.discountPercent}
                          style={{ marginTop: 6 }}
                        />
                      </Pressable>
                      <View style={{ paddingHorizontal: 10, paddingBottom: 10, paddingTop: 2 }}>
                        <CartQtyStepper
                          compact
                          addLabel="ADD"
                          line={{
                            productId: item.id,
                            storeId: item.store.id,
                            name: item.name,
                            price,
                            storeName: item.store.name,
                            imageUrl: item.imageUrl ?? null,
                            unitLabel: item.unitLabel ?? null,
                            mrp: mrp > price ? mrp : undefined,
                            discountPercent:
                              typeof item.discountPercent === "number" && item.discountPercent > 0
                                ? item.discountPercent
                                : undefined,
                          }}
                          maxQty={stock}
                          canAdd={inStock}
                        />
                        {!hideStoreName ? (
                          <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: "600", color: "#78716c", marginTop: 6 }}>
                            {item.store.name}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>

      {cartQty > 0 ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 12 + Math.max(insets.bottom, 8),
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => router.push("/cart")}
            style={{
              width: viewCartBarWidth,
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: "#166534",
              gap: 10,
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.2,
                  shadowRadius: 12,
                },
                android: { elevation: 10 },
              }),
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                overflow: "hidden",
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.4)",
              }}
            >
              {firstThumbUri ? (
                <Image source={{ uri: firstThumbUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name="cart" size={22} color="#166534" />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>View cart</Text>
              <Text style={{ color: "rgba(255,255,255,0.88)", fontWeight: "700", fontSize: 12, marginTop: 2 }}>
                {cartQty} {cartQty === 1 ? "item" : "items"}
              </Text>
            </View>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: theme.brandNavOrange,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name="chevron-right" size={28} color="#fff" />
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
