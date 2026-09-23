import test from "node:test";
import assert from "node:assert/strict";
import { quoteProposedShipping, calculateVatSnapshot, simulatePartnerEconomics } from "../app/commerce-policy.mjs";
import { makeSalesCaption, salesKitProducts, safeSalesOrigin, salesRuntimeOrigin } from "../app/sales-kit.mjs";
import { existsSync } from "node:fs";

test("shipping aggregates quantities rather than charging each artwork separately", () => {
  assert.equal(quoteProposedShipping([{ productType: "acrylic_keychain", quantity: 60 }, { productType: "acrylic_keychain", quantity: 50 }]).feeSatang, 7000);
  for (const [quantity, fee] of [[1,5000],[100,5000],[101,7000],[300,7000],[301,10000],[500,10000],[501,15000],[1000,15000]]) assert.equal(quoteProposedShipping([{ productType: "acrylic_keychain", quantity }]).feeSatang, fee);
  assert.equal(quoteProposedShipping([{ productType: "acrylic_keychain", quantity: 1001 }]).feeSatang, null);
  assert.equal(quoteProposedShipping([{ productType: "custom", quantity: 1 }]).status, "needs_rate");
  assert.throws(() => quoteProposedShipping([{ productType: "acrylic_keychain", quantity: -1 }]));
});
test("VAT mode must be explicit, independent of whether an invoice was requested", () => {
  assert.deepEqual(calculateVatSnapshot(10000, "exclusive", 700), { netSatang:10000, taxSatang:700,totalSatang:10700,mode:"exclusive",rateBps:700 });
  assert.deepEqual(calculateVatSnapshot(10700, "inclusive", 700), { netSatang:10000, taxSatang:700,totalSatang:10700,mode:"inclusive",rateBps:700 });
  assert.throws(() => calculateVatSnapshot(10000, "pending_confirmation", 700));
});
const input = { revenueSatang: 100000, productionCostSatang: 60000, shippingSubsidySatang: 5000, paymentFeeSatang: 3000, pointsReserveSatang: 2000, bonusReserveSatang: 2000,
  employeeRateBps: 200, partnerRateBps: 800, upstreamRatesBps: [100,50], minMarginBps: 1500 };
test("self purchase and referred purchase have equal benefit budgets without double rewards", () => {
  const own = simulatePartnerEconomics({ ...input, route: "self_order" }), referral = simulatePartnerEconomics({ ...input, route: "referral_order" });
  assert.equal(own.partnerDiscountSatang, 8000); assert.equal(own.partnerCommissionSatang, 0);
  assert.equal(referral.partnerDiscountSatang, 0); assert.equal(referral.partnerCommissionSatang, 8000);
  assert.equal(own.contributionSatang, referral.contributionSatang); assert.equal(own.contributionSatang, 16500);
  assert.equal(own.payoutsEnabled, false); assert.equal(own.mode, "simulation_only"); assert.equal(own.passesMargin, true);
});
test("simulator fails safely on missing, nonfinite, negative, and excessive benefits", () => {
  for (const change of [{productionCostSatang: undefined}, {revenueSatang:0}, {pointsReserveSatang:-1}, {bonusReserveSatang:Infinity}, {partnerRateBps:9999}, {upstreamRatesBps:[10,10,10]}]) assert.throws(() => simulatePartnerEconomics({ ...input, route:"self_order", ...change }));
  assert.equal(simulatePartnerEconomics({ ...input, route:"referral_order", productionCostSatang:95000 }).passesMargin, false);
});
test("sales media uses existing public assets, safe origins and factual captions", () => {
  for (const p of salesKitProducts) assert.ok(existsSync(new URL(`../public${p.image}`, import.meta.url)));
  assert.match(makeSalesCaption("keychain", "friendly", "https://order.k2group.site/#quote"), /ราคาและกำหนดผลิตขึ้นอยู่กับรายละเอียดงาน/);
  assert.throws(() => makeSalesCaption("invalid", "friendly", "https://example.com"));
  assert.throws(() => makeSalesCaption("keychain", "friendly", "javascript:alert(1)"));
  for (const url of ["http://example.com", "https://user:pass@example.com", "https://example.com/path", "https://example.com/?x=y"]) assert.throws(() => safeSalesOrigin(url));
  assert.equal(salesRuntimeOrigin("https://order.k2group.site", "http://localhost:3000/api"), "http://localhost:3000");
  assert.equal(salesRuntimeOrigin("https://order.k2group.site", "https://evil.example/api"), "https://order.k2group.site");
});
