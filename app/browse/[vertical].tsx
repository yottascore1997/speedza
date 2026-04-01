import { useCallback, useEffect, useLayoutEffect, useState } from "react";
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
import { useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { addToCart } from "@/lib/cart";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";

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

export default function BrowseVerticalScreen() {
  const navigation = useNavigation();
  const { vertical, lat, lng } = useLocalSearchParams<{
    vertical: string;
    lat?: string;
    lng?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gap = 10;
  const pad = 16;
  const colW = (width - pad * 2 - gap) / 2;

  const la = Number(lat) || DEFAULT_LAT;
  const ln = Number(lng) || DEFAULT_LNG;
  const v = decodeURIComponent(Array.isArray(vertical) ? vertical[0] : vertical || "grocery");

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    const res = await api<{ products: ProductRow[] }>(
      `/api/shop/category-quick?vertical=${encodeURIComponent(v)}&lat=${la}&lng=${ln}&radiusKm=60&limit=48`,
    );
    setLoading(false);
    if (res.ok && res.data) setProducts(res.data.products);
    else setErr(res.error || "Could not load");
  }, [v, la, ln]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: v.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    });
  }, [navigation, v]);

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
      });
      Alert.alert("Added", `${p.name} added to cart`);
    } catch {
      Alert.alert("Cart", "Could not add — try one store at a time.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {err && !loading ? (
          <View
            style={{
              margin: 16,
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
                  No products in this category nearby.
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
                      <Pressable
                        onPress={() => void onAdd(item)}
                        style={{
                          marginTop: 10,
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
