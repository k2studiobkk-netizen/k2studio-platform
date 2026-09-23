const numeric = (value) => Number(value);

export function pricingSpecificationChanged(stored, next) {
  const storedType = String(stored.product_type || "acrylic_keychain");
  const nextType = String(next.productType || "acrylic_keychain");
  if (storedType !== nextType) return true;
  if (nextType === "custom") {
    return numeric(stored.quantity) !== numeric(next.quantity);
  }
  return String(stored.thickness_mm) !== String(next.thickness) ||
    numeric(stored.width_cm) !== numeric(next.width) ||
    numeric(stored.height_cm) !== numeric(next.height) ||
    numeric(stored.quantity) !== numeric(next.quantity) ||
    numeric(stored.print_sides) !== numeric(next.sides) ||
    String(stored.hardware_code).toUpperCase() !== String(next.hardwareCode).toUpperCase() ||
    String(stored.packaging_type) !== String(next.packaging);
}
