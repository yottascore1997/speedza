import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { cartTotalQty, getCart, subscribeCart } from "@/lib/cart";
import { CartQtyStepper } from "@/components/CartQtyStepper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Product = {
  id: string;
  name: string;
  description: string;
  price: unknown;
  mrp?: unknown;
  discountPercent?: number | null;
  stock: number;
  imageUrl?: string | null;
  imageUrl2?: string | null;
  unitLabel?: string | null;
  categoryName: string;
  store: { id: string; name: string; address: string; latitude: number; longitude: number };
};

type StoreProduct = {
  id: string;
  name: string;
  price: number | string;
  mrp?: number | string | null;
  imageUrl?: string | null;
  stock: number;
  unitLabel?: string | null;
};

type StoreCategory = { id: string; name: string; products: StoreProduct[] };

function numPrice(p: unknown): number {
  if (typeof p === "number" && Number.isFinite(p)) return p;
  if (typeof p === "string") {
    const n = parseFloat(p);
    return Number.isFinite(n) ? n : 0;
  }
  return Number(p) || 0;
}

export default function ProductScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [p, setP] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [similar, setSimilar] = useState<StoreProduct[]>([]);
  const [alsoLike, setAlsoLike] = useState<StoreProduct[]>([]);
  const [cartQty, setCartQty] = useState(0);

  const syncCartQty = useCallback(async () => {
    const lines = await getCart();
    setCartQty(cartTotalQty(lines));
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const res = await api<{ product: Product }>(`/api/shop/product/${encodeURIComponent(id)}`);
    if (!res.ok || !res.data?.product) {
      setLoading(false);
      Alert.alert("Error", res.error || "Could not load product");
      setP(null);
      return;
    }
    const next = res.data.product;
    setP(next);

    const relatedRes = await api<{ store: { categories: StoreCategory[] } }>(`/api/stores/${next.store.id}`);
    if (relatedRes.ok && relatedRes.data?.store) {
      const products = relatedRes.data.store.categories
        .flatMap((c) => c.products)
        .filter((item) => item.id !== next.id && item.stock > 0);
      setSimilar(products.slice(0, 6));
      setAlsoLike(products.slice(6, 12));
    } else {
      setSimilar([]);
      setAlsoLike([]);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void syncCartQty();
      return subscribeCart(() => {
        void syncCartQty();
      });
    }, [load, syncCartQty]),
  );

  if (loading && !p) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: 16 }}>
        <Text style={{ color: theme.textMuted, fontWeight: "700" }}>Product not available.</Text>
      </View>
    );
  }

  const img1 = resolveMediaUrl(p.imageUrl ?? undefined);
  const img2 = resolveMediaUrl(p.imageUrl2 ?? undefined);
  const price = numPrice(p.price);
  const mrp = numPrice(p.mrp);
  const offPct =
    typeof p.discountPercent === "number" && p.discountPercent > 0
      ? Math.round(p.discountPercent)
      : mrp > price && mrp > 0
        ? Math.round(((mrp - price) / mrp) * 100)
        : 0;
  const discountAmount = Math.max(0, Math.round((mrp - price) * 100) / 100);

  const similarProducts = similar.length ? similar : alsoLike.slice(0, 6);
  const alsoLikeProducts = alsoLike.length ? alsoLike : similar.slice(0, 6);

  return (
    <View style={{ flex: 1, backgroundColor: "#f4f4f5" }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 114 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: "#ffffff", paddingTop: insets.top + 6, paddingBottom: 10 }}>
          <View style={{ height: 360, width: "100%", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f4f6" }}>
            {img1 ? (
              <Image source={{ uri: img1 }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <MaterialCommunityIcons name="image-outline" size={52} color={theme.textDim} />
            )}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#111827" }} />
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#d1d5db" }} />
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#d1d5db" }} />
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#d1d5db" }} />
          </View>
        </View>

        <View style={{ marginTop: 10, marginHorizontal: 10, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#eceef3", padding: 14 }}>
          <Text style={{ color: "#111827", fontSize: 22, fontWeight: "900", lineHeight: 28 }}>{p.name}</Text>
          <Text style={{ color: "#4b5563", marginTop: 6, fontWeight: "700" }}>
            Net quantity: 1 pc {p.unitLabel ? `(${p.unitLabel})` : ""}
          </Text>
          <View style={{ marginTop: 12, flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9, borderWidth: 2, borderColor: "#166534", backgroundColor: "#22c55e" }}>
              <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 26, lineHeight: 31 }}>₹{price}</Text>
            </View>
            {mrp > price ? (
              <Text style={{ color: "#6b7280", fontSize: 20, textDecorationLine: "line-through", fontWeight: "800", lineHeight: 24 }}>₹{mrp}</Text>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <Text style={{ color: "#4b5563", fontWeight: "700", fontSize: 14 }}>MRP (incl. of all taxes)</Text>
            {discountAmount > 0 ? <Text style={{ color: "#16a34a", fontWeight: "900", fontSize: 16 }}>₹{discountAmount} OFF</Text> : null}
          </View>

        </View>

        <View style={{ marginTop: 10, marginHorizontal: 10, borderRadius: 18, borderWidth: 1, borderColor: "#eceef3", backgroundColor: "#ffffff", paddingVertical: 12 }}>
          <Text style={{ color: "#1f2937", fontWeight: "900", fontSize: 22, paddingHorizontal: 14 }}>Similar Products</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, gap: 10 }}>
            {similarProducts.map((item) => {
              const itemPrice = numPrice(item.price);
              const itemMrp = numPrice(item.mrp);
              const itemImg = resolveMediaUrl(item.imageUrl ?? undefined);
              return (
                <View key={item.id} style={{ width: 168, borderRadius: 14, borderWidth: 1, borderColor: "#eceef3", backgroundColor: "#fff", overflow: "hidden" }}>
                  <Pressable onPress={() => router.push(`/product/${item.id}`)} style={{ height: 128, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" }}>
                    {itemImg ? <Image source={{ uri: itemImg }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <MaterialCommunityIcons name="image-outline" size={32} color="#9ca3af" />}
                  </Pressable>
                  <View style={{ padding: 8 }}>
                    <CartQtyStepper
                      compact
                      line={{
                        productId: item.id,
                        storeId: p.store.id,
                        name: item.name,
                        price: itemPrice,
                        storeName: p.store.name,
                        imageUrl: item.imageUrl ?? null,
                        unitLabel: item.unitLabel ?? null,
                        mrp: itemMrp > itemPrice ? itemMrp : undefined,
                      }}
                      maxQty={item.stock}
                      canAdd={item.stock > 0}
                      addLabel="ADD"
                    />
                    <Text style={{ color: "#16a34a", fontWeight: "900", marginTop: 7, fontSize: 20 }}>₹{itemPrice}</Text>
                    {itemMrp > itemPrice ? <Text style={{ color: "#6b7280", textDecorationLine: "line-through", fontWeight: "700", fontSize: 14 }}>₹{itemMrp}</Text> : null}
                    <Pressable onPress={() => router.push(`/product/${item.id}`)}>
                      <Text numberOfLines={2} style={{ color: "#111827", fontWeight: "700", marginTop: 2, fontSize: 14, lineHeight: 18 }}>{item.name}</Text>
                    </Pressable>
                    <Text style={{ color: "#6b7280", fontWeight: "600", marginTop: 2, fontSize: 12 }}>{item.unitLabel ?? "1 pc"}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ marginTop: 10, marginHorizontal: 10, borderRadius: 18, borderWidth: 1, borderColor: "#eceef3", backgroundColor: "#ffffff", paddingVertical: 12 }}>
          <Text style={{ color: "#1f2937", fontWeight: "900", fontSize: 22, paddingHorizontal: 14 }}>You might also like</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, gap: 10 }}>
            {alsoLikeProducts.map((item) => {
              const itemPrice = numPrice(item.price);
              const itemMrp = numPrice(item.mrp);
              const itemImg = resolveMediaUrl(item.imageUrl ?? undefined);
              return (
                <View key={item.id} style={{ width: 168, borderRadius: 14, borderWidth: 1, borderColor: "#eceef3", backgroundColor: "#fff", overflow: "hidden" }}>
                  <Pressable onPress={() => router.push(`/product/${item.id}`)} style={{ height: 128, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" }}>
                    {itemImg ? <Image source={{ uri: itemImg }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <MaterialCommunityIcons name="image-outline" size={32} color="#9ca3af" />}
                  </Pressable>
                  <View style={{ padding: 8 }}>
                    <CartQtyStepper
                      compact
                      line={{
                        productId: item.id,
                        storeId: p.store.id,
                        name: item.name,
                        price: itemPrice,
                        storeName: p.store.name,
                        imageUrl: item.imageUrl ?? null,
                        unitLabel: item.unitLabel ?? null,
                        mrp: itemMrp > itemPrice ? itemMrp : undefined,
                      }}
                      maxQty={item.stock}
                      canAdd={item.stock > 0}
                      addLabel="ADD"
                    />
                    <Text style={{ color: "#16a34a", fontWeight: "900", marginTop: 7, fontSize: 20 }}>₹{itemPrice}</Text>
                    {itemMrp > itemPrice ? <Text style={{ color: "#6b7280", textDecorationLine: "line-through", fontWeight: "700", fontSize: 14 }}>₹{itemMrp}</Text> : null}
                    <Pressable onPress={() => router.push(`/product/${item.id}`)}>
                      <Text numberOfLines={2} style={{ color: "#111827", fontWeight: "700", marginTop: 2, fontSize: 14, lineHeight: 18 }}>{item.name}</Text>
                    </Pressable>
                    <Text style={{ color: "#6b7280", fontWeight: "600", marginTop: 2, fontSize: 12 }}>{item.unitLabel ?? "1 pc"}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {p.description?.trim() ? (
          <View style={{ marginTop: 10, marginHorizontal: 10, borderRadius: 18, borderWidth: 1, borderColor: "#eceef3", backgroundColor: "#ffffff", padding: 14 }}>
            <Text style={{ color: "#111827", fontWeight: "900", fontSize: 20 }}>Product details</Text>
            <Text style={{ marginTop: 8, color: "#4b5563", fontWeight: "600", lineHeight: 22 }}>{p.description}</Text>
          </View>
        ) : null}

      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#ffffff", borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 + insets.bottom, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable onPress={() => router.push("/cart")} style={{ width: 58, height: 50, borderRadius: 15, borderWidth: 1, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center", position: "relative", backgroundColor: "#fff" }}>
          <MaterialCommunityIcons name="cart-outline" size={25} color="#111827" />
          {cartQty > 0 ? (
            <View style={{ position: "absolute", right: 8, top: 4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#ec4899", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>{cartQty}</Text>
            </View>
          ) : null}
        </Pressable>
        <View style={{ flex: 1 }}>
          <CartQtyStepper
            line={{
              productId: p.id,
              storeId: p.store.id,
              name: p.name,
              price,
              storeName: p.store.name,
              imageUrl: p.imageUrl ?? p.imageUrl2 ?? null,
              unitLabel: p.unitLabel ?? null,
              mrp: mrp > price ? mrp : undefined,
              discountPercent:
                typeof p.discountPercent === "number" && p.discountPercent > 0
                  ? p.discountPercent
                  : undefined,
            }}
            maxQty={p.stock}
            canAdd={p.stock > 0}
            addLabel="Add to cart"
            addBgColor="#ec4899"
            addBorderColor="#db2777"
          />
        </View>
      </View>
    </View>
  );
}

