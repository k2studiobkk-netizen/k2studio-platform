import test from "node:test";
import assert from "node:assert/strict";
import { pricingSpecificationChanged } from "../app/order-spec-change.mjs";
import { calculatePrice } from "../app/pricing-config.ts";

const stored = {
  product_type: "acrylic_keychain",
  thickness_mm: "2.5",
  width_cm: "5",
  height_cm: "5",
  quantity: 200,
  print_sides: 2,
  hardware_code: "A",
  packaging_type: "standard",
};

const next = {
  productType: "acrylic_keychain",
  thickness: "2.5",
  width: 5,
  height: 5,
  quantity: 200,
  sides: 2,
  hardwareCode: "A",
  packaging: "standard",
};

test("customer-only edits do not trigger catalog repricing", () => {
  assert.equal(pricingSpecificationChanged(stored, next), false);
});

for (const [field, value] of [
  ["thickness", "3"],
  ["width", 6],
  ["height", 6],
  ["quantity", 300],
  ["sides", 1],
  ["hardwareCode", "G"],
  ["packaging", "custom"],
]) {
  test(`${field} changes trigger catalog repricing`, () => {
    assert.equal(pricingSpecificationChanged(stored, { ...next, [field]: value }), true);
  });
}

test("K2-1234 item 1 recalculates to 38 baht after changing hardware to G", () => {
  const result = calculatePrice({
    thickness: "2.5",
    width: 5,
    height: 5,
    quantity: 200,
    sides: 2,
    hardwareCode: "G",
    packaging: "standard",
  });
  assert.equal(result.manual, false);
  assert.deepEqual(
    [result.base, result.print, result.hardware, result.unit, result.total],
    [25, 5, 8, 38, 7600],
  );
});

test("custom work keeps a manual unit price when quantity changes", () => {
  assert.equal(
    pricingSpecificationChanged(
      { ...stored, product_type: "custom", quantity: 10 },
      { ...next, productType: "custom", quantity: 20 },
    ),
    true,
  );
});
