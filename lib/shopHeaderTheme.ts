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
  /** Inactive chips on category bar (usually white on saturated mid-tone). */
  chipInactive: string;
  activeChipShadow: string;
};

const SHOP_HOME = "__shop__";

/** Home / daily essentials / grocery — warm orange stack (bottom-nav default) */
const DAILY_GREEN: ShopHeaderColors = {
  topBar: "#9a3412",
  categoryBar: "#ea580c",
  searchBand: "#fb923c",
  deliverGold: "#ffedd5",
  goBtn: "#c2410c",
  logoCircle: "#ffffff",
  logoText: "#7c2d12",
  chipInactive: "#ffffff",
  activeChipShadow: "#7c2d12",
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
  chipInactive: "#ffffff",
  activeChipShadow: "#451a03",
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
  chipInactive: "#ffffff",
  activeChipShadow: "#172554",
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
  chipInactive: "#ffffff",
  activeChipShadow: "#2e1065",
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
  chipInactive: "#ffffff",
  activeChipShadow: "#052e16",
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
  chipInactive: "#ffffff",
  activeChipShadow: "#451a03",
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
  chipInactive: "#ffffff",
  activeChipShadow: "#4c0519",
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
  chipInactive: "#ffffff",
  activeChipShadow: "#042f2e",
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
    return DAILY_GREEN;
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
