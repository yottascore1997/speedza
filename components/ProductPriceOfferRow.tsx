import { View, Text, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "@/lib/theme";

function fmt(n: number) {
  return `₹${Math.round(n * 100) / 100}`;
}

type Props = {
  sellingPrice: number;
  mrp: number;
  discountPercent?: number | null;
  /** Tighter for category grid cards */
  compact?: boolean;
  /**
   * Zepto-style: blue % line, bold black price, grey MRP (for category tiles).
   */
  layout?: "inline" | "premiumGrid";
  /** Multiple pack prices from store menu */
  priceMax?: number | null;
  variantOptionsCount?: number;
  style?: StyleProp<ViewStyle>;
};

export function ProductPriceOfferRow({
  sellingPrice,
  mrp,
  discountPercent,
  compact = false,
  layout = "inline",
  priceMax,
  variantOptionsCount,
  style,
}: Props) {
  const showMrp = mrp > sellingPrice;
  const showDisc = typeof discountPercent === "number" && discountPercent > 0;
  const variantRange =
    typeof priceMax === "number" &&
    Number.isFinite(priceMax) &&
    priceMax > sellingPrice &&
    (variantOptionsCount ?? 0) > 1;

  const saleSize = compact ? 15 : 17;
  const mrpSize = compact ? 12 : 13;
  const badgeSize = compact ? 10 : 11;

  if (layout === "premiumGrid") {
    return (
      <View style={[{ marginTop: compact ? 6 : 8 }, style]}>
        {showDisc ? (
          <Text style={{ fontSize: 12, fontWeight: "900", color: "#2563eb" }}>
            {Math.round(discountPercent!)}% OFF
          </Text>
        ) : null}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "baseline",
            gap: 8,
            marginTop: showDisc ? 4 : 0,
          }}
        >
          {variantRange ? (
            <Text style={{ fontSize: 10, fontWeight: "800", color: theme.textMuted }}>From</Text>
          ) : null}
          <Text style={{ fontSize: compact ? 16 : 17, fontWeight: "900", color: "#0f172a" }}>
            {fmt(sellingPrice)}
            {variantRange ? ` – ${fmt(priceMax!)}` : ""}
          </Text>
          {showMrp ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: "#78716c",
                textDecorationLine: "line-through",
              }}
            >
              MRP {fmt(mrp)}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        {
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: compact ? 5 : 8,
          marginTop: compact ? 4 : 6,
        },
        style,
      ]}
    >
      {variantRange ? (
        <Text style={{ fontSize: compact ? 10 : 11, fontWeight: "800", color: theme.textMuted }}>From</Text>
      ) : null}
      <Text style={{ fontSize: saleSize, fontWeight: "900", color: theme.primary }}>
        {fmt(sellingPrice)}
        {variantRange ? ` – ${fmt(priceMax!)}` : ""}
      </Text>
      {showMrp ? (
        <Text
          style={{
            fontSize: mrpSize,
            fontWeight: "800",
            color: theme.textDim,
            textDecorationLine: "line-through",
          }}
        >
          MRP {fmt(mrp)}
        </Text>
      ) : null}
      {showDisc ? (
        <View
          style={{
            backgroundColor: theme.accentSoft,
            borderWidth: 1,
            borderColor: "#fed7aa",
            paddingHorizontal: compact ? 6 : 8,
            paddingVertical: compact ? 3 : 5,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: theme.accent, fontWeight: "900", fontSize: badgeSize }}>
            {Math.round(discountPercent!)}% OFF
          </Text>
        </View>
      ) : null}
    </View>
  );
}
