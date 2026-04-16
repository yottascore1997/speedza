import { useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { CartQtyStepper } from "@/components/CartQtyStepper";
import { ProductPriceOfferRow } from "@/components/ProductPriceOfferRow";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number | string;
  mrp?: number | null;
  discountPercent?: number | null;
  imageUrl?: string | null;
  stock: number;
  categoryId: string;
  unitLabel?: string | null;
  variantOptionsCount?: number;
  priceMax?: number | null;
};

type Category = { id: string; name: string; products: Product[] };

export default function StoreDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const res = await api<{ store: { name: string; categories: Category[] } }>(
      `/api/stores/${id}`,
    );
    setLoading(false);
    if (res.ok && res.data) {
      setName(res.data.store.name);
      setCategories(res.data.store.categories);
    } else Alert.alert("Error", res.error || "Failed");
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function priceNum(p: Product) {
    return typeof p.price === "number" ? p.price : parseFloat(String(p.price)) || 0;
  }

  function mrpNum(p: Product) {
    const v = p.mrp;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "900", marginBottom: 6, color: theme.text }}>{name}</Text>
      {categories.map((c) => (
        <View key={c.id} style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 17, fontWeight: "800", marginBottom: 10, color: theme.text }}>{c.name}</Text>
          {c.products.map((p) => {
            const img = resolveMediaUrl(p.imageUrl ?? undefined);
            return (
              <View
                key={p.id}
                style={{
                  backgroundColor: theme.bgElevated,
                  padding: 12,
                  borderRadius: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: theme.border,
                  flexDirection: "row",
                  gap: 12,
                }}
              >
                <Pressable
                  onPress={() => router.push(`/product/${p.id}`)}
                  style={{ flexDirection: "row", gap: 12, flex: 1 }}
                >
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 12,
                      backgroundColor: theme.slateLine,
                      overflow: "hidden",
                    }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", color: theme.text }}>{p.name}</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                      {p.description}
                    </Text>
                    {p.unitLabel ? (
                      <Text style={{ fontSize: 11, color: theme.textDim, marginTop: 3, fontWeight: "700" }}>
                        {p.unitLabel}
                      </Text>
                    ) : null}
                    <ProductPriceOfferRow
                      sellingPrice={priceNum(p)}
                      mrp={mrpNum(p)}
                      discountPercent={p.discountPercent}
                      priceMax={p.priceMax}
                      variantOptionsCount={p.variantOptionsCount}
                    />
                    <Text style={{ fontSize: 11, color: theme.textDim, marginTop: 4 }}>Stock: {p.stock}</Text>
                  </View>
                </Pressable>
                <View style={{ alignSelf: "center", minWidth: 132, maxWidth: 160 }}>
                  <CartQtyStepper
                    compact
                    addLabel="ADD"
                    line={{
                      productId: p.id,
                      storeId: id!,
                      name: p.name,
                      price: priceNum(p),
                      storeName: name,
                      imageUrl: p.imageUrl ?? null,
                      mrp: mrpNum(p) > 0 ? mrpNum(p) : undefined,
                      discountPercent:
                        typeof p.discountPercent === "number" && p.discountPercent > 0
                          ? p.discountPercent
                          : undefined,
                    }}
                    maxQty={p.stock}
                    canAdd={p.stock > 0}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}
