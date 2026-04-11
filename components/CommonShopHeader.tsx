import { useCallback, useEffect, useState } from "react";
import { useRouter, type Href } from "expo-router";
import { api, getToken } from "@/lib/api";
import { ShopMarketHeader, type ShopHeaderMain } from "@/components/ShopMarketHeader";

const DEFAULT_LAT = 28.4595;
const DEFAULT_LNG = 77.0266;

type Props = {
  safeTop: number;
  activeKey: string;
  pageTitle?: string;
  onBackPress?: () => void;
};

export function CommonShopHeader({ safeTop, activeKey, pageTitle, onBackPress }: Props) {
  const router = useRouter();
  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
  const [mains, setMains] = useState<ShopHeaderMain[]>([]);

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

  useEffect(() => {
    void (async () => {
      const [coords, tree] = await Promise.all([
        resolveCoords(),
        api<{ mains: ShopHeaderMain[] }>("/api/master/shop-tree"),
      ]);
      setLat(coords.la);
      setLng(coords.ln);
      if (tree.ok && tree.data?.mains) setMains(tree.data.mains);
    })();
  }, [resolveCoords]);

  function openCategory(key: string) {
    const href =
      `/category/${encodeURIComponent(key)}?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}` as Href;
    router.push(href);
  }

  return (
    <ShopMarketHeader
      safeTop={safeTop}
      mains={mains}
      activeKey={activeKey}
      onShopPress={() => router.replace("/")}
      onCategoryPress={(key) => openCategory(key)}
      pageTitle={pageTitle}
      onBackPress={onBackPress}
    />
  );
}
