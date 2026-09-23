import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as policy from "../app/vat-collection-policy.mjs";

const migration = readFileSync(new URL("../drizzle/0039_vat_collection_policy.sql", import.meta.url), "utf8");
function setup(t, user = { id: 1, role: "admin", username: "test", displayName: "Test" }) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("CREATE TABLE orders (id INTEGER PRIMARY KEY, estimated_total TEXT, vat_applied INTEGER, vat_amount TEXT); INSERT INTO orders VALUES (1,'1070',1,'70'),(2,'1000',0,'0'); CREATE TABLE audit_logs (order_id INTEGER,user_id INTEGER,username TEXT,display_name TEXT,action TEXT,details TEXT);");
  const before = sqlite.prepare("SELECT * FROM orders").all();
  sqlite.exec(migration);
  function prepare(sql) {
    const statement = sqlite.prepare(sql);
    function bound(params) { return { async first() { return statement.get(...params) || null; }, execute() { return { results: statement.all(...params), success: true }; } }; }
    return { ...bound([]), bind(...params) { return bound(params); } };
  }
  const db = { prepare, async batch(statements) {
    sqlite.exec("BEGIN");
    try { const results = statements.map(statement => statement.execute()); sqlite.exec("COMMIT"); return results; }
    catch(error) { sqlite.exec("ROLLBACK"); throw error; }
  } };
  const code = ts.transpileModule(readFileSync(new URL("../app/api/admin/vat-policy/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const dependencies = { "cloudflare:workers": { env: { DB: db } }, "../../../staff-auth": { getStaffUser: async () => user }, "../../../vat-collection-policy.mjs": policy };
  runInNewContext(code, { exports, require(name) { if (!(name in dependencies)) throw new Error(name); return dependencies[name]; }, Response, URL, crypto });
  return { sqlite, db, before, ...exports };
}
function request(overrides = {}, origin = "https://local.test") {
  return new Request("https://local.test/api/admin/vat-policy", { method: "PATCH", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ mode: policy.VAT_ALL_ORDERS, revision: 1, confirmed: true, ...overrides }) });
}

test("transition has two explicit collection choices; universal mode adds regardless of document", () => {
  for (const mode of policy.VAT_POLICY_MODES) for (const invoice of [true,false]) {
    const result = policy.vatCollectionDecision(mode, invoice);
    assert.equal(result.addVat, mode === policy.VAT_ALL_ORDERS || invoice);
    assert.equal(result.invoiceRequested, invoice);
    assert.equal(result.accountingTreatment, result.addVat ? "collected_at_summary" : "manual_accounting_pending");
  }
  assert.throws(() => policy.vatCollectionDecision(policy.VAT_TRANSITION,null));
  assert.throws(() => policy.vatCollectionDecision("tax_exempt",false));
  assert.match(policy.orderTaxCollectionLabel({ vat_policy_mode: "", vat_applied: 0 }), /ข้อมูลเดิม/);
});

test("migration preserves every legacy value and does not invent invoice preferences", async t => {
  const { sqlite, db, before } = setup(t);
  const after = sqlite.prepare("SELECT * FROM orders").all();
  assert.deepEqual(after.map(({ tax_invoice_requested, vat_policy_mode, vat_policy_revision, ...old }) => old), before.map(row => ({ ...row })));
  assert.ok(after.every(row => row.tax_invoice_requested === null && row.vat_policy_mode === "" && row.vat_policy_revision === null));
  assert.equal((await policy.getVatCollectionPolicy(db)).mode, policy.VAT_TRANSITION);
});

test("mode changes only through explicit authenticated admin confirmation, audited atomically", async t => {
  const { GET, PATCH, sqlite, before } = setup(t);
  const response = await PATCH(request());
  assert.equal(response.status,200);
  const current = await response.json();
  assert.equal(current.mode,policy.VAT_ALL_ORDERS); assert.equal(current.revision,2);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM audit_logs").get().n,1);
  assert.deepEqual(sqlite.prepare("SELECT id,estimated_total,vat_applied,vat_amount FROM orders").all(),before);
  const fetched = await GET();
  assert.equal(fetched.headers.get("cache-control"),"no-store");
  assert.equal((await fetched.json()).mode,policy.VAT_ALL_ORDERS);
  assert.equal((await PATCH(request())).status,409);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM audit_logs").get().n,1);
  // Reversion is also explicit; never a scheduled date change.
  assert.equal((await PATCH(request({ mode: policy.VAT_TRANSITION, revision:2 }))).status,200);
});

for (const [name,user,status] of [["unauthenticated",null,401],["sales",{role:"sales"},403],["sales manager",{role:"sales_manager"},403]]) {
  test(`${name} cannot change VAT collection`,async t => {
    const { PATCH, db }=setup(t,user);
    assert.equal((await PATCH(request())).status,status);
    assert.equal((await policy.getVatCollectionPolicy(db)).revision,1);
  });
}
for (const [name,overrides,origin,status] of [
  ["unconfirmed",{confirmed:false},"https://local.test",400],
  ["invalid mode",{mode:"no_vat"},"https://local.test",400],
  ["invalid revision",{revision:0},"https://local.test",400],
  ["cross origin",{},"https://other.test",403],
]) {
  test(`reject ${name} without changing settings or audit`,async t => {
    const { PATCH,db,sqlite }=setup(t);
    assert.equal((await PATCH(request(overrides,origin))).status,status);
    assert.equal((await policy.getVatCollectionPolicy(db)).revision,1);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM audit_logs").get().n,0);
  });
}
test("audit failure rolls back the financial mode change",async t => {
  const { PATCH,db,sqlite }=setup(t);
  sqlite.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'test only'); END;");
  assert.equal((await PATCH(request())).status,503);
  assert.equal((await policy.getVatCollectionPolicy(db)).revision,1);
  assert.equal((await policy.getVatCollectionPolicy(db)).mode,policy.VAT_TRANSITION);
});
test("missing policy fails closed instead of choosing a financial default",async t => {
  const { GET,sqlite }=setup(t);
  sqlite.exec("DELETE FROM vat_collection_settings");
  assert.equal((await GET()).status,503);
});
