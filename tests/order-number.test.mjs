import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeOrderNumber,
  validateOrderNumberChange,
} from "../app/order-number.mjs";

test("normalizes manually entered order numbers", () => {
  assert.equal(normalizeOrderNumber("  k2-1233  "), "K2-1233");
});

test("accepts K2 sequential order number format", () => {
  assert.deepEqual(validateOrderNumberChange("K2K-20260902-ABC12345", "k2-1233"), {
    ok: true,
    value: "K2-1233",
    changed: true,
  });
});

test("accepts every sales-channel prefix", () => {
  for (const orderNumber of ["K2-1233", "SW-1234", "LK-1235", "LS-1236"]) {
    assert.equal(
      validateOrderNumberChange("K2K-20260902-ABC12345", orderNumber).ok,
      true,
    );
  }
});

test("keeps an unchanged legacy order number valid", () => {
  assert.deepEqual(
    validateOrderNumberChange("K2K-20260902-ABC12345", "K2K-20260902-ABC12345"),
    { ok: true, value: "K2K-20260902-ABC12345", changed: false },
  );
});

test("rejects an invalid new order number", () => {
  const result = validateOrderNumberChange("K2K-20260902-ABC12345", "K2-123");
  assert.equal(result.ok, false);
  assert.match(result.error, /K2-1233/);
});
