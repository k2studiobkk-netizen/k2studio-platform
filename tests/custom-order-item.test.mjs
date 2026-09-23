import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateCustomLineTotal } from "../app/custom-order-item.mjs";

test("custom order item total uses quantity times manual unit price", () => {
  assert.equal(calculateCustomLineTotal(25, 42.5), 1062.5);
  assert.equal(calculateCustomLineTotal(3, 99.99), 299.97);
});

test("custom order item rejects invalid quantity and price", () => {
  assert.throws(() => calculateCustomLineTotal(0, 10));
  assert.throws(() => calculateCustomLineTotal(1.5, 10));
  assert.throws(() => calculateCustomLineTotal(10, -1));
});

test("custom orders are staff-only and persist their type and description", async () => {
  const route = await readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const document = await readFile(new URL("../app/order/[token]/page.tsx", import.meta.url), "utf8");
  assert.match(route, /item\.productType==="custom"/);
  assert.match(route, /กรุณาเข้าสู่ระบบทีมงานก่อนสร้างใบงาน/);
  assert.match(route, /product_type,item_name,item_description/);
  assert.match(schema, /productType: text\("product_type"\)/);
  assert.match(schema, /itemDescription: text\("item_description"\)/);
  assert.match(document, /งานสั่งทำอื่น ๆ/);
  assert.match(document, /item_description/);
});
