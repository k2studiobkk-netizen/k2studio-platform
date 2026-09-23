import { env } from "cloudflare:workers";
import { audit, getStaffUser } from "../../../../staff-auth";
import { hasPermission } from "../../../../production-rbac";
import { publishBroadcastEvent } from "../../../../broadcast-server";

const departments = new Set(["print_cut", "pack"]);
const actions = new Set(["complete", "remove", "restore", "update_metadata"]);

export async function POST(request: Request) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const workOrderId = Number(body.workOrderId);
  const department = String(body.department || "print_cut");
  const action = String(body.action || "");
  const note = String(body.note || "").trim().slice(0, 500);
  const queueRank = Math.max(0, Math.min(9999, Math.floor(Number(body.queueRank || 0))));
  const priority = ["normal", "high", "urgent"].includes(String(body.priority)) ? String(body.priority) : "normal";
  if (!Number.isInteger(workOrderId) || workOrderId < 1 || !departments.has(department) || !actions.has(action)) {
    return Response.json({ error: "ข้อมูลคิวงานไม่ถูกต้อง" }, { status: 400 });
  }
  if (action !== "complete" && !hasPermission(user.role, "queue:manage")) return Response.json({ error: "เฉพาะผู้จัดการฝ่ายผลิตหรือผู้ดูแลระบบเท่านั้น" }, { status: 403 });
  if (action === "remove" && note.length < 3) return Response.json({ error: "กรุณาระบุเหตุผลที่นำงานออกจากคิว" }, { status: 400 });

  const database = (env as unknown as { DB: D1Database }).DB;
  const workOrder = await database.prepare("SELECT id,order_id,work_order_number,status,queue_rank,queue_removed,dashboard_note,priority FROM work_orders WHERE id=? LIMIT 1")
    .bind(workOrderId).first<Record<string, string | number>>();
  if (!workOrder) return Response.json({ error: "ไม่พบใบงาน" }, { status: 404 });

  const fromStatus = String(workOrder.status || "");
  const fromRank = Number(workOrder.queue_rank || 0);
  let toStatus = fromStatus;
  let eventNote = note;
  const statements: D1PreparedStatement[] = [];

  if (action === "complete") {
    if (department === "print_cut") {
      if (!["waiting_for_production", "scheduled", "in_production"].includes(fromStatus)) return Response.json({ error: "งานนี้ไม่ได้อยู่ในคิว Print & Cut แล้ว" }, { status: 409 });
      toStatus = "packing";
      statements.push(
        database.prepare("UPDATE production_schedule SET status='completed',updated_at=CURRENT_TIMESTAMP WHERE work_order_id=? AND status NOT IN ('completed','cancelled')").bind(workOrderId),
        database.prepare("UPDATE work_orders SET status=?,queue_rank=0,queue_removed=0,queue_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(toStatus, workOrderId),
        database.prepare("UPDATE orders SET order_status='packing' WHERE id=?").bind(Number(workOrder.order_id)),
        database.prepare("INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)").bind(Number(workOrder.order_id), "packing", `Print & Cut เสร็จแล้ว • ย้ายเข้าห้อง Pack โดย ${user.displayName}`),
      );
      eventNote ||= "ผลิตและตัดเสร็จแล้ว ย้ายเข้าห้อง Pack";
    } else {
      if (!["packing", "waiting_for_packing", "ready_to_ship"].includes(fromStatus)) return Response.json({ error: "งานนี้ไม่ได้อยู่ในคิว Pack แล้ว" }, { status: 409 });
      const payment = await database.prepare("SELECT estimated_total,shipping_fee,deposit_amount,payment_slip_key FROM orders WHERE id=?").bind(Number(workOrder.order_id)).first<Record<string, string | number>>();
      const payableTotal = Number(payment?.estimated_total || 0) + Number(payment?.shipping_fee || 0);
      const outstanding = Math.max(0, payableTotal - Number(payment?.deposit_amount || 0));
      if (!payment || outstanding > 0.009 || !payment.payment_slip_key) return Response.json({ error: `ยังเปลี่ยนเป็นพร้อมส่งไม่ได้: ยอดค้างชำระ ฿${outstanding.toLocaleString("th-TH", { minimumFractionDigits: 2 })} กรุณาแนบสลิปยอดคงเหลือให้ครบก่อน` }, { status: 409 });
      toStatus = "ready_to_ship";
      statements.push(
        database.prepare("UPDATE work_orders SET status=?,queue_rank=0,queue_removed=0,queue_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(toStatus, workOrderId),
        database.prepare("UPDATE orders SET order_status='ready_to_ship' WHERE id=?").bind(Number(workOrder.order_id)),
        database.prepare("INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)").bind(Number(workOrder.order_id), "ready_to_ship", `แพ็กเสร็จและพร้อมส่ง • อัปเดตโดย ${user.displayName}`),
      );
      eventNote ||= "แพ็กเสร็จและพร้อมส่ง";
    }
    statements.push(database.prepare("INSERT INTO work_order_status_history (work_order_id,status,note,changed_by) VALUES (?,?,?,?)").bind(workOrderId, toStatus, eventNote, user.id));
  } else if (action === "remove") {
    statements.push(database.prepare("UPDATE work_orders SET queue_removed=1,queue_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(workOrderId));
  } else if (action === "restore") {
    statements.push(database.prepare("UPDATE work_orders SET queue_removed=0,queue_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(workOrderId));
    eventNote ||= "นำงานกลับเข้าคิว";
  } else {
    statements.push(database.prepare("UPDATE work_orders SET dashboard_note=?,queue_rank=?,priority=?,queue_removed=0,queue_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(note, queueRank, priority, workOrderId));
    eventNote = `ลำดับ ${fromRank || "อัตโนมัติ"} → ${queueRank || "อัตโนมัติ"} • ${priority}${note ? ` • ${note}` : ""}`;
  }

  statements.push(database.prepare(`INSERT INTO production_queue_events
    (work_order_id,department,action,note,from_status,to_status,from_rank,to_rank,changed_by,changed_by_name)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(workOrderId, department, action, eventNote, fromStatus, toStatus, fromRank, queueRank, user.id, user.displayName));
  await database.batch(statements);
  await audit(user, Number(workOrder.order_id), `คิว ${department}: ${action}`, `${workOrder.work_order_number} • ${eventNote || "อัปเดตคิว"}`);
  try {
    await publishBroadcastEvent({ type: "production.queue_updated", departments: ["print_cut", "pack", "sale"], workOrderId, action });
  } catch (error) {
    console.error("queue realtime publish failed", { workOrderId, action, error: String(error) });
  }
  return Response.json({ ok: true, status: toStatus });
}
