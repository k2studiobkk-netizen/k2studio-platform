import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { salesQueries, salesScope, salesDateRange } from "../app/sales-dashboard.mjs";

export function fixtureDb() {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../drizzle/", import.meta.url);
  for (const file of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) for (const match of readFileSync(new URL(file,dir),"utf8").matchAll(/(?:CREATE TABLE [\s\S]*?;|CREATE (?:UNIQUE )?INDEX [\s\S]*?;|ALTER TABLE [\s\S]*?;)/g)) db.exec(match[0]);
  return db;
}
function insert(db, table, values) {
  const all = { ...values };
  for (const column of db.prepare(`PRAGMA table_info(${table})`).all()) if (column.notnull && column.dflt_value === null && !(column.name in all)) all[column.name] = column.type === "INTEGER" || column.type === "REAL" ? 0 : "";
  db.prepare(`INSERT INTO ${table} (${Object.keys(all).join(",")}) VALUES (${Object.keys(all).map(() => "?").join(",")})`).run(...Object.values(all));
}
test("dashboard queries execute on actual migrations and do not multiply orders or receipts", () => {
  const db = fixtureDb();
  try {
    insert(db,"staff_users",{id:1,username:"sale-one",display_name:"Sale One",role:"sales"}); insert(db,"staff_users",{id:2,username:"sale-two",display_name:"Sale Two",role:"sales"});
    insert(db,"sales_channels",{code:"test",name:"Page A",prefix:"TEST"});
    for (const [id, owner, created, status, deposit] of [[1,1,"2026-09-10 05:00:00","waiting_for_graphic","600"],[2,2,"2026-09-11 05:00:00","waiting_for_graphic","0"],[3,1,"2026-09-12 05:00:00","cancelled","100"],[4,1,"2026-08-30 05:00:00","waiting_for_graphic","300"]]) insert(db,"orders",{id,order_number:`TEST-${id}`,public_token:`token-${id}`,created_at:created,order_status:status,estimated_total:"1070",vat_amount:"70",shipping_fee:"50",deposit_amount:deposit,sales_owner_id:owner,sales_owner_name: id===1?"Old name":"Same name",contact_channel:"test",requested_date:"2026-09-20"});
    for (const [id, order, amount] of [[1,1,"200"],[2,1,"400"],[3,3,"100"],[4,4,"300"]]) insert(db,"order_payment_receipts",{id,order_id:order,amount,created_at:"2026-09-15 03:00:00",created_by_id:1});
    for (const [id,order,line] of [[1,1,1],[2,1,2],[3,2,1]]) insert(db,"order_items",{id,order_id:order,line_no:line,quantity:10,line_total:order===1?"500":"1000",product_type:"acrylic_keychain"});
    const params = {1:null,2:"2026-09-01",3:"2026-09-21"};
    const results = Object.fromEntries(Object.entries(salesQueries).map(([key, sql]) => [key,db.prepare(sql).all(params)]));
    assert.equal(results.summary[0].sales,2000); assert.equal(results.summary[0].orders,2); assert.equal(results.summary[0].outstanding,1640);
    assert.equal(results.cash[0].received,1000,"receipt date includes old/cancelled order cash and avoids double counting deposit");
    assert.equal(results.products[0].sales,2000); assert.equal(results.sellers.length,2); assert.equal(results.sellers[0].label,"Sale One");
    const own = db.prepare(salesQueries.summary).get({...params,1:1}); assert.equal(own.sales,1000); assert.equal(own.orders,1);
    assert.deepEqual(db.prepare(salesQueries.sellers).all({...params,1:2}).map(r=>r.id),[2]);
    assert.equal(results.followups.length,3,"older due orders included, cancelled excluded");
  } finally {db.close();}
});
test("date and scope boundaries reject invalid or unauthorized analytics", () => {
  const now = new Date("2026-09-20T18:00:00Z");
  assert.deepEqual(salesDateRange(undefined,undefined,now),{start:"2026-09-01",end:"2026-09-21",today:"2026-09-21"});
  for (const [from,to] of [["2026-02-30","2026-09-21"],["2025-01-01","2026-09-21"],["2026-09-22","2026-09-22"],["2026-09-20","2026-09-10"]]) assert.throws(()=>salesDateRange(from,to,now));
  assert.equal(salesScope({id:2,self:true}),2); assert.equal(salesScope({id:1,all:true}),null); assert.throws(()=>salesScope({id:2}));
});
