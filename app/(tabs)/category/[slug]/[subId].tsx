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
import { ShopMarketHeader, type ShopHeaderMain } from "@/components/ShopMarketHeader";
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
  const viewCartBarWidth = Math.min(268, width - 44);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [mains, setMains] = useState<ShopHeaderMain[]>([]);
  const [railCats, setRailCats] = useState<RailCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cartQty, setCartQty] = useState(0);
  const [cartFirstLine, setCartFirstLine] = useState<CartLine | null>(null);

  const pageTitle = useMemo(() => {
    if (subnameQ) return subnameQ;
    return subId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }, [subId, subnameQ]);

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
      const tree = await api<{ mains: ShopHeaderMain[] }>("/api/master/shop-tree");
      if (tree.ok && tree.data?.mains) setMains(tree.data.mains);
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

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f4" }}>
      <ShopMarketHeader
        safeTop={insets.top}
        mains={mains}
        activeKey={slug}
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
          ) : (
            <FlatList
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
