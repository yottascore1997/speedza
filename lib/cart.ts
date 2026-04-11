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

export async function addToCart(line: Omit<CartLine, "quantity"> & { quantity?: number }) {
  const cart = await getCart();
  if (cart.length && cart[0].storeId !== line.storeId) {
    await setCart([]);
  }
  const next = await getCart();
  const idx = next.findIndex((l) => l.productId === line.productId);
  const q = line.quantity ?? 1;
  if (idx >= 0) {
    next[idx] = {
      ...next[idx],
      quantity: next[idx].quantity + q,
      storeName: line.storeName ?? next[idx].storeName,
      imageUrl: line.imageUrl ?? next[idx].imageUrl,
      unitLabel: line.unitLabel ?? next[idx].unitLabel,
    };
  } else {
    next.push({
      productId: line.productId,
      storeId: line.storeId,
      name: line.name,
      price: line.price,
      quantity: q,
      storeName: line.storeName,
      imageUrl: line.imageUrl,
      unitLabel: line.unitLabel,
    });
  }
  await setCart(next);
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
