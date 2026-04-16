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
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, getToken } from "@/lib/api";
import { theme } from "@/lib/theme";
import { resolveMediaUrl } from "@/lib/assets";
import { CommonShopHeader } from "@/components/CommonShopHeader";

const DEFAULT_LAT = 28.4595;
const DEFAULT_LNG = 77.0266;

const PAD = 16;
const COLS = 4;
const TILE_GAP = 10;

/** Match reference-like light tile background */
const TILE_SURFACE = "#e9f3f7";

type SubCategory = {
  id: string;
  name: string;
  imageUrl?: string | null;
};

type MainCategory = {
  id: string;
  key: string;
  name: string;
  subcategories: SubCategory[];
};

export default function CategoriesTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();

  const usable = windowW - PAD * 2;
  const cell = (usable - TILE_GAP * (COLS - 1)) / COLS;

  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
  const [mains, setMains] = useState<MainCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const resolveCoords = useCallback(async () => {
    const token = await getToken();
    if (token) {
      const addr = await api<{ address: { latitude: number; longitude: number } | null }>("/api/user/address");
      if (addr.ok && addr.data?.address) {
        return { la: addr.data.address.latitude, ln: addr.data.address.longitude };
      }
    }
    return { la: DEFAULT_LAT, ln: DEFAULT_LNG };
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const { la, ln } = await resolveCoords();
      setLat(la);
      setLng(ln);
      const tree = await api<{ mains: MainCategory[] }>("/api/master/shop-tree");
      if (tree.ok && tree.data?.mains) setMains(tree.data.mains);
      else setErr(tree.error || "Could not load categories");
    } finally {
      setLoading(false);
    }
  }, [resolveCoords]);

  useEffect(() => {
    void load();
  }, [load]);

  function openMainHub(mainKey: string) {
    const href =
      `/category/${encodeURIComponent(mainKey)}?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}` as Href;
    router.push(href);
  }

  function openSubcategory(mainKey: string, sub: SubCategory) {
    const href =
      `/category/${encodeURIComponent(mainKey)}/${encodeURIComponent(sub.id)}?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&catalogKey=${encodeURIComponent(mainKey)}&subname=${encodeURIComponent(sub.name)}` as Href;
    router.push(href);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.screenBg }}>
      <CommonShopHeader safeTop={insets.top} activeKey="__shop__" />
      {loading && mains.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: PAD,
            paddingTop: 12,
            paddingBottom: 32 + insets.bottom,
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={theme.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {err ? (
            <View
              style={{
                padding: 14,
                borderRadius: 16,
                backgroundColor: theme.roseBg,
                borderWidth: 1,
                borderColor: theme.roseBorder,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: theme.roseText, fontWeight: "600" }}>{err}</Text>
            </View>
          ) : null}

          {mains.map((m) => (
            <View key={m.id} style={{ marginBottom: 24 }}>
              <Pressable onPress={() => openMainHub(m.key)} style={{ marginBottom: 10 }}>
                <Text
                  style={{
                    fontSize: 39 / 2,
                    fontWeight: "900",
                    color: "#2b2d33",
                    letterSpacing: -0.35,
                  }}
                  numberOfLines={2}
                >
                  {m.name}
                </Text>
              </Pressable>

              {m.subcategories.length === 0 ? (
                <Text style={{ fontSize: 13, color: theme.textMuted, fontWeight: "600" }}>No subcategories yet.</Text>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {m.subcategories.map((sub, idx) => {
                    const col = idx % COLS;
                    const isLastInRow = col === COLS - 1;
                    const thumb = sub.imageUrl?.trim() ? resolveMediaUrl(sub.imageUrl) : undefined;

                    return (
                      <Pressable
                        key={sub.id}
                        onPress={() => openSubcategory(m.key, sub)}
                        style={({ pressed }) => ({
                          width: cell,
                          marginRight: isLastInRow ? 0 : TILE_GAP,
                          marginBottom: 16,
                          opacity: pressed ? 0.92 : 1,
                        })}
                      >
                        <View
                          style={{
                            width: cell,
                            height: cell,
                            borderRadius: 16,
                            backgroundColor: TILE_SURFACE,
                            overflow: "hidden",
                          }}
                        >
                          {thumb ? (
                            <Image
                              source={{ uri: thumb }}
                              style={{ width: cell, height: cell }}
                              contentFit="cover"
                              contentPosition="center"
                              cachePolicy="memory-disk"
                              recyclingKey={sub.id}
                            />
                          ) : (
                            <View
                              style={{
                                width: cell,
                                height: cell,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: TILE_SURFACE,
                              }}
                            >
                              <MaterialCommunityIcons name="package-variant" size={Math.min(34, cell * 0.38)} color="#94b8c9" />
                            </View>
                          )}
                        </View>
                        <Text
                          numberOfLines={2}
                          style={{
                            marginTop: 8,
                            fontSize: 14 / 1.15,
                            fontWeight: "800",
                            color: "#32343a",
                            textAlign: "center",
                            lineHeight: 17,
                            letterSpacing: -0.15,
                          }}
                        >
                          {sub.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
