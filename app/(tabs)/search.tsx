import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { ProductPriceOfferRow } from "@/components/ProductPriceOfferRow";

type StoreHit = {
  id: string;
  name: string;
  address: string;
  imageUrl?: string | null;
  shopVertical?: string;
};

type ProductHit = {
  id: string;
  name: string;
  description: string;
  price: unknown;
  mrp?: unknown;
  discountPercent?: number | null;
  stock: number;
  imageUrl?: string | null;
  unitLabel?: string | null;
  categoryName: string;
  store: { id: string; name: string; address: string; imageUrl?: string | null };
};

function numPrice(p: unknown): number {
  if (typeof p === "number" && Number.isFinite(p)) return p;
  if (typeof p === "string") {
    const n = parseFloat(p);
    return Number.isFinite(n) ? n : 0;
  }
  return Number(p) || 0;
}

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const initialQ = typeof params.q === "string" ? params.q : params.q?.[0] ?? "";
  const [q, setQ] = useState(initialQ);
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<StoreHit[]>([]);
  const [products, setProducts] = useState<ProductHit[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (initialQ.trim()) setQ(initialQ);
  }, [initialQ]);

  const trimmed = useMemo(() => q.trim(), [q]);

  const run = useCallback(async () => {
    const query = trimmed;
    if (query.length < 2) {
      setErr(null);
      setStores([]);
      setProducts([]);
      return;
    }
    setErr(null);
    setLoading(true);
    const res = await api<{ stores: StoreHit[]; products: ProductHit[] }>(
      `/api/shop/search?q=${encodeURIComponent(query)}&limit=36`,
    );
    setLoading(false);
    if (!res.ok || !res.data) {
      setErr(res.error || "Search failed");
      setStores([]);
      setProducts([]);
      return;
    }
    setStores(res.data.stores ?? []);
    setProducts(res.data.products ?? []);
  }, [trimmed]);

  useEffect(() => {
    const t = setTimeout(() => void run(), 350);
    return () => clearTimeout(t);
  }, [run]);

  const data = useMemo(
    () =>
      [
        ...(stores.length
          ? [{ type: "section" as const, id: "stores", title: "Stores" }]
          : []),
        ...stores.map((s) => ({ type: "store" as const, id: s.id, store: s })),
        ...(products.length
          ? [{ type: "section" as const, id: "products", title: "Products" }]
          : []),
        ...products.map((p) => ({ type: "product" as const, id: p.id, product: p })),
      ] as const,
    [stores, products],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.bgElevated,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <MaterialCommunityIcons name="magnify" size={20} color={theme.textMuted} />
          <TextInput
            placeholder="Search stores or products"
            placeholderTextColor={theme.textDim}
            value={q}
            onChangeText={setQ}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, color: theme.text, fontWeight: "700" }}
          />
          {q.length > 0 ? (
            <Pressable onPress={() => setQ("")} hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={20} color={theme.textDim} />
            </Pressable>
          ) : null}
        </View>
        {err ? (
          <View
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 12,
              backgroundColor: theme.roseBg,
              borderWidth: 1,
              borderColor: theme.roseBorder,
            }}
          >
            <Text style={{ color: theme.roseText, fontWeight: "700" }}>{err}</Text>
          </View>
        ) : null}
        {trimmed.length > 0 && trimmed.length < 2 ? (
          <Text style={{ marginTop: 10, color: theme.textMuted, fontWeight: "600" }}>
            Type at least 2 letters…
          </Text>
        ) : null}
      </View>

      {loading && data.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 28 }}
          data={data as any[]}
          keyExtractor={(i: any) => `${i.type}:${i.id}`}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void run()} tintColor={theme.primary} />
          }
          ListEmptyComponent={
            !loading && trimmed.length >= 2 ? (
              <Text style={{ color: theme.textMuted, textAlign: "center", marginTop: 18, fontWeight: "600" }}>
                No results for “{trimmed}”
              </Text>
            ) : null
          }
          renderItem={({ item }: any) => {
            if (item.type === "section") {
              return (
                <Text
                  style={{
                    marginTop: item.id === "stores" ? 2 : 14,
                    marginBottom: 8,
                    color: theme.text,
                    fontWeight: "900",
                    fontSize: 16,
                  }}
                >
                  {item.title}
                </Text>
              );
            }
            if (item.type === "store") {
              const s: StoreHit = item.store;
              const img = resolveMediaUrl(s.imageUrl ?? undefined);
              return (
                <Pressable
                  onPress={() => router.push(`/store/${s.id}`)}
                  style={{
                    backgroundColor: theme.bgElevated,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: theme.border,
                    overflow: "hidden",
                    marginBottom: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", gap: 12, padding: 12, alignItems: "center" }}>
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 14,
                        backgroundColor: theme.slateLine,
                        overflow: "hidden",
                      }}
                    >
                      {img ? (
                        <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                      ) : (
                        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                          <MaterialCommunityIcons name="storefront-outline" size={26} color={theme.textDim} />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: "900" }}>{s.name}</Text>
                      <Text style={{ color: theme.textMuted, fontWeight: "600", marginTop: 3 }} numberOfLines={2}>
                        {s.address}
                      </Text>
                      {s.shopVertical ? (
                        <Text style={{ marginTop: 4, color: theme.primary, fontWeight: "900", fontSize: 12 }}>
                          {s.shopVertical.replace(/-/g, " ")}
                        </Text>
                      ) : null}
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textDim} />
                  </View>
                </Pressable>
              );
            }
            const p: ProductHit = item.product;
            const img = resolveMediaUrl(p.imageUrl ?? undefined);
            const price = numPrice(p.price);
            const mrp = numPrice(p.mrp);
            return (
              <Pressable
                onPress={() => router.push(`/product/${p.id}`)}
                style={{
                  backgroundColor: theme.bgElevated,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: theme.border,
                  overflow: "hidden",
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: "row", gap: 12, padding: 12 }}>
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 14,
                      backgroundColor: theme.slateLine,
                      overflow: "hidden",
                    }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: "900" }} numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text style={{ color: theme.textDim, fontWeight: "700", marginTop: 2, fontSize: 12 }} numberOfLines={1}>
                      {p.categoryName} · {p.store.name}
                    </Text>
                    {p.unitLabel ? (
                      <Text style={{ color: theme.textMuted, fontWeight: "700", marginTop: 3, fontSize: 12 }}>
                        {p.unitLabel}
                      </Text>
                    ) : null}
                    <ProductPriceOfferRow
                      sellingPrice={price}
                      mrp={mrp}
                      discountPercent={p.discountPercent}
                      style={{ marginTop: 6 }}
                    />
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textDim} />
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
