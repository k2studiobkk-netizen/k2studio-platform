export function calculateCustomLineTotal(quantity, unitPrice) {
  const normalizedQuantity = Number(quantity);
  const normalizedUnitPrice = Number(unitPrice);
  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 1 || normalizedQuantity > 1_000_000) {
    throw new Error("Invalid custom item quantity");
  }
  if (!Number.isFinite(normalizedUnitPrice) || normalizedUnitPrice < 0 || normalizedUnitPrice > 10_000_000) {
    throw new Error("Invalid custom item unit price");
  }
  return Math.round(normalizedQuantity * normalizedUnitPrice * 100) / 100;
}
