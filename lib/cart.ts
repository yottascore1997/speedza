import AsyncStorage from "@react-native-async-storage/async-storage";

const CART_KEY = "dlf_cart";

export type CartLine = {
  productId: string;
  storeId: string;
  name: string;
  price: number;
  quantity: number;
};

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
    next[idx] = { ...next[idx], quantity: next[idx].quantity + q };
  } else {
    next.push({
      productId: line.productId,
      storeId: line.storeId,
      name: line.name,
      price: line.price,
      quantity: q,
    });
  }
  await setCart(next);
}

export async function clearCart() {
  await AsyncStorage.removeItem(CART_KEY);
}
