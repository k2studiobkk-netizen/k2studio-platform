import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";

function load(path, deps = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, require: name => { if (!(name in deps)) throw Error(name); return deps[name]; }, crypto, Request, Response, URL, TextDecoder, Uint8Array, console });
  return exports;
}
const input = load("../app/shipment-input.ts");
const permission = { can: (user, permission) => user.role === "admin" || (user.role === "sales" && permission === "orders:edit") || (user.role === "production" && permission === "delivery:confirm") };
const service = load("../app/shipments.ts", { "./staff-auth": permission, "./shipment-input": input });
const user = { id: 1, username: "test", displayName: "TEST", role: "admin", teams: [] };
const row = { orderCode: "K2-1248", carrier: "Flash", trackingNumber: "TH471495CK6R8B", reference: "WCEPK55JND" };
function database() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE orders(id INTEGER PRIMARY KEY,order_number TEXT,contact_name TEXT,order_status TEXT,deposit_amount TEXT); INSERT INTO orders VALUES(1,'K2-1248','TEST A','packing','100'),(2,'K2-1249','TEST B','in_production','200'),(3,'K2-1250','TEST C','cancelled','0'); CREATE TABLE audit_logs(id INTEGER PRIMARY KEY,user_id INTEGER,username TEXT,display_name TEXT,order_id INTEGER,action TEXT,details TEXT)");
  db.exec(readFileSync(new URL("../drizzle/0037_order_shipments.sql", import.meta.url), "utf8"));
  const adapter = { prepare(sql) {
    const query = { params: [], bind(...params) { this.params = params; return this; }, async all() { return { results: db.prepare(sql).all(...this.params) }; }, async first() { return db.prepare(sql).get(...this.params) || null; }, async run() { const result = db.prepare(sql).run(...this.params); return { meta: { changes: result.changes }, success: true }; } };
    return query;
  }, async batch(statements) { db.exec("BEGIN"); try { const results = []; for (const s of statements) results.push(await s.run()); db.exec("COMMIT"); return results; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
  return { db, adapter };
}

test("paste Order Plus text extracts only shipping fields and job code from recipient", () => {
  const result = input.parseOrderPlusText("📋 คำสั่งซื้อสินค้า: WCEPK55JND\n🚚 จัดส่งโดย: Flash\n📦 เลขพัสดุ: TH471495CK6R8B\nชื่อผู้รับ: ทดสอบ K2-1248\nเบอร์ติดต่อ: 0000000000\nราคารวม 0.-");
  assert.deepEqual(JSON.parse(JSON.stringify(result)), row);
  assert.equal(input.shipmentError(result), "");
  assert.equal(input.orderPlusUrl("javascript:alert(1)"), "");
  assert.equal(input.normalizeShipment({ ...row, trackingNumber: " th471495ck6r8b " }).trackingNumber, row.trackingNumber);
});
test("Excel uses actual Order Plus headers, never guesses old customer names", () => {
  const data = [["หมายเลขออเดอร์", "เลขคำสั่งซื้อ", "เลขพัสดุ", "ชื่อ-นามสกุล ลูกค้า", "เบอร์โทรศัพท์", "ขนส่ง"], ["WCEPK55JND", "ODP20260825-5", "TH471495CK6R8B", "ทดสอบ K2-1248", "0000000000", "Flash"], ["REF5678", "ODP20260825-4", "TEST00002", "ไม่มีรหัส", "0000000000", "Flash"]];
  const result = input.parseOrderPlusSheet(data);
  assert.equal(result[0].orderCode, "K2-1248"); assert.equal(result[1].orderCode, "");
  assert.equal(result[0].reference, row.reference);
  assert.ok(input.shipmentError(result[1]));
  assert.equal(JSON.stringify(result).includes("0000000000"), false);
  assert.equal(input.jobCodes("ABC-K2-1248").length, 0);
  assert.equal(input.jobCodes("K2-1248X").length, 0);
  assert.equal(input.jobCodes("ชื่อ k2 – 1248")[0], "K2-1248");
  data[1][2] = 12345678901234567;
  assert.ok(input.shipmentError(input.parseOrderPlusSheet(data)[0]));
  assert.throws(() => input.parseOrderPlusSheet([data[0], ...Array.from({length:51}, () => data[1])]));
});
test("preview is read-only; missing, multiple, cancelled and mismatched codes blocked", async () => {
  const { db, adapter } = database();
  try {
    assert.equal((await service.previewShipments(adapter, [row]))[0].status, "ready");
    for (const orderCode of ["", "K2-9999", "K2-1248,K2-1249", "K2-1250"]) assert.equal((await service.previewShipments(adapter, [{...row,orderCode}]))[0].status, "blocked");
    assert.equal((await service.previewShipments(adapter, [row], 2))[0].status, "blocked");
    assert.equal(db.prepare("SELECT COUNT(*) n FROM order_shipments").get().n, 0);
    assert.ok((await service.previewShipments(adapter, [row, {...row,orderCode:"K2-1249"}])).every(r=>r.status==="blocked"));
  } finally { db.close(); }
});
test("save is audited and idempotent, no money/status changes, no cross-order reuse", async () => {
  const { db, adapter } = database();
  try {
    const before = db.prepare("SELECT * FROM orders").all();
    assert.equal((await service.saveShipments(adapter, [row], user)).saved, 1);
    assert.equal((await service.saveShipments(adapter, [row], user)).saved, 0);
    assert.equal((await service.saveShipments(adapter, [{...row,orderCode:"K2-1249"}], user)).ok, false);
    assert.equal((await service.saveShipments(adapter, [{...row,trackingNumber:"TEST00002"}], user)).ok, false);
    assert.equal((await service.saveShipments(adapter, [{...row,trackingNumber:"TEST00002"}], user, 1)).saved, 1);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM audit_logs WHERE action='shipment_added'").get().n, 2);
    assert.deepEqual(db.prepare("SELECT * FROM orders").all(), before);
  } finally { db.close(); }
});
test("permissions, void preserves history, inactive tracking excluded and replacement allowed", async () => {
  const { db, adapter } = database();
  try {
    assert.equal(service.canManageShipments({...user,role:"finance"}),false);
    assert.equal(service.canManageShipments({...user,role:"finance",teams:["pack"]}),true);
    assert.equal(service.canManageShipments({...user,role:"production"}),true);
    await assert.rejects(service.saveShipments(adapter, [row], {...user,role:"finance"}));
    await service.saveShipments(adapter, [row], user, 1);
    await assert.rejects(service.voidShipment(adapter, 1, "", user));
    assert.equal(await service.voidShipment(adapter, 1, "กรอกเลขผิด", user), true);
    assert.equal(await service.voidShipment(adapter, 1, "กรอกเลขผิด", user), false);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM order_shipments").get().n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM order_shipments WHERE voided_at IS NULL").get().n, 0);
    assert.equal((await service.saveShipments(adapter, [{...row,trackingNumber:"TEST00002"}], user, 1)).saved, 1);
  } finally { db.close(); }
});
test("atomic insert/audit rolls back on a concurrent duplicate", async () => {
  const { db, adapter } = database();
  try {
    const batch = adapter.batch;
    adapter.batch = async statements => {
      db.prepare("INSERT INTO order_shipments(order_id,carrier,tracking_number,source,created_by,created_by_name,operation_key) VALUES(2,'Flash',?,'test',1,'test','race')").run(row.trackingNumber);
      return batch(statements);
    };
    await assert.rejects(service.saveShipments(adapter, [row], user, 1));
    assert.equal(db.prepare("SELECT COUNT(*) n FROM order_shipments WHERE order_id=1").get().n, 0);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM audit_logs").get().n, 0);
  } finally { db.close(); }
});
test("API enforces session, role, same origin and validates preview/save", async () => {
  const {db, adapter} = database(); let actor = user;
  const post = load("../app/api/admin/shipments/route.ts", { "cloudflare:workers": {env:{DB:adapter}}, "../../../staff-auth":{getStaffUser:async()=>actor}, "../../../shipments":service }).POST;
  const request = (origin = "https://local.test", body = {action:"preview",rows:[row]}) => new Request("https://local.test/api/admin/shipments", {method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
  try {
    actor = null; assert.equal((await post(request())).status,401);
    actor = {...user,role:"finance"}; assert.equal((await post(request())).status,403);
    actor = user; assert.equal((await post(request("https://evil.test"))).status,403);
    assert.equal((await post(request())).status,200);
    assert.equal((await post(request(undefined,{action:"save",rows:[row],orderId:1}))).status,200);
    assert.equal((await post(request(undefined,{action:"save",rows:[row],orderId:0}))).status,400);
    assert.equal((await post(request(undefined,{action:"save",rows:[],padding:"a".repeat(65000)}))).status,413);
  } finally {db.close();}
});
