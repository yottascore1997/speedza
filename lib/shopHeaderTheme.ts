/**
 * Per main vertical: top bar + category ribbon + search band (Speedza web-style).
 * `activeKey` is API `mainCategory.key` or `__shop__` on home.
 */
export type ShopHeaderColors = {
  topBar: string;
  categoryBar: string;
  searchBand: string;
  deliverGold: string;
  goBtn: string;
  logoCircle: string;
  logoText: string;
  /** Inactive category strip icon + label (dark enough on light header gradient). */
  chipInactive: string;
  activeChipShadow: string;
  /**
   * Soft vertical gradient behind the whole header (Blinkit-style premium stack).
   * Spread with `[...]` when passing to LinearGradient.
   */
  headerGradient: readonly [string, string, string];
};

const SHOP_HOME = "__shop__";

/** Home default — warm orange stack */
const HOME_ORANGE: ShopHeaderColors = {
  topBar: "#9a3412",
  categoryBar: "#ea580c",
  searchBand: "#fb923c",
  deliverGold: "#ffedd5",
  goBtn: "#c2410c",
  logoCircle: "#ffffff",
  logoText: "#7c2d12",
  chipInactive: "#292524",
  activeChipShadow: "#7c2d12",
  /** Shop home — clear orange wash (tab Home / daily essentials) */
  headerGradient: ["#fb923c", "#fdba74", "#fff4e6"],
};

/** Daily essentials — green stack */
const DAILY_GREEN: ShopHeaderColors = {
  topBar: "#14532d",
  categoryBar: "#16a34a",
  searchBand: "#4ade80",
  deliverGold: "#dcfce7",
  goBtn: "#166534",
  logoCircle: "#ffffff",
  logoText: "#14532d",
  chipInactive: "#292524",
  activeChipShadow: "#14532d",
  headerGradient: ["#22c55e", "#4ade80", "#dcfce7"],
};

/** Food — chocolate / warm brown */
const FOOD_WARM: ShopHeaderColors = {
  topBar: "#3d2318",
  categoryBar: "#a04520",
  searchBand: "#c0632d",
  deliverGold: "#e8c89a",
  goBtn: "#3d2318",
  logoCircle: "#fbbf24",
  logoText: "#3d2318",
  chipInactive: "#292524",
  activeChipShadow: "#451a03",
  headerGradient: ["#D9A078", "#FFD4B8", "#FFF0E4"],
};

/** Beverages — blue */
const BEVERAGE_BLUE: ShopHeaderColors = {
  topBar: "#1e3a8a",
  categoryBar: "#2563eb",
  searchBand: "#60a5fa",
  deliverGold: "#dbeafe",
  goBtn: "#1e3a8a",
  logoCircle: "#fef08a",
  logoText: "#1e3a8a",
  chipInactive: "#292524",
  activeChipShadow: "#172554",
  headerGradient: ["#6BB8D4", "#A8D8EC", "#D4EEF8"],
};

/** Household — purple */
const HOUSEHOLD_PURPLE: ShopHeaderColors = {
  topBar: "#4c1d95",
  categoryBar: "#7c3aed",
  searchBand: "#a78bfa",
  deliverGold: "#ede9fe",
  goBtn: "#4c1d95",
  logoCircle: "#fde047",
  logoText: "#4c1d95",
  chipInactive: "#292524",
  activeChipShadow: "#2e1065",
  headerGradient: ["#B8A5F5", "#D4C8FC", "#E8E0FD"],
};

/** Fruits & vegetables — fresh green */
const PRODUCE_GREEN: ShopHeaderColors = {
  topBar: "#14532d",
  categoryBar: "#16a34a",
  searchBand: "#4ade80",
  deliverGold: "#dcfce7",
  goBtn: "#14532d",
  logoCircle: "#fef9c3",
  logoText: "#14532d",
  chipInactive: "#292524",
  activeChipShadow: "#052e16",
  headerGradient: ["#7DCE98", "#B8EBC8", "#DCF5E4"],
};

/** Snacks / packaged — amber */
const SNACK_AMBER: ShopHeaderColors = {
  topBar: "#92400e",
  categoryBar: "#d97706",
  searchBand: "#fbbf24",
  deliverGold: "#fef3c7",
  goBtn: "#78350f",
  logoCircle: "#ffffff",
  logoText: "#78350f",
  chipInactive: "#292524",
  activeChipShadow: "#451a03",
  headerGradient: ["#E5A814", "#FCD34D", "#FEECC8"],
};

/** Personal care / beauty — rose */
const PERSONAL_ROSE: ShopHeaderColors = {
  topBar: "#9f1239",
  categoryBar: "#e11d48",
  searchBand: "#fb7185",
  deliverGold: "#ffe4e6",
  goBtn: "#881337",
  logoCircle: "#fce7f3",
  logoText: "#881337",
  chipInactive: "#292524",
  activeChipShadow: "#4c0519",
  headerGradient: ["#E895B0", "#F5C8D8", "#FCE4ED"],
};

/** Frozen / dairy cool tone — slate-teal */
const FROZEN_TEAL: ShopHeaderColors = {
  topBar: "#134e4a",
  categoryBar: "#0d9488",
  searchBand: "#5eead4",
  deliverGold: "#ccfbf1",
  goBtn: "#0f766e",
  logoCircle: "#e0f2fe",
  logoText: "#134e4a",
  chipInactive: "#292524",
  activeChipShadow: "#042f2e",
  headerGradient: ["#5CC9B8", "#9EE5D8", "#CFF5EF"],
};

function norm(k: string): string {
  return k.toLowerCase().replace(/\s+/g, "-").trim();
}

/** Explicit keys from your catalog (add more as backend adds mains). */
const KEY_THEMES: Record<string, ShopHeaderColors> = {
  grocery: DAILY_GREEN,
  "daily-essentials": DAILY_GREEN,
  essentials: DAILY_GREEN,
  food: FOOD_WARM,
  beverages: BEVERAGE_BLUE,
  beverage: BEVERAGE_BLUE,
  drinks: BEVERAGE_BLUE,
  household: HOUSEHOLD_PURPLE,
  "house-hold": HOUSEHOLD_PURPLE,
  vegetables: PRODUCE_GREEN,
  vegetable: PRODUCE_GREEN,
  fruits: PRODUCE_GREEN,
  "fruits-vegetables": PRODUCE_GREEN,
  snacks: SNACK_AMBER,
  "personal-care": PERSONAL_ROSE,
  beauty: PERSONAL_ROSE,
  frozen: FROZEN_TEAL,
  dairy: FROZEN_TEAL,
};

export function getShopHeaderColors(activeKey: string): ShopHeaderColors {
  const k = norm(activeKey);
  if (k === norm(SHOP_HOME) || k === "") {
    return HOME_ORANGE;
  }
  if (KEY_THEMES[k]) {
    return KEY_THEMES[k];
  }
  if (k.includes("food") || k.includes("meal") || k.includes("restaurant")) return FOOD_WARM;
  if (k.includes("daily") || k.includes("essential") || k.includes("grocery") || k.includes("pantry"))
    return DAILY_GREEN;
  if (k.includes("beverage") || k.includes("drink") || k.includes("juice")) return BEVERAGE_BLUE;
  if (k.includes("house") || k.includes("cleaning") || k.includes("laundry")) return HOUSEHOLD_PURPLE;
  if (k.includes("vegetable") || k.includes("fruit") || k.includes("farm")) return PRODUCE_GREEN;
  if (k.includes("snack") || k.includes("packaged")) return SNACK_AMBER;
  if (k.includes("personal") || k.includes("beauty") || k.includes("care")) return PERSONAL_ROSE;
  if (k.includes("frozen") || k.includes("dairy") || k.includes("cold")) return FROZEN_TEAL;
  return DAILY_GREEN;
}
