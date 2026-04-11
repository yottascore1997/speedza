import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter, useNavigation, type Href } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { addToCart } from "@/lib/cart";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { ShopMarketHeader, type ShopHeaderMain } from "@/components/ShopMarketHeader";

const DEFAULT_LAT = 28.4595;
const DEFAULT_LNG = 77.0266;

type ProductRow = {
  id: string;
  name: string;
  price: unknown;
  mrp?: unknown;
  imageUrl?: string | null;
  unitLabel?: string | null;
  store: { id: string; name: string; distanceKm: number };
};

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

export default function CategorySubProductsScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    slug: string | string[];
    subId: string | string[];
    lat?: string;
    lng?: string;
    catalogKey?: string;
    subname?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gap = 10;
  const pad = 16;
  const colW = (width - pad * 2 - gap) / 2;

  const slug = decodeURIComponent(Array.isArray(params.slug) ? params.slug[0] : params.slug || "grocery");
  const subIdRaw = Array.isArray(params.subId) ? params.subId[0] : params.subId || "";
  const subId = decodeURIComponent(subIdRaw);
  const la = Number(params.lat) || DEFAULT_LAT;
  const ln = Number(params.lng) || DEFAULT_LNG;
  const catalogKey = (params.catalogKey as string)?.trim() || slug;
  const subnameQ = (params.subname as string)?.trim() || "";

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [mains, setMains] = useState<ShopHeaderMain[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const pageTitle = useMemo(() => {
    if (subnameQ) return subnameQ;
    return subId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }, [subId, subnameQ]);

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
    void load();
  }, [load]);

  async function onAdd(p: ProductRow) {
    const price = numPrice(p.price);
    try {
      await addToCart({
        productId: p.id,
        storeId: p.store.id,
        name: p.name,
        price,
        quantity: 1,
        storeName: p.store.name,
        imageUrl: p.imageUrl ?? null,
        unitLabel: p.unitLabel ?? null,
      });
      Alert.alert("Added", `${p.name} added to cart`);
    } catch {
      Alert.alert("Cart", "Could not add — try one store at a time.");
    }
  }

  function goCategory(key: string) {
    const href =
      `/category/${encodeURIComponent(key)}?lat=${encodeURIComponent(String(la))}&lng=${encodeURIComponent(String(ln))}` as Href;
    router.replace(href);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ShopMarketHeader
        safeTop={insets.top}
        mains={mains}
        activeKey={slug}
        onShopPress={() => router.replace("/")}
        onCategoryPress={goCategory}
        pageTitle={pageTitle}
        onBackPress={() => router.back()}
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
      {loading && products.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap, paddingHorizontal: pad }}
          contentContainerStyle={{ paddingBottom: 24 + insets.bottom, paddingTop: 8, gap }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={theme.primary} />
          }
          ListEmptyComponent={
            !loading ? (
              <Text style={{ textAlign: "center", color: theme.textMuted, marginTop: 32, paddingHorizontal: pad }}>
                No products in this subcategory nearby.
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const img = resolveMediaUrl(item.imageUrl ?? undefined);
            const price = numPrice(item.price);
            return (
              <View style={{ width: colW }}>
                <View
                  style={{
                    backgroundColor: theme.bgElevated,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: theme.border,
                    overflow: "hidden",
                  }}
                >
                  <Pressable onPress={() => router.push(`/product/${item.id}` as Href)}>
                    <View style={{ aspectRatio: 1, backgroundColor: theme.slateLine }}>
                      {img ? (
                        <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                      ) : null}
                    </View>
                    <View style={{ padding: 10 }}>
                      <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: "700", color: theme.text }}>
                        {item.name}
                      </Text>
                      {item.unitLabel ? (
                        <Text style={{ fontSize: 11, color: theme.textDim, marginTop: 2 }}>{item.unitLabel}</Text>
                      ) : null}
                      <Text style={{ fontSize: 15, fontWeight: "800", color: theme.primary, marginTop: 6 }}>
                        ₹{Math.round(price * 100) / 100}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>
                        {item.store.name} · {item.store.distanceKm.toFixed(1)} km
                      </Text>
                    </View>
                  </Pressable>
                  <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
                    <Pressable
                      onPress={() => void onAdd(item)}
                      style={{
                        backgroundColor: theme.accent,
                        paddingVertical: 8,
                        borderRadius: 10,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Add</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
