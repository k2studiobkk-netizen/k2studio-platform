import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { calculateCustomLineTotal } from "../app/custom-order-item.mjs";
import * as vatPolicy from "../app/vat-collection-policy.mjs";
import { calculateOrderTotals } from "../app/order-pricing.mjs";
import { validateOrderNumberChange } from "../app/order-number.mjs";
import { pricingSpecificationChanged } from "../app/order-spec-change.mjs";

function load(path, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require(name) {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  }, Request, Response, File, URL, crypto, console });
  return exports;
}

for (const scenario of [
  ...["unpaid", "deposit", "paid_full"].map(payment => ({ payment, invoice: "0", mode: vatPolicy.VAT_TRANSITION, vat: "0", status: 201 })),
  { payment: "unpaid", invoice: "1", mode: vatPolicy.VAT_TRANSITION, vat: "1", status: 201 },
  { payment: "unpaid", invoice: "0", mode: vatPolicy.VAT_ALL_ORDERS, vat: "1", status: 201 },
  { payment: "unpaid", invoice: "0", mode: vatPolicy.VAT_ALL_ORDERS, vat: "0", status: 409 },
  { payment: "unpaid", invoice: "", mode: vatPolicy.VAT_TRANSITION, vat: "0", status: 400 },
  { payment: "unpaid", invoice: "0", mode: vatPolicy.VAT_TRANSITION, vat: "0", status: 409, stale: true },
  { payment: "unpaid", invoice: "0", mode: vatPolicy.VAT_TRANSITION, vat: "0", status: 409, concurrent: true },
]) {
  const { payment } = scenario;
  test(`order API ${payment}, invoice=${scenario.invoice}, ${scenario.mode}, status=${scenario.status}, stale=${scenario.stale||false}, concurrent=${scenario.concurrent||false}`, async () => {
    const db = new DatabaseSync(":memory:");
    const directory = new URL("../drizzle/", import.meta.url);
    try {
      for (const file of readdirSync(directory).filter(f => f.endsWith(".sql")).sort()) {
        const migration = readFileSync(new URL(file, directory), "utf8");
        for (const match of migration.matchAll(/(?:CREATE TABLE [\s\S]*?;|CREATE (?:UNIQUE )?INDEX [\s\S]*?;|ALTER TABLE [\s\S]*?;)/g)) db.exec(match[0]);
      }
      db.exec("INSERT INTO staff_users (id,username,display_name,role,password_hash,password_salt) VALUES (999,'test','Test Staff','admin','test-only','test-only')");
      db.exec("INSERT INTO sales_channels (code,name,prefix,platform) VALUES ('facebook_k2sign','Test Channel','K2','test')");
      db.prepare("INSERT INTO vat_collection_settings (id,mode) VALUES (1,?)").run(scenario.mode);
      const adapter = { prepare(sql) {
        if (scenario.concurrent && sql.startsWith("INSERT INTO orders")) db.exec("UPDATE vat_collection_settings SET revision=revision+1 WHERE id=1");
        const statement = db.prepare(sql);
        return { bind(...params) {
          return { async first() { return statement.get(...params) || null; }, async all() { return { results: statement.all(...params) }; }, async run() { statement.run(...params); return { success: true }; } };
        }, async all() { return { results: statement.all() }; }, async first() { return statement.get() || null; } };
      }, async batch(statements) {
        db.exec("BEGIN");
        try { const results=[]; for (const statement of statements) results.push(await statement.run()); db.exec("COMMIT"); return results; }
        catch(error) { db.exec("ROLLBACK"); throw error; }
      } };
      const files = new Map();
      const env = { DB: adapter, ORDER_FILES: { async put(key, bytes) { files.set(key, bytes); } } };
      const post = load("../app/api/orders/route.ts", {
        "cloudflare:workers": { env, waitUntil() {} },
        "../../staff-auth": { getStaffUser: async () => ({ id: 999, displayName: "Test Staff" }), audit: async () => {} },
        "../../integrations": { notifyNewOrder: async () => {} },
        "../../pricing-config": load("../app/pricing-config.ts"),
        "../../custom-order-item.mjs": { calculateCustomLineTotal },
        "../../vat-collection-policy.mjs": vatPolicy,
        "../../work-order-sync": load("../app/work-order-sync.ts"),
        "../../payment-slip-analysis": { markPaymentSlipAnalysisQueued: async () => {}, analyzePaymentSlip: async () => {} },
      }).POST;
      const form = new FormData();
      for (const [key, value] of Object.entries({ name: "TEST", phone: "0000000000", contact_channel: "facebook_k2sign", sales_owner_id: "999", requested_date: "2026-09-30", payment_status: payment, deposit_amount: "100", shipping_fee: "50", rush_mode: "urgent", requested_speed_days: "3", rush_fee: "250", delivery_tier: "express_1", items_json: JSON.stringify([{ productType: "custom", itemName: "Test product", description: "Local test only", quantity: 2, unitPrice: 100, lineTotal: 200 }]) })) form.set(key, value);
      if (payment !== "unpaid") form.set("payment_slip", new File([new Uint8Array([1,2,3])], "test-slip.png", { type: "image/png" }));
      form.set("tax_invoice_requested",scenario.invoice); form.set("vat_applied",scenario.vat); form.set("vat_policy_revision",scenario.stale ? "99" : "1");
      const response = await post(new Request("http://local.test/api/orders", { method: "POST", body: form }));
      assert.equal(response.status, scenario.status, await response.clone().text());
      if (scenario.status !== 201) { assert.equal(db.prepare("SELECT COUNT(*) AS n FROM orders").get().n,0); return; }
      const result = await response.json();
      const order = db.prepare("SELECT * FROM orders WHERE public_token=?").get(result.publicToken);
      assert.equal(order.estimated_total, scenario.vat === "1" ? "467.5" : "450");
      assert.equal(order.vat_applied, Number(scenario.vat));
      assert.equal(order.tax_invoice_requested, Number(scenario.invoice));
      assert.equal(order.vat_policy_mode, scenario.mode); assert.equal(order.vat_policy_revision, 1);
      if (scenario.vat === "0") assert.match(vatPolicy.orderTaxCollectionLabel(order), /รอฝ่ายบัญชีแยกภาษี/);
      assert.equal(order.deposit_amount, payment === "paid_full" ? "500.00" : payment === "deposit" ? "100.00" : "0.00");
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id=?").get(order.id).n, 1);
      const work = db.prepare("SELECT * FROM work_orders WHERE order_id=?").get(order.id);
      assert.equal(work.status, "draft");
      assert.equal(work.customer_requested_date, "2026-09-30");
      assert.equal(work.priority, "urgent");
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM order_payment_receipts WHERE order_id=?").get(order.id).n, payment === "unpaid" ? 0 : 1);
      assert.equal(files.size, payment === "unpaid" ? 0 : 1);
      // Changing the global policy must not change an existing order even when subsequently edited.
      db.prepare("UPDATE vat_collection_settings SET mode=?,revision=revision+1 WHERE id=1").run(scenario.mode === vatPolicy.VAT_TRANSITION ? vatPolicy.VAT_ALL_ORDERS : vatPolicy.VAT_TRANSITION);
      const patch = load("../app/api/admin/orders/[id]/details/route.ts", {
        "cloudflare:workers": { env },
        "../../../../../staff-auth": { getStaffUser: async () => ({ id:999, role:"admin", displayName:"Test Staff" }), canManageOrderNumber: () => true, audit: async () => {} },
        "../../../../../order-pricing.mjs": { calculateOrderTotals },
        "../../../../../order-number.mjs": { validateOrderNumberChange },
        "../../../../../pricing-config": load("../app/pricing-config.ts"),
        "../../../../../order-spec-change.mjs": { pricingSpecificationChanged },
        "../../../../../work-order-sync": load("../app/work-order-sync.ts"),
        "../../../../../vat-collection-policy.mjs": vatPolicy,
      }).PATCH;
      const savedItem=db.prepare("SELECT id FROM order_items WHERE order_id=?").get(order.id);
      const editPayload={ contactName:"TEST Updated", phone:"0000000000", contactChannel:"facebook_k2sign", salesOwnerId:999, fileDeliveryMethod:"upload", requestedDate:"2026-09-30", rushMode:"urgent", requestedSpeedDays:3, rushFee:250, deliveryTier:"express_1", vatApplied:false, items:[{ id:savedItem.id, productType:"custom", itemName:"Test product", description:"Local test only", quantity:2 }] };
      const edited=await patch(new Request("http://local.test/api/admin/orders/1/details",{method:"PATCH",body:JSON.stringify(editPayload)}),{params:Promise.resolve({id:String(order.id)})});
      assert.equal(edited.status,200,await edited.clone().text());
      const afterEdit=db.prepare("SELECT * FROM orders WHERE id=?").get(order.id);
      assert.equal(Number(afterEdit.estimated_total),Number(order.estimated_total),"document/customer edit preserves both VAT and rush fee");
      assert.equal(afterEdit.vat_policy_mode,order.vat_policy_mode);
      assert.equal(afterEdit.vat_policy_revision,order.vat_policy_revision);
      assert.equal(afterEdit.tax_invoice_requested,order.tax_invoice_requested);
      assert.equal(afterEdit.vat_applied,order.vat_applied,"client VAT flag cannot override the saved policy");
    } finally { db.close(); }
  });
}
