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
import { useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { api } from "@/lib/api";
import { addToCart } from "@/lib/cart";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number | string;
  imageUrl?: string | null;
  stock: number;
  categoryId: string;
};

type Category = { id: string; name: string; products: Product[] };

export default function StoreDetailScreen() {
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

  async function add(p: Product) {
    if (p.stock < 1) {
      Alert.alert("Out of stock");
      return;
    }
    await addToCart({
      productId: p.id,
      storeId: id!,
      name: p.name,
      price: priceNum(p),
      quantity: 1,
    });
    Alert.alert("Added", `${p.name} added to cart`);
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
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: theme.primary, fontSize: 16 }}>
                      ₹{Math.round(priceNum(p) * 100) / 100}
                    </Text>
                    <Pressable
                      onPress={() => void add(p)}
                      style={{
                        backgroundColor: theme.accent,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 10,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "800" }}>Add</Text>
                    </Pressable>
                  </View>
                  <Text style={{ fontSize: 11, color: theme.textDim, marginTop: 4 }}>Stock: {p.stock}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}
