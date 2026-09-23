import { can, type StaffUser } from "./staff-auth";
import { MAX_SHIPMENT_ROWS, normalizeShipment, shipmentError, type Shipment, type ShipmentPreview } from "./shipment-input";

export function canManageShipments(user: StaffUser) {
  return can(user, "orders:edit") || can(user, "delivery:confirm") || user.teams.includes("pack");
}
export async function listShipments(db: D1Database, orderId: number) {
  return (await db.prepare("SELECT id,order_id,carrier,tracking_number,external_reference,created_at,created_by_name,voided_at,void_reason FROM order_shipments WHERE order_id=? ORDER BY id DESC").bind(orderId).all<Shipment>()).results;
}

export async function previewShipments(db: D1Database, input: unknown[], orderId?: number): Promise<ShipmentPreview[]> {
  if (!input.length || input.length > MAX_SHIPMENT_ROWS || (orderId && input.length !== 1)) throw new Error(`เลือก 1–${MAX_SHIPMENT_ROWS} รายการต่อครั้ง`);
  const rows = input.map(normalizeShipment);
  const codes = [...new Set(rows.map(r => r.orderCode))];
  const orders = (await db.prepare(`SELECT id,order_number,contact_name,order_status FROM orders WHERE UPPER(order_number) IN (${codes.map(() => "?").join(",")})`).bind(...codes).all<{id:number;order_number:string;contact_name:string;order_status:string}>()).results;
  const numbers = [...new Set(rows.map(r => r.trackingNumber))];
  const ids = [...new Set(orders.map(o => o.id))];
  const existing = (await db.prepare(`SELECT order_id,tracking_number,carrier,external_reference FROM order_shipments WHERE voided_at IS NULL AND (tracking_number IN (${numbers.map(() => "?").join(",")})${ids.length ? ` OR order_id IN (${ids.map(() => "?").join(",")})` : ""})`).bind(...numbers, ...ids).all<{order_id:number;tracking_number:string;carrier:string;external_reference:string}>()).results;
  const seen = new Map<string, Set<string>>();
  for (const row of rows) {
    const targets = seen.get(row.trackingNumber) || new Set<string>(); targets.add(row.orderCode); seen.set(row.trackingNumber, targets);
  }
  const used = new Set<string>();
  return rows.map((row, index) => {
    const result: ShipmentPreview = { ...row, index, status: "blocked", message: shipmentError(row) };
    if (result.message) return result;
    const matches = orders.filter(o => o.order_number.toUpperCase() === row.orderCode);
    if (matches.length !== 1) return { ...result, message: matches.length ? "รหัสซ้ำในระบบ ต้องตรวจสอบก่อน" : "ไม่พบรหัสใบงานในระบบ" };
    const order = matches[0]; result.orderId = order.id; result.customer = order.contact_name;
    if (orderId && order.id !== orderId) return { ...result, message: "รหัสในข้อความไม่ตรงกับใบงานที่เปิดอยู่" };
    if (order.order_status === "cancelled") return { ...result, message: "ใบงานนี้ถูกยกเลิกแล้ว" };
    if ((seen.get(row.trackingNumber)?.size || 0) > 1) return { ...result, message: "เลขพัสดุเดียวกันถูกจับคู่หลายใบงานในไฟล์" };
    if (!orderId && new Set(rows.filter(r => r.orderCode === row.orderCode).map(r => r.trackingNumber)).size > 1) return { ...result, message: "หลายเลขพัสดุในใบงานเดียว ให้เปิดใบงานเพื่อเพิ่มทีละกล่อง" };
    const duplicate = existing.find(s => s.tracking_number === row.trackingNumber);
    if (duplicate) return duplicate.order_id === order.id && duplicate.carrier === row.carrier && duplicate.external_reference === row.reference
      ? { ...result, status: "duplicate", message: "บันทึกเลขนี้ไว้แล้ว — ไม่เพิ่มซ้ำ" }
      : { ...result, message: "เลขพัสดุนี้มีอยู่แล้ว แต่ใบงานหรือข้อมูลต่างกัน — ตรวจสอบก่อน" };
    if (!orderId && existing.some(s => s.order_id === order.id)) return { ...result, message: "ใบงานมีเลขพัสดุแล้ว ให้เปิดใบงานเพื่อเพิ่มกล่องหรือแก้ไข" };
    if (used.has(row.trackingNumber)) return { ...result, status: "duplicate", message: "แถวซ้ำในไฟล์ — ไม่เพิ่มซ้ำ" };
    used.add(row.trackingNumber);
    return { ...result, status: "ready", message: "พร้อมบันทึก" };
  });
}

export async function saveShipments(db: D1Database, input: unknown[], user: StaffUser, orderId?: number) {
  if (!canManageShipments(user)) throw new Error("ไม่มีสิทธิ์บันทึกเลขพัสดุ");
  const preview = await previewShipments(db, input, orderId);
  for (const row of preview) {
    const original = input[row.index] as { expectedOrderId?: unknown };
    if (original.expectedOrderId !== undefined && Number(original.expectedOrderId) !== row.orderId) {
      row.status = "blocked"; row.message = "ข้อมูลจับคู่เปลี่ยนตั้งแต่ตรวจสอบ กรุณาตรวจสอบใหม่";
    }
  }
  if (preview.some(r => r.status === "blocked")) return { ok: false, rows: preview, saved: 0 };
  const ready = preview.filter(r => r.status === "ready");
  if (!ready.length) return { ok: true, rows: preview, saved: 0 };
  const statements: D1PreparedStatement[] = [];
  for (const row of ready) {
    const operation = crypto.randomUUID();
    // Guard again in the atomic batch: no accidental overwrite, including concurrent imports.
    statements.push(db.prepare(`INSERT INTO order_shipments (order_id,carrier,tracking_number,external_reference,source,created_by,created_by_name,operation_key)
      SELECT id,?,?,?,?,?,?,? FROM orders WHERE id=? AND UPPER(order_number)=? AND order_status<>'cancelled'
      ${orderId ? "" : "AND NOT EXISTS (SELECT 1 FROM order_shipments WHERE order_id=orders.id AND voided_at IS NULL)"}`)
      .bind(row.carrier, row.trackingNumber, row.reference, orderId ? "order_entry" : "orderplus_excel", user.id, user.displayName, operation, row.orderId!, row.orderCode));
    statements.push(db.prepare(`INSERT INTO audit_logs (user_id,username,display_name,order_id,action,details)
      SELECT ?,?,?,order_id,'shipment_added',? FROM order_shipments WHERE operation_key=?`)
      .bind(user.id, user.username, user.displayName, `${row.carrier} | ${row.trackingNumber} | ${row.reference}`, operation));
  }
  const results = await db.batch(statements);
  const saved = results.filter((_, i) => i % 2 === 0).reduce((sum, r) => sum + Number(r.meta.changes || 0), 0);
  return { ok: saved === ready.length, rows: preview, saved };
}

export async function voidShipment(db: D1Database, id: number, reason: string, user: StaffUser) {
  if (!canManageShipments(user)) throw new Error("ไม่มีสิทธิ์แก้ไขเลขพัสดุ");
  if (!Number.isSafeInteger(id) || id < 1 || reason.trim().length < 3 || reason.length > 300) throw new Error("กรุณาระบุเหตุผลการยกเลิก 3–300 ตัวอักษร");
  const stamp = new Date().toISOString();
  const results = await db.batch([
    db.prepare("UPDATE order_shipments SET voided_at=?,voided_by=?,void_reason=? WHERE id=? AND voided_at IS NULL").bind(stamp, user.displayName, reason.trim(), id),
    db.prepare(`INSERT INTO audit_logs (user_id,username,display_name,order_id,action,details) SELECT ?,?,?,order_id,'shipment_voided',tracking_number || ' | ' || ? FROM order_shipments WHERE id=? AND voided_at=?`).bind(user.id, user.username, user.displayName, reason.trim(), id, stamp),
  ]);
  return Number(results[0].meta.changes || 0) === 1;
}
