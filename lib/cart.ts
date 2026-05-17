import AsyncStorage from "@react-native-async-storage/async-storage";

const CART_KEY = "dlf_cart";

type CartListener = () => void;
const cartListeners = new Set<CartListener>();

/** Re-subscribe after cart mutations so tab bar / header badges update. */
export function subscribeCart(listener: CartListener) {
  cartListeners.add(listener);
  return () => {
    cartListeners.delete(listener);
  };
}

function notifyCartListeners() {
  cartListeners.forEach((l) => l());
}

export type CartLine = {
  productId: string;
  storeId: string;
  name: string;
  price: number;
  quantity: number;
  /** Cached for cart UI (order source card). */
  storeName?: string;
  imageUrl?: string | null;
  unitLabel?: string | null;
  /** Unit MRP when known (for cart display). */
  mrp?: number | null;
  /** Server / listing discount % when known. */
  discountPercent?: number | null;
};

export function cartTotalQty(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.quantity, 0);
}

export async function getCart(): Promise<CartLine[]> {
  const raw = await AsyncStorage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CartLine[];
  } catch {
    return [];
  }
}

export async function setCart(lines: CartLine[]) {
  await AsyncStorage.setItem(CART_KEY, JSON.stringify(lines));
  notifyCartListeners();
}

export type AddToCartResult =
  | { ok: true }
  | {
      ok: false;
      reason: "store_mismatch";
      currentStoreId: string;
      currentStoreName?: string;
    };

type AddToCartOptions = {
  /** When true, clears cart items from another store before adding (user confirmed). */
  replaceOnStoreMismatch?: boolean;
};

export async function addToCart(
  line: Omit<CartLine, "quantity"> & { quantity?: number },
  options?: AddToCartOptions,
): Promise<AddToCartResult> {
  let cart = await getCart();
  if (cart.length && cart[0].storeId !== line.storeId) {
    if (!options?.replaceOnStoreMismatch) {
      return {
        ok: false,
        reason: "store_mismatch",
        currentStoreId: cart[0].storeId,
        currentStoreName: cart[0].storeName,
      };
    }
    cart = [];
  }
  const idx = cart.findIndex((l) => l.productId === line.productId);
  const q = line.quantity ?? 1;
  if (idx >= 0) {
    cart[idx] = {
      ...cart[idx],
      quantity: cart[idx].quantity + q,
      storeName: line.storeName ?? cart[idx].storeName,
      imageUrl: line.imageUrl ?? cart[idx].imageUrl,
      unitLabel: line.unitLabel ?? cart[idx].unitLabel,
      mrp: line.mrp ?? cart[idx].mrp,
      discountPercent: line.discountPercent ?? cart[idx].discountPercent,
    };
  } else {
    cart.push({
      productId: line.productId,
      storeId: line.storeId,
      name: line.name,
      price: line.price,
      quantity: q,
      storeName: line.storeName,
      imageUrl: line.imageUrl,
      unitLabel: line.unitLabel,
      mrp: line.mrp,
      discountPercent: line.discountPercent,
    });
  }
  await setCart(cart);
  return { ok: true };
}

export async function clearCart() {
  await AsyncStorage.removeItem(CART_KEY);
  notifyCartListeners();
}

export async function setLineQuantity(productId: string, quantity: number) {
  const cart = await getCart();
  const idx = cart.findIndex((l) => l.productId === productId);
  if (idx < 0) return;
  if (quantity <= 0) {
    cart.splice(idx, 1);
  } else {
    cart[idx] = { ...cart[idx], quantity };
  }
  await setCart(cart);
}

export async function removeLine(productId: string) {
  const cart = await getCart();
  await setCart(cart.filter((l) => l.productId !== productId));
}
