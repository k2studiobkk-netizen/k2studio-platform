import { audit, type StaffUser } from "./staff-auth";
import { publishBroadcastEvent } from "./broadcast-server";
import { syncWorkOrderFromOrder } from "./work-order-sync";

async function notifyProductionScreens(workOrderId: number, action: string) {
  try {
    await publishBroadcastEvent({ type: "production.queue_updated", departments: ["print_cut", "pack", "sale"], workOrderId, action });
  } catch (error) {
    console.error("status realtime publish failed", { workOrderId, action, error: String(error) });
  }
}

export const allowedOrderStatuses = new Set([
  "waiting_for_artwork_review",
  "draft",
  "waiting_for_graphic",
  "artwork_preparation",
  "quotation_pending",
  "artwork_approval_pending",
  "artwork_changes_requested",
  "artwork_approved",
  "confirmed",
  "work_order_created",
  "waiting_for_production",
  "scheduled",
  "in_production",
  "quality_check",
  "packing",
  "ready_to_ship",
  "shipped",
  "completed",
  "on_hold",
  "cancelled",
]);

type StatusUpdateResult =
  | { ok: true; status: string }
  | { ok: false; statusCode: number; error: string };

export async function updateOrderStatus(
  database: D1Database,
  user: StaffUser,
  orderId: number,
  orderStatus: string,
  rawNote = "",
  source: "admin" | "qr" = "admin",
): Promise<StatusUpdateResult> {
  if (!allowedOrderStatuses.has(orderStatus)) {
    return { ok: false, statusCode: 400, error: "สถานะไม่ถูกต้อง" };
  }
  const productionStatuses = new Set(["work_order_created", "waiting_for_production", "scheduled", "in_production", "quality_check", "packing", "ready_to_ship", "shipped", "completed"]);

  const current = await database.prepare(
    "SELECT order_status,estimated_total,shipping_fee,deposit_amount,payment_slip_key FROM orders WHERE id=?",
  ).bind(orderId).first<{ order_status: string; estimated_total: string; shipping_fee: string; deposit_amount: string; payment_slip_key: string }>();
  if (!current) return { ok: false, statusCode: 404, error: "ไม่พบใบสั่งงาน" };
  const paymentLockedStatuses = new Set(["ready_to_ship", "shipped", "completed"]);
  const payableTotal = Number(current.estimated_total || 0) + Number(current.shipping_fee || 0);
  const outstanding = Math.max(0, payableTotal - Number(current.deposit_amount || 0));
  if (paymentLockedStatuses.has(orderStatus) && (outstanding > 0.009 || !current.payment_slip_key)) {
    return { ok: false, statusCode: 409, error: `ยังปิดงานไม่ได้: ยอดค้างชำระ ฿${outstanding.toLocaleString("th-TH", { minimumFractionDigits: 2 })} กรุณาแนบสลิปและบันทึกรับชำระให้ครบก่อน` };
  }
  let linkedWorkOrder = await database.prepare("SELECT id,status FROM work_orders WHERE order_id=? LIMIT 1").bind(orderId).first<{ id: number; status: string }>();
  // Legacy orders created before the production module may not have a linked
  // work order. Backfill it before applying the status so Calendar/TV never
  // silently diverge from the customer and admin pages.
  if (!linkedWorkOrder) linkedWorkOrder = await syncWorkOrderFromOrder(database, orderId, { actorId: user.id });

  const note = rawNote.trim().slice(0, 500);
  if (orderStatus === "in_production") {
    const productionNote = note || `ส่งเข้าผลิตโดย ${user.displayName}`;
    const statements = [
      database.prepare("UPDATE orders SET order_status=?,production_released_at=CURRENT_TIMESTAMP,production_released_by=? WHERE id=?")
        .bind("in_production", user.displayName, orderId),
      database.prepare("INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)")
        .bind(orderId, "in_production", `${productionNote} • ผู้ส่งผลิต ${user.displayName}`),
    ];
    if (linkedWorkOrder) statements.push(
      database.prepare("UPDATE work_orders SET status='in_production',planned_production_date=COALESCE(NULLIF(planned_production_date,''),date('now','+7 hours')),confirmed_delivery_date=COALESCE(NULLIF(confirmed_delivery_date,''),NULLIF(customer_requested_date,''),date('now','+7 hours')),queue_removed=0,queue_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(linkedWorkOrder.id),
      database.prepare("INSERT INTO work_order_status_history (work_order_id,status,note,changed_by) VALUES (?,?,?,?)").bind(linkedWorkOrder.id, "in_production", productionNote, user.id),
    );
    await database.batch(statements);
    await audit(user, orderId, "ส่งผลิต", `${current.order_status} → in_production • อัปเดตโดย ${user.displayName}${note ? ` • ${note}` : ""}`);
    if (linkedWorkOrder) await notifyProductionScreens(linkedWorkOrder.id, "in_production");
    return { ok: true, status: "in_production" };
  }

  const finalNote = note || statusNote(orderStatus);
  const statements = [
    database.prepare("UPDATE orders SET order_status=? WHERE id=?").bind(orderStatus, orderId),
    database.prepare("INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)")
      .bind(orderId, orderStatus, `${finalNote} • อัปเดตโดย ${user.displayName}`),
  ];
  const shouldSyncProductionStatus = linkedWorkOrder && (linkedWorkOrder.status !== "draft" || productionStatuses.has(orderStatus) || orderStatus === "cancelled");
  // orders.order_status is the single source of truth. The production record
  // mirrors the exact same value so every dashboard shows one status.
  const workOrderStatus = orderStatus;
  const queueRemoved = ["shipped", "completed", "cancelled"].includes(workOrderStatus) ? 1 : 0;
  if (shouldSyncProductionStatus && linkedWorkOrder) statements.push(
    database.prepare("UPDATE work_orders SET status=?,queue_rank=0,queue_removed=?,queue_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(workOrderStatus, queueRemoved, linkedWorkOrder.id),
    database.prepare("INSERT INTO work_order_status_history (work_order_id,status,note,changed_by) VALUES (?,?,?,?)").bind(linkedWorkOrder.id, workOrderStatus, finalNote, user.id),
  );
  await database.batch(statements);
  await audit(user, orderId, source === "qr" ? "เปลี่ยนสถานะผ่าน QR" : "เปลี่ยนสถานะ", `${current.order_status} → ${orderStatus}${note ? ` • ${note}` : ""}`);
  if (shouldSyncProductionStatus && linkedWorkOrder) await notifyProductionScreens(linkedWorkOrder.id, orderStatus);
  return { ok: true, status: orderStatus };
}

function statusNote(status: string) {
  return ({
    waiting_for_artwork_review: "กำลังตรวจสอบไฟล์งาน",
    quotation_pending: "กำลังตรวจสอบและยืนยันราคา",
    artwork_approval_pending: "ส่งแบบให้ลูกค้าตรวจและเซ็นยืนยัน",
    artwork_changes_requested: "ลูกค้าขอแก้ไขแบบ",
    artwork_approved: "ลูกค้าเซ็นยืนยันแบบแล้ว",
    confirmed: "ยืนยันรายละเอียดใบสั่งงานแล้ว",
    work_order_created: "ออกใบงานฝ่ายผลิตแล้ว",
    waiting_for_production: "รอฝ่ายผลิตจัดคิว",
    scheduled: "จัดคิวผลิตและยืนยันวันส่งแล้ว",
    quality_check: "กำลังตรวจคุณภาพสินค้า",
    packing: "กำลังแพ็กสินค้า",
    ready_to_ship: "สินค้าพร้อมส่ง",
    shipped: "จัดส่งสินค้าแล้ว",
    completed: "เสร็จสมบูรณ์และปิดงาน",
    on_hold: "พักงานชั่วคราว",
    cancelled: "ยกเลิกใบสั่งงาน",
  } as Record<string, string>)[status] ?? "อัปเดตสถานะใบสั่งงาน";
}
