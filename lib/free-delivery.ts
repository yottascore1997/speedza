/** Keep in sync with delivery/lib/free-delivery.ts */
export const FREE_DELIVERY_MIN_SUBTOTAL = 399;

export function deliveryFeeForSubtotal(
  itemsSubtotal: number,
  feePerOrder: number,
  cartHasLines: boolean,
  minFree: number = FREE_DELIVERY_MIN_SUBTOTAL,
): number {
  if (!cartHasLines) return 0;
  if (itemsSubtotal >= minFree) return 0;
  return feePerOrder;
}
