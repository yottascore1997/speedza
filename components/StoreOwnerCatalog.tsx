import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api, getApiBase, getToken } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/assets";

const FONT_DISPLAY = Platform.select({
  ios: "SF Pro Display",
  android: "sans-serif-medium",
  default: "System",
});
const FONT_BODY = Platform.select({
  ios: "SF Pro Text",
  android: "sans-serif",
  default: "System",
});

const CAT = {
  screenBg: "#f4f2ef",
  card: "#ffffff",
  border: "#e5e2dd",
  inputBg: "#ebe8e4",
  label: "#6b6560",
  ink: "#1a1816",
  muted: "#948f89",
  /** Price accent — green */
  primary: "#15803d",
  primaryDeep: "#14532d",
  green: "#16a34a",
  greenDark: "#15803d",
  greenDeep: "#14532d",
  greenSoft: "#f0fdf4",
  greenBorder: "#86efac",
  greenMuted: "#dcfce7",
  /** Solid / gradient buttons */
  btnSolid: "#16a34a",
  btnSolidDark: "#15803d",
  btnGrad: ["#22c55e", "#15803d"] as const,
  btnGradDeep: ["#15803d", "#14532d"] as const,
  danger: "#b91c1c",
  dangerSoft: "#fef2f2",
  accentLine: "#16a34a",
} as const;

type StoreMine = {
  id: string;
  name: string;
  status: string;
  shopVertical?: string;
  imageUrl?: string | null;
  openingHoursEnabled?: boolean;
  openingTime?: string | null;
  closingTime?: string | null;
};

type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  mrp: number;
  stock: number;
  isActive: boolean;
  imageUrl?: string | null;
  imageUrl2?: string | null;
  discountPercent?: number | null;
  unitLabelEffective?: string | null;
};

type CatalogCategory = {
  id: string;
  name: string;
  products: CatalogProduct[];
};

function fmtTime(t: string | null | undefined): string {
  if (!t) return "";
  const m = String(t).match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "";
}

function verticalTitle(v?: string) {
  const x = (v ?? "").toLowerCase();
  if (x === "food") return "Food & Beverages";
  if (x === "grocery" || !x) return "Grocery";
  return v?.replace(/_/g, " ") ?? "Grocery";
}

const labelStyle = {
  color: CAT.label,
  fontSize: 10,
  fontWeight: "800" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 0.7,
  fontFamily: FONT_DISPLAY,
  marginBottom: 6,
};

function CatSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
        <View style={{ width: 3, height: 20, borderRadius: 2, backgroundColor: CAT.accentLine, marginRight: 12, marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: CAT.ink, fontWeight: "800", fontSize: 17, fontFamily: FONT_DISPLAY, letterSpacing: 0.15 }}>{title}</Text>
          {hint ? (
            <Text style={{ color: CAT.muted, fontWeight: "600", fontSize: 12.5, marginTop: 4, fontFamily: FONT_BODY, lineHeight: 18 }}>{hint}</Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

type NewProductState = {
  categoryId: string;
  name: string;
  mrp: string;
  price: string;
  stock: string;
  unit: string;
};

export type StoreOwnerCatalogProps = {
  ownerName: string;
  selectedStore: StoreMine;
  categories: CatalogCategory[];
  saving: boolean;
  newProduct: NewProductState;
  setNewProduct: Dispatch<SetStateAction<NewProductState>>;
  onCreateProduct: () => void | Promise<void>;
  onUpdateProduct: (productId: string, payload: Record<string, unknown>) => void | Promise<void>;
  onDeleteProduct: (productId: string) => void | Promise<void>;
  onReloadCatalog: () => void | Promise<void>;
  onReloadStores: () => void | Promise<void>;
};

const PAGE_SIZE = 6;

export function StoreOwnerCatalog({
  ownerName,
  selectedStore,
  categories,
  saving,
  newProduct,
  setNewProduct,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  onReloadCatalog,
  onReloadStores,
}: StoreOwnerCatalogProps) {
  const [search, setSearch] = useState("");
  const [filterCatId, setFilterCatId] = useState<"all" | string>("all");
  const [inactiveOnly, setInactiveOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [hoursEnabled, setHoursEnabled] = useState(!!selectedStore.openingHoursEnabled);
  const [openAt, setOpenAt] = useState(() => fmtTime(selectedStore.openingTime));
  const [closeAt, setCloseAt] = useState(() => fmtTime(selectedStore.closingTime));
  const [masterCats, setMasterCats] = useState<{ id: string; name: string; products: { id: string }[] }[]>([]);
  const [importMcId, setImportMcId] = useState<string>("");
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});

  const rowsFlat = useMemo(() => {
    const out: { p: CatalogProduct; catName: string }[] = [];
    for (const c of categories) {
      for (const p of c.products) out.push({ p, catName: c.name });
    }
    return out;
  }, [categories]);

  useEffect(() => {
    setHoursEnabled(!!selectedStore.openingHoursEnabled);
    setOpenAt(fmtTime(selectedStore.openingTime));
    setCloseAt(fmtTime(selectedStore.closingTime));
  }, [
    selectedStore.id,
    selectedStore.openingHoursEnabled,
    selectedStore.openingTime,
    selectedStore.closingTime,
  ]);

  useEffect(() => {
    setPriceDraft((prev) => {
      const next = { ...prev };
      for (const { p } of rowsFlat) {
        if (next[p.id] === undefined) next[p.id] = String(p.price);
      }
      for (const k of Object.keys(next)) {
        if (!rowsFlat.some(({ p }) => p.id === k)) delete next[k];
      }
      return next;
    });
  }, [rowsFlat]);

  const loadMaster = useCallback(async () => {
    const key = (selectedStore.shopVertical ?? "grocery").toLowerCase() === "food" ? "food" : "grocery";
    const res = await api<{ categories: { id: string; name: string; products: { id: string }[] }[] }>(
      `/api/master/catalog?mainKey=${encodeURIComponent(key)}`,
    );
    const list = res.ok && res.data?.categories ? res.data.categories : [];
    setMasterCats(list);
    setImportMcId((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev;
      return list[0]?.id ?? "";
    });
  }, [selectedStore.shopVertical]);

  useEffect(() => {
    void loadMaster();
  }, [loadMaster]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rowsFlat.filter(({ p, catName }) => {
      if (inactiveOnly && p.isActive) return false;
      if (!inactiveOnly && filterCatId !== "all") {
        const cat = categories.find((c) => c.id === filterCatId);
        if (!cat?.products.some((x) => x.id === p.id)) return false;
      }
      if (q && !p.name.toLowerCase().includes(q) && !catName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rowsFlat, search, filterCatId, inactiveOnly, categories]);

  useEffect(() => {
    setPage(0);
  }, [search, filterCatId, inactiveOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const slice = filtered.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const coverUri = resolveMediaUrl(selectedStore.imageUrl ?? undefined);

  async function patchStore(body: Record<string, unknown>) {
    const res = await api(`/api/stores/${selectedStore.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      Alert.alert("Could not save", res.error || "Try again");
      return;
    }
    await onReloadStores();
  }

  async function saveHours() {
    if (hoursEnabled && (!openAt.trim() || !closeAt.trim())) {
      Alert.alert("Business hours", "Enter open and close time (24h, e.g. 09:00 and 22:00) before turning hours on.");
      return;
    }
    await patchStore({
      openingHoursEnabled: hoursEnabled,
      openingTime: openAt.trim() || "",
      closingTime: closeAt.trim() || "",
    });
  }

  async function uploadCover() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos", "Allow library access to set your shop cover.");
      return;
    }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (pick.canceled || !pick.assets[0]) return;
    const asset = pick.assets[0];
    const uri = asset.uri;
    const form = new FormData();
    form.append("file", { uri, name: "cover.jpg", type: "image/jpeg" } as never);
    const base = getApiBase();
    const token = await getToken();
    const res = await fetch(`${base}/api/store/upload-image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const json = (await res.json().catch(() => null)) as { imageUrl?: string; error?: string } | null;
    if (!res.ok || !json?.imageUrl) {
      Alert.alert("Upload failed", json && "error" in json ? String(json.error) : "Try again");
      return;
    }
    await patchStore({ imageUrl: json.imageUrl });
    await onReloadCatalog();
  }

  async function clearCover() {
    Alert.alert("Remove cover image?", "Your shop will fall back to the default look.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void patchStore({ imageUrl: "" }).then(() => onReloadCatalog()),
      },
    ]);
  }

  async function runImport() {
    if (!importMcId) {
      Alert.alert("Import", "Choose a template category below.");
      return;
    }
    const cat = masterCats.find((c) => c.id === importMcId);
    if (!cat?.products.length) {
      Alert.alert("Import", "This category has no template products.");
      return;
    }
    const products = cat.products.map((p) => ({ masterProductId: p.id, price: 99 }));
    const res = await api("/api/store/import-master", {
      method: "POST",
      body: JSON.stringify({
        storeId: selectedStore.id,
        masterCategoryId: importMcId,
        products,
      }),
    });
    if (!res.ok) {
      Alert.alert("Import failed", res.error || "Try again");
      return;
    }
    Alert.alert("Done", "New products were added where they did not already exist.");
    await onReloadCatalog();
  }

  async function applyQuickPrice(productId: string, mrp: number) {
    const raw = priceDraft[productId]?.trim() ?? "";
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) {
      Alert.alert("Price", "Enter a valid selling price.");
      return;
    }
    if (v > mrp) {
      Alert.alert("Price", "Selling price cannot be above MRP.");
      return;
    }
    await onUpdateProduct(productId, { price: v });
  }

  const initials = ownerName.trim().slice(0, 2).toUpperCase() || "OW";
  const activeApproved = selectedStore.status?.toUpperCase() === "APPROVED";

  const cardWrap = {
    backgroundColor: CAT.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CAT.border,
    shadowColor: "#0c0a09",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  } as const;

  return (
    <View style={{ gap: 0, position: "relative" }}>
      {saving ? (
        <View style={{ position: "absolute", right: 0, top: 0, zIndex: 20, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.96)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: CAT.border, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3 }}>
          <ActivityIndicator size="small" color={CAT.btnSolid} />
          <Text style={{ color: CAT.ink, fontWeight: "700", fontSize: 12, fontFamily: FONT_BODY }}>Saving…</Text>
        </View>
      ) : null}

      {/* Account */}
      <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 }, cardWrap]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
          <LinearGradient
            colors={[CAT.greenMuted, CAT.greenBorder]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 50, height: 50, borderRadius: 25, padding: 2 }}
          >
            <View style={{ flex: 1, borderRadius: 23, backgroundColor: CAT.card, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: CAT.greenDeep, fontWeight: "900", fontSize: 17, fontFamily: FONT_DISPLAY }}>{initials}</Text>
            </View>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={{ color: CAT.ink, fontWeight: "800", fontSize: 18, fontFamily: FONT_DISPLAY }} numberOfLines={1}>
              {selectedStore.name || "Store"}
            </Text>
            <Text style={{ color: CAT.muted, fontWeight: "700", fontSize: 11.5, marginTop: 2, fontFamily: FONT_BODY }} numberOfLines={1}>
              Store control panel
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: activeApproved ? CAT.greenSoft : CAT.greenMuted,
              borderWidth: 1,
              borderColor: activeApproved ? CAT.greenBorder : "#86efac",
            }}
          >
            <Text style={{ color: activeApproved ? CAT.greenDark : CAT.greenDeep, fontWeight: "800", fontSize: 10, fontFamily: FONT_DISPLAY, letterSpacing: 0.45 }}>
              {activeApproved ? "ACTIVE" : selectedStore.status?.toUpperCase() ?? "—"}
            </Text>
          </View>
          <Pressable
            onPress={() => void onReloadCatalog()}
            accessibilityLabel="Refresh catalog"
            style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: CAT.greenBorder, backgroundColor: CAT.greenSoft, alignItems: "center", justifyContent: "center" }}
          >
            <MaterialCommunityIcons name="refresh" size={22} color={CAT.btnSolidDark} />
          </Pressable>
        </View>
      </View>

      {/* Storefront cover */}
      <CatSection title="Shop Cover">
        <View style={[cardWrap, { overflow: "hidden", padding: 0 }]}>
          <View style={{ height: 168, backgroundColor: CAT.inputBg }}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
                <MaterialCommunityIcons name="image-filter-hdr" size={40} color={CAT.muted} />
                <Text style={{ color: CAT.muted, fontWeight: "600", fontSize: 13, marginTop: 10, fontFamily: FONT_BODY, textAlign: "center" }}>
                  No cover yet — tap Upload to add one
                </Text>
              </View>
            )}
            <View
              style={{
                position: "absolute",
                left: 12,
                bottom: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(28,25,22,0.72)",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <MaterialCommunityIcons name="eye-outline" size={16} color="#fafaf9" />
              <Text style={{ color: "#fafaf9", fontWeight: "700", fontSize: 11, fontFamily: FONT_DISPLAY }}>Preview</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: CAT.border }}>
            <Pressable
              onPress={() => void uploadCover()}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: CAT.greenBorder, backgroundColor: CAT.greenSoft }}
            >
              <MaterialCommunityIcons name="cloud-upload-outline" size={22} color={CAT.btnSolidDark} />
              <Text style={{ color: CAT.greenDeep, fontWeight: "800", fontSize: 13, fontFamily: FONT_DISPLAY }}>Upload</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void (async () => {
                  await onReloadStores();
                  await onReloadCatalog();
                })();
              }}
              style={{ flex: 1.15, borderRadius: 12, overflow: "hidden" }}
            >
              <LinearGradient colors={[...CAT.btnGrad]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 }}>
                <MaterialCommunityIcons name="sync" size={22} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 13, fontFamily: FONT_DISPLAY }}>Sync data</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={() => void clearCover()}
              accessibilityLabel="Remove cover"
              style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: "#fecaca", backgroundColor: CAT.dangerSoft, alignItems: "center", justifyContent: "center" }}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={22} color={CAT.danger} />
            </Pressable>
          </View>
        </View>
      </CatSection>

      {/* Hours */}
      <CatSection title="Opening Hours">
        <View style={[cardWrap, { padding: 16 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: CAT.inputBg, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="clock-outline" size={24} color={CAT.btnSolidDark} />
              </View>
              <View>
                <Text style={{ color: CAT.ink, fontWeight: "800", fontSize: 15, fontFamily: FONT_DISPLAY }}>Store timing</Text>
                <Text style={{ color: CAT.muted, fontWeight: "600", fontSize: 12, marginTop: 2, fontFamily: FONT_BODY }}>24-hour format</Text>
              </View>
            </View>
            <Switch value={hoursEnabled} onValueChange={setHoursEnabled} trackColor={{ false: "#d6d3d1", true: "#86efac" }} thumbColor="#fff" />
          </View>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Opens at</Text>
              <TextInput
                value={openAt}
                onChangeText={setOpenAt}
                placeholder="09:00"
                placeholderTextColor={CAT.muted}
                style={{
                  backgroundColor: CAT.inputBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  fontWeight: "700",
                  color: CAT.ink,
                  fontFamily: FONT_BODY,
                  borderWidth: 1,
                  borderColor: CAT.border,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Closes at</Text>
              <TextInput
                value={closeAt}
                onChangeText={setCloseAt}
                placeholder="22:00"
                placeholderTextColor={CAT.muted}
                style={{
                  backgroundColor: CAT.inputBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  fontWeight: "700",
                  color: CAT.ink,
                  fontFamily: FONT_BODY,
                  borderWidth: 1,
                  borderColor: CAT.border,
                }}
              />
            </View>
          </View>
          <Pressable
            onPress={() => void saveHours()}
            disabled={saving}
            style={{ marginTop: 14, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: CAT.btnSolid, borderWidth: 0, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, opacity: saving ? 0.65 : 1 }}
          >
            <MaterialCommunityIcons name="content-save-outline" size={20} color="#ffffff" />
            <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 13, fontFamily: FONT_DISPLAY }}>Save</Text>
          </Pressable>
        </View>
      </CatSection>

      {/* Import */}
      <CatSection title="Quick Import Catalog">
        <View style={[cardWrap, { padding: 16, backgroundColor: "#f7fdf9", borderColor: "#d1fae5" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <MaterialCommunityIcons name="database-import" size={26} color={CAT.green} />
            <Text style={{ color: "#14532d", fontWeight: "800", fontSize: 16, fontFamily: FONT_DISPLAY, flex: 1 }}>Select category</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {masterCats.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setImportMcId(c.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: importMcId === c.id ? CAT.btnSolidDark : CAT.border,
                    backgroundColor: importMcId === c.id ? CAT.greenMuted : "rgba(255,255,255,0.65)",
                  }}
                >
                  <Text style={{ color: importMcId === c.id ? "#14532d" : CAT.ink, fontWeight: "700", fontSize: 12.5, fontFamily: FONT_BODY }} numberOfLines={1}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Pressable
            onPress={() => void runImport()}
            disabled={saving || !importMcId}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: CAT.btnSolid, borderRadius: 14, paddingVertical: 14, opacity: saving || !importMcId ? 0.55 : 1 }}
          >
            <MaterialCommunityIcons name="download-circle" size={22} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15, fontFamily: FONT_DISPLAY }}>Import</Text>
          </Pressable>
        </View>
      </CatSection>

      {/* New product */}
      <CatSection title="Add New Product">
        <View style={[cardWrap, { padding: 16 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ color: CAT.ink, fontWeight: "800", fontSize: 16, fontFamily: FONT_DISPLAY }}>Product Info</Text>
            <MaterialCommunityIcons name="information-outline" size={22} color={CAT.muted} />
          </View>
          <Text style={labelStyle}>Master Category</Text>
          <View style={{ backgroundColor: CAT.inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: CAT.border, marginBottom: 14 }}>
            <Text style={{ color: CAT.ink, fontWeight: "700", fontSize: 14, fontFamily: FONT_BODY }}>{verticalTitle(selectedStore.shopVertical)}</Text>
          </View>
          <Text style={labelStyle}>Subcategory</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setNewProduct((p) => ({ ...p, categoryId: c.id }))}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: newProduct.categoryId === c.id ? CAT.btnSolidDark : CAT.border,
                    backgroundColor: newProduct.categoryId === c.id ? CAT.greenSoft : CAT.card,
                  }}
                >
                  <Text style={{ color: newProduct.categoryId === c.id ? CAT.greenDeep : CAT.ink, fontWeight: "700", fontSize: 12.5, fontFamily: FONT_BODY }} numberOfLines={1}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Text style={labelStyle}>Product Name</Text>
          <TextInput
            value={newProduct.name}
            onChangeText={(v) => setNewProduct((p) => ({ ...p, name: v }))}
            placeholder="Brand & Variant Name"
            placeholderTextColor={CAT.muted}
            style={{
              backgroundColor: CAT.inputBg,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 13,
              fontWeight: "600",
              color: CAT.ink,
              fontFamily: FONT_BODY,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: CAT.border,
            }}
          />
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Unit</Text>
              <TextInput
                value={newProduct.unit}
                onChangeText={(v) => setNewProduct((p) => ({ ...p, unit: v }))}
                placeholder="1 kg"
                placeholderTextColor={CAT.muted}
                style={{
                  backgroundColor: CAT.inputBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  fontWeight: "600",
                  color: CAT.ink,
                  fontFamily: FONT_BODY,
                  borderWidth: 1,
                  borderColor: CAT.border,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>MRP</Text>
              <TextInput
                value={newProduct.mrp}
                onChangeText={(v) => setNewProduct((p) => ({ ...p, mrp: v }))}
                placeholder="0"
                keyboardType="decimal-pad"
                placeholderTextColor={CAT.muted}
                style={{
                  backgroundColor: CAT.inputBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  fontWeight: "600",
                  color: CAT.ink,
                  fontFamily: FONT_BODY,
                  borderWidth: 1,
                  borderColor: CAT.border,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Price</Text>
              <TextInput
                value={newProduct.price}
                onChangeText={(v) => setNewProduct((p) => ({ ...p, price: v }))}
                placeholder="0"
                keyboardType="decimal-pad"
                placeholderTextColor={CAT.muted}
                style={{
                  backgroundColor: CAT.inputBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  fontWeight: "600",
                  color: CAT.ink,
                  fontFamily: FONT_BODY,
                  borderWidth: 1,
                  borderColor: CAT.border,
                }}
              />
            </View>
          </View>
          <Text style={labelStyle}>Current Stock</Text>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 16 }}>
            <TextInput
              value={newProduct.stock}
              onChangeText={(v) => setNewProduct((p) => ({ ...p, stock: v }))}
              placeholder="0"
              keyboardType="number-pad"
              placeholderTextColor={CAT.muted}
              style={{
                flex: 1,
                backgroundColor: CAT.inputBg,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 13,
                fontWeight: "700",
                color: CAT.ink,
                fontFamily: FONT_BODY,
                borderWidth: 1,
                borderColor: CAT.border,
              }}
            />
            <View style={{ width: 52, height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: CAT.greenBorder, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: CAT.greenSoft }}>
              <MaterialCommunityIcons name="image-plus-outline" size={26} color={CAT.btnSolidDark} />
            </View>
            <View style={{ width: 52, height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: CAT.greenBorder, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: CAT.greenSoft }}>
              <MaterialCommunityIcons name="image-plus-outline" size={26} color={CAT.btnSolidDark} />
            </View>
          </View>
          <Pressable onPress={() => void onCreateProduct()} disabled={saving} style={{ borderRadius: 14, overflow: "hidden", opacity: saving ? 0.65 : 1 }}>
            <LinearGradient colors={[...CAT.btnGradDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 }}>
              <MaterialCommunityIcons name="rocket-launch-outline" size={22} color="#ffffff" />
              <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 16, fontFamily: FONT_DISPLAY }}>Publish SKU</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </CatSection>

      {/* Catalog list */}
      <CatSection title="Catalog">
        <View style={[cardWrap, { padding: 14, marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: CAT.inputBg, borderRadius: 14, borderWidth: 1, borderColor: CAT.border, paddingHorizontal: 12 }}>
            <MaterialCommunityIcons name="magnify" size={22} color={CAT.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search products, brands..."
              placeholderTextColor={CAT.muted}
              style={{ flex: 1, paddingVertical: 13, paddingHorizontal: 8, fontWeight: "600", color: CAT.ink, fontFamily: FONT_BODY }}
            />
          </View>
        </View>
        <View style={{ gap: 8, marginBottom: 6 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 4 }}>
              <Pressable
                onPress={() => setFilterCatId("all")}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: filterCatId === "all" ? CAT.btnSolidDark : CAT.border,
                  backgroundColor: filterCatId === "all" ? CAT.btnSolid : CAT.card,
                }}
              >
                <Text style={{ color: filterCatId === "all" ? "#fff" : CAT.ink, fontWeight: "800", fontSize: 12.5, fontFamily: FONT_DISPLAY }}>All items</Text>
              </Pressable>
              {categories.slice(0, 8).map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setFilterCatId(c.id)}
                  style={{
                    paddingHorizontal: 13,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: filterCatId === c.id ? CAT.btnSolidDark : CAT.border,
                    backgroundColor: filterCatId === c.id ? CAT.btnSolid : "#fafaf9",
                  }}
                >
                  <Text style={{ color: filterCatId === c.id ? "#fff" : CAT.ink, fontWeight: "700", fontSize: 12, fontFamily: FONT_BODY }} numberOfLines={1}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingVertical: 6 }}>
            <Text style={{ color: CAT.muted, fontWeight: "600", fontSize: 12, fontFamily: FONT_BODY, flex: 1, paddingRight: 12 }}>
              Toggle off to hide products from customers.
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: CAT.label, fontWeight: "800", fontSize: 10, fontFamily: FONT_DISPLAY, letterSpacing: 0.5 }}>INACTIVE</Text>
              <Switch value={inactiveOnly} onValueChange={setInactiveOnly} trackColor={{ false: "#d6d3d1", true: "#86efac" }} thumbColor="#fff" />
            </View>
          </View>
        </View>
      </CatSection>

      {slice.length === 0 ? (
        <View style={[{ padding: 28, alignItems: "center" }, cardWrap]}>
          <MaterialCommunityIcons name="package-variant-closed" size={48} color={CAT.muted} />
          <Text style={{ color: CAT.muted, fontWeight: "700", fontSize: 14, marginTop: 12, fontFamily: FONT_BODY, textAlign: "center" }}>Nothing matches these filters.</Text>
        </View>
      ) : (
        slice.map(({ p, catName }) => {
          const thumb = resolveMediaUrl(p.imageUrl?.trim() || p.imageUrl2?.trim() || undefined);
          const disc = typeof p.discountPercent === "number" && p.discountPercent > 0 ? Math.round(p.discountPercent) : 0;
          const unit = p.unitLabelEffective?.trim() || "—";
          return (
            <View key={p.id} style={[{ marginBottom: 12, padding: 14 }, cardWrap]}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ width: 76, height: 76, borderRadius: 14, overflow: "hidden", backgroundColor: CAT.inputBg, borderWidth: 1, borderColor: CAT.border }}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <MaterialCommunityIcons name="image-off-outline" size={32} color={CAT.muted} />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Text style={{ color: CAT.ink, fontWeight: "800", fontSize: 16, fontFamily: FONT_DISPLAY, flex: 1, lineHeight: 22 }} numberOfLines={2}>
                      {p.name}
                    </Text>
                    {disc > 0 ? (
                      <View style={{ backgroundColor: CAT.greenSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 8, borderWidth: 1, borderColor: CAT.greenBorder }}>
                        <Text style={{ color: CAT.green, fontWeight: "800", fontSize: 10, fontFamily: FONT_DISPLAY }}>{disc}% off</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: CAT.muted, fontWeight: "600", fontSize: 12, marginTop: 4, fontFamily: FONT_BODY }} numberOfLines={1}>
                    {verticalTitle(selectedStore.shopVertical)} · {catName}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    <Text style={{ color: CAT.primary, fontWeight: "800", fontSize: 18, fontFamily: FONT_DISPLAY }}>₹{Number(p.price).toFixed(2)}</Text>
                    {p.mrp > p.price ? (
                      <Text style={{ color: CAT.muted, fontWeight: "600", fontSize: 13, textDecorationLine: "line-through", fontFamily: FONT_BODY }}>₹{Number(p.mrp).toFixed(2)}</Text>
                    ) : null}
                    <View style={{ backgroundColor: CAT.inputBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                      <Text style={{ color: CAT.ink, fontWeight: "700", fontSize: 11, fontFamily: FONT_DISPLAY }}>{unit}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Price (₹)</Text>
                  <TextInput
                    value={priceDraft[p.id] ?? String(p.price)}
                    onChangeText={(t) => setPriceDraft((d) => ({ ...d, [p.id]: t }))}
                    keyboardType="decimal-pad"
                    style={{
                      backgroundColor: CAT.inputBg,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 11,
                      fontWeight: "800",
                      color: CAT.ink,
                      fontFamily: FONT_DISPLAY,
                      borderWidth: 1,
                      borderColor: CAT.border,
                    }}
                  />
                </View>
                <View style={{ width: 136 }}>
                  <Text style={labelStyle}>Stock</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: CAT.inputBg, borderRadius: 12, borderWidth: 1, borderColor: CAT.border, overflow: "hidden" }}>
                    <Pressable onPress={() => void onUpdateProduct(p.id, { stock: Math.max(0, p.stock - 1) })} style={{ paddingHorizontal: 14, paddingVertical: 11, backgroundColor: CAT.greenSoft }}>
                      <MaterialCommunityIcons name="minus" size={20} color={CAT.btnSolidDark} />
                    </Pressable>
                    <Text style={{ flex: 1, textAlign: "center", fontWeight: "800", color: CAT.ink, fontFamily: FONT_DISPLAY }}>{p.stock}</Text>
                    <Pressable onPress={() => void onUpdateProduct(p.id, { stock: p.stock + 1 })} style={{ paddingHorizontal: 14, paddingVertical: 11, backgroundColor: CAT.greenSoft }}>
                      <MaterialCommunityIcons name="plus" size={20} color={CAT.btnSolidDark} />
                    </Pressable>
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: CAT.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ color: CAT.label, fontWeight: "800", fontSize: 10, fontFamily: FONT_DISPLAY, letterSpacing: 0.5 }}>LISTED</Text>
                  <Switch value={p.isActive} onValueChange={(v) => void onUpdateProduct(p.id, { isActive: v })} trackColor={{ false: "#d6d3d1", true: "#86efac" }} thumbColor="#fff" />
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={() => void applyQuickPrice(p.id, p.mrp)}
                    disabled={saving}
                    accessibilityLabel="Apply price"
                    style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: CAT.btnSolid, borderWidth: 0, alignItems: "center", justifyContent: "center" }}
                  >
                    <MaterialCommunityIcons name="check-bold" size={22} color="#ffffff" />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Alert.alert("Delete this product?", p.name, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => void onDeleteProduct(p.id) },
                      ]);
                    }}
                    accessibilityLabel="Delete product"
                    style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: CAT.dangerSoft, borderWidth: 1.5, borderColor: "#fecaca", alignItems: "center", justifyContent: "center" }}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={22} color={CAT.danger} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })
      )}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 4 }}>
        <Text style={{ color: CAT.muted, fontWeight: "600", fontSize: 12.5, fontFamily: FONT_BODY }}>
          Page {pageSafe + 1}
          {filtered.length === 0
            ? " · 0 items"
            : ` · Showing ${Math.min(PAGE_SIZE, Math.max(filtered.length - pageSafe * PAGE_SIZE, 0))} of ${filtered.length}`}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => setPage((x) => Math.max(0, x - 1))}
            disabled={pageSafe <= 0}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: pageSafe <= 0 ? CAT.border : CAT.greenBorder,
              backgroundColor: pageSafe <= 0 ? CAT.card : CAT.greenSoft,
              alignItems: "center",
              justifyContent: "center",
              opacity: pageSafe <= 0 ? 0.4 : 1,
            }}
          >
            <MaterialCommunityIcons name="chevron-left" size={26} color={pageSafe <= 0 ? CAT.muted : CAT.btnSolidDark} />
          </Pressable>
          <Pressable
            onPress={() => setPage((x) => Math.min(totalPages - 1, x + 1))}
            disabled={pageSafe >= totalPages - 1}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: pageSafe >= totalPages - 1 ? CAT.border : CAT.greenBorder,
              backgroundColor: pageSafe >= totalPages - 1 ? CAT.card : CAT.greenSoft,
              alignItems: "center",
              justifyContent: "center",
              opacity: pageSafe >= totalPages - 1 ? 0.4 : 1,
            }}
          >
            <MaterialCommunityIcons name="chevron-right" size={26} color={pageSafe >= totalPages - 1 ? CAT.muted : CAT.btnSolidDark} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
