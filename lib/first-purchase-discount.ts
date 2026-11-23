
export const FIRST_PURCHASE_DISCOUNT_RATE = 0.10;
export const MINIMUM_ORDER_TOTAL = 1_000_000;
export const MINIMUM_ORDER_UNITS = 20;

export type FirstPurchaseDiscount = {
  subtotal: number;
  discount: number;
  finalTotal: number;
  eligibleForDiscount: boolean;
};

export function calculateFirstPurchaseDiscount(
  subtotal: number,
  totalUnits: number,
  hasConfirmedOrder: boolean
): FirstPurchaseDiscount {
  const eligibleForDiscount =
    !hasConfirmedOrder &&
    Number.isSafeInteger(subtotal) &&
    subtotal >= MINIMUM_ORDER_TOTAL &&
    Number.isSafeInteger(totalUnits) &&
    totalUnits >= MINIMUM_ORDER_UNITS;

  const discount = eligibleForDiscount
    ? Math.round(subtotal * FIRST_PURCHASE_DISCOUNT_RATE)
    : 0;

  return {
    subtotal,
    discount,
    finalTotal: subtotal - discount,
    eligibleForDiscount,
  };
}
