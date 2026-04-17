import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { CartQtyStepper } from "@/components/CartQtyStepper";

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
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [p, setP] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const res = await api<{ product: Product }>(`/api/shop/product/${encodeURIComponent(id)}`);
    setLoading(false);
    if (!res.ok || !res.data?.product) {
      Alert.alert("Error", res.error || "Could not load product");
      setP(null);
      return;
    }
    setP(res.data.product);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
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

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f8fb" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View
          style={{
            borderRadius: 20,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.bgElevated,
            shadowColor: "#0f172a",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.07,
            shadowRadius: 14,
            elevation: 5,
          }}
        >
          <View style={{ aspectRatio: 1, backgroundColor: theme.slateLine }}>
            {img1 ? (
              <Image source={{ uri: img1 }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="image-outline" size={46} color={theme.textDim} />
              </View>
            )}
          </View>
          {img2 ? (
            <View style={{ height: 1, backgroundColor: theme.border }} />
          ) : null}
          {img2 ? (
            <View style={{ aspectRatio: 16 / 9, backgroundColor: theme.slateLine }}>
              <Image source={{ uri: img2 }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            </View>
          ) : null}
        </View>

        <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <View style={{ borderRadius: 999, borderWidth: 1, borderColor: "#dbeafe", backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: "#1d4ed8", fontWeight: "900", fontSize: 11 }}>{p.categoryName}</Text>
          </View>
          {p.unitLabel ? (
            <View style={{ borderRadius: 999, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#ffffff", paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: theme.textDim, fontWeight: "900", fontSize: 11 }}>{p.unitLabel}</Text>
            </View>
          ) : null}
          {offPct > 0 ? (
            <View style={{ borderRadius: 999, borderWidth: 1, borderColor: "#86efac", backgroundColor: "#dcfce7", paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: "#166534", fontWeight: "900", fontSize: 11 }}>{offPct}% OFF</Text>
            </View>
          ) : null}
        </View>

        <Text style={{ marginTop: 10, color: theme.text, fontWeight: "900", fontSize: 24, letterSpacing: -0.4 }}>
          {p.name}
        </Text>

        <View
          style={{
            marginTop: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#dbe4ef",
            backgroundColor: "#ffffff",
            padding: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: "#1d4ed8", fontWeight: "900", fontSize: 28 }}>
              ₹{Math.round(price * 100) / 100}
            </Text>
            {mrp > price ? (
              <Text style={{ marginTop: 2, color: theme.textDim, fontWeight: "900", textDecorationLine: "line-through", fontSize: 14 }}>
                MRP ₹{Math.round(mrp * 100) / 100}
              </Text>
            ) : null}
          </View>
          <Text style={{ color: p.stock > 0 ? "#166534" : theme.roseText, fontWeight: "900", fontSize: 13 }}>
            {p.stock > 0 ? `In stock (${p.stock})` : "Out of stock"}
          </Text>
        </View>

        {p.description?.trim() ? (
          <View
            style={{
              marginTop: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              backgroundColor: "#ffffff",
              padding: 12,
            }}
          >
            <Text style={{ color: theme.text, fontWeight: "900", fontSize: 16 }}>Details</Text>
            <Text style={{ marginTop: 6, color: theme.textMuted, fontWeight: "600", lineHeight: 20 }}>
              {p.description}
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: 14 }}>
          <Text style={{ color: theme.text, fontWeight: "900", fontSize: 16 }}>Store</Text>
          <Pressable
            onPress={() => router.push(`/store/${p.store.id}`)}
            style={{
              marginTop: 8,
              backgroundColor: "#ffffff",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: "900" }}>{p.store.name}</Text>
              <Text style={{ marginTop: 4, color: theme.textMuted, fontWeight: "600" }} numberOfLines={2}>
                {p.store.address}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textDim} />
          </Pressable>
        </View>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          backgroundColor: "#ffffff",
          padding: 16,
        }}
      >
        <Text style={{ color: theme.text, fontWeight: "900", fontSize: 13, marginBottom: 8 }}>
          Add to cart
        </Text>
        <CartQtyStepper
          line={{
            productId: p.id,
            storeId: p.store.id,
            name: p.name,
            price: price,
            storeName: p.store.name,
            imageUrl: p.imageUrl ?? p.imageUrl2 ?? null,
            unitLabel: p.unitLabel ?? null,
            mrp: mrp > price ? mrp : undefined,
            discountPercent:
              typeof p.discountPercent === "number" && p.discountPercent > 0 ? p.discountPercent : undefined,
          }}
          maxQty={p.stock}
          canAdd={p.stock > 0}
        />
      </View>
    </View>
  );
}

