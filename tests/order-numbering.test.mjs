import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSequentialOrderNumber,
  orderPrefixForChannel,
} from "../app/order-numbering.mjs";

test("maps each sales channel to its order prefix", () => {
  assert.equal(orderPrefixForChannel("facebook_k2sign"), "K2");
  assert.equal(orderPrefixForChannel("facebook_sweetdesign"), "SW");
  assert.equal(orderPrefixForChannel("line_k2sign"), "LK");
  assert.equal(orderPrefixForChannel("line_k2studio"), "LS");
  assert.equal(orderPrefixForChannel("other"), "");
});

test("formats a shared sequential order number", () => {
  assert.equal(formatSequentialOrderNumber("K2", 7), "K2-0007");
  assert.equal(formatSequentialOrderNumber("SW", 1234), "SW-1234");
  assert.equal(formatSequentialOrderNumber("LK", 1235), "LK-1235");
  assert.equal(formatSequentialOrderNumber("LS", 1236), "LS-1236");
});

test("rejects unsupported prefixes and invalid sequences", () => {
  assert.throws(() => formatSequentialOrderNumber("XX", 1234));
  assert.throws(() => formatSequentialOrderNumber("K2", 0));
});
