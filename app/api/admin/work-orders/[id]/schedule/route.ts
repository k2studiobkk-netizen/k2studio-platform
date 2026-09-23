import { env } from "cloudflare:workers";
import { audit, getStaffUser } from "../../../../../staff-auth";
import { hasPermission } from "../../../../../production-rbac";
import { estimateProductionMinutes } from "../../../../../production-capacity";
import { publishBroadcastEvent } from "../../../../../broadcast-server";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!hasPermission(user.role, "production:schedule")) return Response.json({ error: "เฉพาะฝ่ายผลิตเท่านั้นที่จัดคิวและยืนยันวันส่งได้" }, { status: 403 });
  const { id } = await params;
  const workOrderId = Number(id);
  const body = await request.json() as Record<string, unknown>;
  const machineId = Number(body.machineId);
  const processId = body.processId ? Number(body.processId) : null;
  const productionDate = String(body.productionDate || "");
  const confirmedDeliveryDate = String(body.confirmedDeliveryDate || "");
  const quantity = Math.max(1, Math.floor(Number(body.quantity || 0)));
  const manualEstimatedMinutes = Math.ceil(Number(body.estimatedMinutes || 0));
  const priority = ["low", "normal", "high", "urgent"].includes(String(body.priority)) ? String(body.priority) : "normal";
  const overrideReason = String(body.overrideReason || "").trim().slice(0, 500);
  if (!Number.isInteger(workOrderId) || !Number.isInteger(machineId) || !datePattern.test(productionDate) || !datePattern.test(confirmedDeliveryDate) || !Number.isFinite(manualEstimatedMinutes)) {
    return Response.json({ error: "กรุณาระบุเครื่องจักร วันผลิต วันส่ง และเวลาผลิตให้ครบ" }, { status: 400 });
  }
  if (confirmedDeliveryDate < productionDate) return Response.json({ error: "วันส่งที่ยืนยันแล้วต้องไม่ก่อนวันผลิต" }, { status: 400 });

  const database = (env as unknown as { DB: D1Database }).DB;
  const [workOrder, machine, used, rule] = await Promise.all([
    database.prepare("SELECT id,order_id,work_order_number,product_id,confirmed_delivery_date FROM work_orders WHERE id=? LIMIT 1").bind(workOrderId).first<Record<string, string | number>>(),
    database.prepare("SELECT id,name,daily_capacity_minutes,busy_threshold,nearly_full_threshold,full_threshold FROM machines WHERE id=? AND active=1 LIMIT 1").bind(machineId).first<Record<string, string | number>>(),
    database.prepare("SELECT COALESCE(SUM(estimated_minutes),0) AS used_minutes FROM production_schedule WHERE production_date=? AND machine_id=? AND status NOT IN ('cancelled','completed')").bind(productionDate, machineId).first<{ used_minutes: number }>(),
    database.prepare(`SELECT units_per_hour,setup_minutes FROM production_capacity
      WHERE machine_id=? AND active=1 AND (process_id=? OR process_id IS NULL)
      AND (product_id=(SELECT product_id FROM work_orders WHERE id=?) OR product_id IS NULL)
      ORDER BY CASE WHEN product_id IS NULL THEN 1 ELSE 0 END,CASE WHEN process_id IS NULL THEN 1 ELSE 0 END,id DESC LIMIT 1`).bind(machineId, processId, workOrderId).first<{ units_per_hour: number; setup_minutes: number }>(),
  ]);
  if (!workOrder || !machine) return Response.json({ error: "ไม่พบใบงานหรือเครื่องจักร" }, { status: 404 });
  const estimatedMinutes = estimateProductionMinutes(quantity, Number(rule?.units_per_hour || 0), Number(rule?.setup_minutes || 0), manualEstimatedMinutes);
  if (estimatedMinutes < 1) return Response.json({ error: "ยังไม่มีกฎ Capacity สำหรับเครื่องนี้ กรุณาระบุเวลาที่ใช้เป็นนาที" }, { status: 400 });
  const capacity = Math.max(1, Number(machine.daily_capacity_minutes));
  const nextMinutes = Number(used?.used_minutes || 0) + estimatedMinutes;
  const percent = Math.round((nextMinutes / capacity) * 1000) / 10;
  if (percent >= Number(machine.full_threshold || 100)) {
    if (!hasPermission(user.role, "capacity:override")) return Response.json({ error: "Production capacity for this date is full.", percent, machine: machine.name }, { status: 409 });
    if (!overrideReason) return Response.json({ error: "กรุณาระบุเหตุผลการ Override Capacity" }, { status: 400 });
  }

  const previousDate = String(workOrder.confirmed_delivery_date || "");
  const schedule = await database.prepare(`INSERT INTO production_schedule (work_order_id,machine_id,process_id,production_date,quantity,estimated_minutes,status,override_reason,created_by)
    VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`).bind(workOrderId, machineId, processId, productionDate, quantity, estimatedMinutes, "scheduled", percent >= Number(machine.full_threshold || 100) ? overrideReason : "", user.id).first<{ id: number }>();
  if (!schedule) return Response.json({ error: "ไม่สามารถบันทึกคิวผลิตได้" }, { status: 500 });
  await database.batch([
    database.prepare("UPDATE work_orders SET planned_production_date=CASE WHEN planned_production_date='' OR planned_production_date>? THEN ? ELSE planned_production_date END,confirmed_delivery_date=?,priority=?,status='scheduled',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(productionDate, productionDate, confirmedDeliveryDate, priority, workOrderId),
    database.prepare("UPDATE orders SET order_status='scheduled' WHERE id=?").bind(Number(workOrder.order_id)),
    database.prepare("INSERT INTO work_order_status_history (work_order_id,status,note,changed_by) VALUES (?,?,?,?)").bind(workOrderId, "scheduled", `${machine.name} • ${productionDate} • ${estimatedMinutes} นาที • ยืนยันส่ง ${confirmedDeliveryDate}`, user.id),
    database.prepare("INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)").bind(Number(workOrder.order_id), "scheduled", `จัดคิว ${machine.name} วันที่ ${productionDate} • ยืนยันวันส่ง ${confirmedDeliveryDate}`),
    database.prepare("INSERT INTO notifications (work_order_id,type,title,message) VALUES (?,?,?,?)").bind(workOrderId, previousDate && previousDate !== confirmedDeliveryDate ? "delivery_date_changed" : "production_scheduled", previousDate && previousDate !== confirmedDeliveryDate ? "เปลี่ยนวันส่งที่ยืนยันแล้ว" : "จัดคิวผลิตแล้ว", `${workOrder.work_order_number} • ส่ง ${confirmedDeliveryDate}`),
  ]);
  await audit(user, Number(workOrder.order_id), percent >= Number(machine.full_threshold || 100) ? "Override Capacity และจัดคิวผลิต" : "จัดคิวผลิต", `${machine.name} • ${productionDate} • ${percent}% • Confirmed Delivery ${previousDate || "-"} → ${confirmedDeliveryDate}${overrideReason ? ` • ${overrideReason}` : ""}`);
  try {
    await publishBroadcastEvent({ type: "production.queue_updated", departments: ["print_cut", "sale"], workOrderId, action: "scheduled" });
  } catch (error) {
    console.error("schedule realtime publish failed", { workOrderId, error: String(error) });
  }
  return Response.json({ ok: true, scheduleId: schedule.id, percent, estimatedMinutes });
}
