import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true);
let sql, values;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "sql") sql = node.initializer.text;
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "runtime.DB.prepare(sql).bind") values = node.arguments;
  ts.forEachChild(node, visit);
}
visit(ast);

function database() {
  const db = new DatabaseSync(":memory:");
  const directory = new URL("../drizzle/", import.meta.url);
  for (const file of readdirSync(directory).filter(file => file.endsWith(".sql")).sort()) {
    const migration = readFileSync(new URL(file, directory), "utf8");
    for (const statement of migration.matchAll(/(?:CREATE TABLE `orders`\s*\([\s\S]*?\);|ALTER TABLE `orders`[^;]*;)/g)) db.exec(statement[0]);
  }
  db.exec("CREATE TABLE vat_collection_settings (id INTEGER PRIMARY KEY,revision INTEGER); INSERT INTO vat_collection_settings VALUES (1,1)");
  return db;
}

test("order INSERT saves all bound values against migrated SQLite schema", () => {
  const db = database();
  try {
    assert.ok(sql && values);
    const fixture = values.map((_, index) => `value-${index}`);
    fixture[0] = "K2";
    fixture[44] = 0; fixture[45] = "manual_accounting_transition"; fixture[46] = 1; fixture[47] = 1;
    const saved = db.prepare(sql).get(...fixture);
    assert.equal(saved.order_number, "K2-1233");
    const order = db.prepare("SELECT * FROM orders WHERE id=?").get(saved.id);
    assert.equal(order.public_token, "value-1");
    assert.equal(order.rush_mode, "value-26");
    assert.equal(order.rush_fee, "value-29");
    assert.equal(order.payment_slip_key, "value-35");
    assert.equal(order.deposit_amount, "value-43");
    assert.equal(order.tax_invoice_requested,0); assert.equal(order.vat_policy_revision,1);
    fixture[1] = "second-token";
    assert.equal(db.prepare(sql).get(...fixture).order_number, "K2-1234");
  } finally { db.close(); }
});

test("pre-fix INSERT with two extra placeholders is rejected by SQLite", () => {
  const db = database();
  try {
    const broken = sql.replace(" FROM orders HAVING", ",?,? FROM orders HAVING");
    assert.throws(() => db.prepare(broken), /49 values for 47 columns/);
  } finally { db.close(); }
});
