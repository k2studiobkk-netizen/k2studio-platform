import { env } from "cloudflare:workers";
import { audit, getStaffUser } from "../../../../../staff-auth";
import { hasPermission } from "../../../../../production-rbac";
import { publishBroadcastEvent } from "../../../../../broadcast-server";
import { syncWorkOrderFromOrder } from "../../../../../work-order-sync";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!hasPermission(user.role, "work_orders:create")) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์ออกใบงานฝ่ายผลิต" }, { status: 403 });

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId < 1) return Response.json({ error: "ใบสั่งงานไม่ถูกต้อง" }, { status: 400 });
  const database = (env as unknown as { DB: D1Database }).DB;

  // Re-sync first so production always receives the latest editable order data.
  const workOrder = await syncWorkOrderFromOrder(database, orderId, { actorId: user.id });
  if (!workOrder) return Response.json({ error: "ไม่สามารถเตรียมข้อมูลฝ่ายผลิตได้" }, { status: 500 });
  const order = await database.prepare("SELECT order_number,requested_date,order_status,production_released_at FROM orders WHERE id=? LIMIT 1")
    .bind(orderId).first<{ order_number: string; requested_date: string; order_status: string; production_released_at: string }>();
  if (!order) return Response.json({ error: "ไม่พบคำสั่งซื้อ" }, { status: 404 });

  const approvalNote = `กราฟิกพิมพ์/ดาวน์โหลดใบงาน • ระบบอนุมัติแบบอัตโนมัติโดย ${user.displayName}`;
  const releaseNote = `อนุมัติแบบแล้วและส่งเข้าไลน์ผลิตโดย ${user.displayName}`;
  const orderStatusByWorkOrder: Record<string, string> = {
    waiting_for_production: "waiting_for_production",
    scheduled: "scheduled",
    in_production: "in_production",
    quality_check: "quality_check",
    packing: "packing",
    waiting_for_packing: "packing",
    ready_to_ship: "ready_to_ship",
    shipped: "shipped",
    completed: "completed",
  };
  const releasableOrderStatuses = [
    "draft", "confirmed", "waiting_for_artwork_review", "waiting_for_graphic",
    "artwork_preparation", "quotation_pending", "artwork_approval_pending",
    "artwork_changes_requested", "artwork_approved", "work_order_created",
  ];

  let workOrderStatus = workOrder.status;
  if (workOrderStatus === "draft") {
    const claimed = await database.prepare(`UPDATE work_orders SET status='waiting_for_production',graphic_owner_id=COALESCE(graphic_owner_id,?),
      planned_production_date=COALESCE(NULLIF(planned_production_date,''),date('now','+7 hours')),
      confirmed_delivery_date=COALESCE(NULLIF(confirmed_delivery_date,''),NULLIF(customer_requested_date,''),NULLIF(?,''),date('now','+7 hours')),
      queue_removed=0,queue_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND status='draft' RETURNING status`).bind(user.id, order.requested_date, workOrder.id).first<{ status: string }>();
    workOrderStatus = claimed?.status || String((await database.prepare("SELECT status FROM work_orders WHERE id=? LIMIT 1").bind(workOrder.id).first<{ status: string }>())?.status || "draft");
  } else {
    await database.prepare(`UPDATE work_orders SET
      planned_production_date=COALESCE(NULLIF(planned_production_date,''),date('now','+7 hours')),
      confirmed_delivery_date=COALESCE(NULLIF(confirmed_delivery_date,''),NULLIF(customer_requested_date,''),NULLIF(?,''),date('now','+7 hours')),
      updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(order.requested_date, workOrder.id).run();
  }

  const targetOrderStatus = orderStatusByWorkOrder[workOrderStatus];
  if (targetOrderStatus) {
    const placeholders = releasableOrderStatuses.map(() => "?").join(",");
    const corrected = await database.prepare(`UPDATE orders SET order_status=?,production_released_at=CURRENT_TIMESTAMP,production_released_by=?
      WHERE id=? AND order_status IN (${placeholders}) RETURNING id`)
      .bind(targetOrderStatus, user.displayName, orderId, ...releasableOrderStatuses).first<{ id: number }>();
    if (corrected) {
      await database.batch([
        database.prepare("UPDATE design_versions SET status='approved',customer_note=?,responded_by=?,responded_at=CURRENT_TIMESTAMP WHERE id=(SELECT id FROM design_versions WHERE order_id=? AND status='pending' ORDER BY version_no DESC LIMIT 1)").bind(approvalNote, user.displayName, orderId),
        database.prepare("INSERT INTO work_order_status_history (work_order_id,status,note,changed_by) VALUES (?,?,?,?)").bind(workOrder.id, workOrderStatus, releaseNote, user.id),
        database.prepare("INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)").bind(orderId, "artwork_approved", approvalNote),
        database.prepare("INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)").bind(orderId, targetOrderStatus, `${releaseNote} • เข้าคิว Print & Cut และ Production Calendar ทันที`),
        database.prepare("INSERT INTO notifications (work_order_id,type,title,message) VALUES (?,?,?,?)").bind(workOrder.id, "new_work_order", "มีใบงานใหม่เข้าคิวผลิต", `${order.order_number} • ข้อมูลซิงก์จากใบสั่งงานแล้ว`),
      ]);
      await audit(user, orderId, "พิมพ์ใบงานและส่งผลิตอัตโนมัติ", `${order.order_number} • อนุมัติแบบ • เข้าไลน์ Print & Cut และ Production Calendar`);
      try {
        await publishBroadcastEvent({ type: "production.queue_updated", departments: ["print_cut", "sale"], workOrderId: workOrder.id, action: "released" });
      } catch (error) {
        console.error("work order realtime publish failed", { workOrderId: workOrder.id, error: String(error) });
      }
    }
  }

  return Response.json({
    ok: true,
    id: workOrder.id,
    workOrderNumber: order.order_number,
    status: workOrderStatus,
    orderStatus: targetOrderStatus || order.order_status,
    calendarReady: Boolean(targetOrderStatus),
    alreadyReleased: !releasableOrderStatuses.includes(order.order_status),
  });
}
