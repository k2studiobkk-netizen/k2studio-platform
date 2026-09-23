import { env, waitUntil } from "cloudflare:workers";
import { publishBroadcastEvent } from "../../../../broadcast-server";
import { syncWorkOrderFromOrder } from "../../../../work-order-sync";

function bangkokToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/i.test(token)) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await request.json() as { action?: string; customerName?: string; note?: string; confirmed?: boolean };
  const name = (body.customerName || "").trim().slice(0, 120);
  const note = (body.note || "").trim().slice(0, 1000);
  if (!name || !["approve", "request_changes"].includes(body.action || "")) return Response.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  if (body.action === "approve" && !body.confirmed) return Response.json({ error: "กรุณายืนยันรายละเอียดแบบ" }, { status: 400 });
  if (body.action === "request_changes" && !note) return Response.json({ error: "กรุณาระบุจุดที่ต้องการแก้ไข" }, { status: 400 });

  const database = (env as unknown as { DB: D1Database }).DB;
  const design = await database.prepare(`SELECT d.id,d.order_id,d.version_no,o.order_number,o.requested_date
    FROM design_versions d JOIN orders o ON o.id=d.order_id
    WHERE o.public_token=? AND d.status='pending' ORDER BY d.version_no DESC LIMIT 1`)
    .bind(token).first<{ id: number; order_id: number; version_no: number; order_number: string; requested_date: string }>();
  if (!design) return Response.json({ error: "แบบนี้ได้รับการตอบกลับแล้ว" }, { status: 409 });

  const approved = body.action === "approve";
  let workOrder = await database.prepare("SELECT id,status FROM work_orders WHERE order_id=? LIMIT 1")
    .bind(design.order_id).first<{ id: number; status: string }>();
  const actor = await database.prepare("SELECT user_id FROM audit_logs WHERE order_id=? AND action='สร้างใบงาน' ORDER BY id LIMIT 1")
    .bind(design.order_id).first<{ user_id: number }>();
  const actorId = Number(actor?.user_id || 1);
  if (approved && !workOrder) {
    await syncWorkOrderFromOrder(database, design.order_id, { actorId });
    workOrder = await database.prepare("SELECT id,status FROM work_orders WHERE order_id=? LIMIT 1")
      .bind(design.order_id).first<{ id: number; status: string }>();
  }
  if (approved && !workOrder) return Response.json({ error: "ไม่สามารถสร้างคิวผลิตได้ กรุณาแจ้งทีมงาน" }, { status: 500 });

  if (approved) {
    const productionDate = bangkokToday();
    const deliveryDate = /^\d{4}-\d{2}-\d{2}$/.test(design.requested_date) ? design.requested_date : productionDate;
    const alreadyInWorkflow = !["draft", "artwork_approval_pending", "artwork_changes_requested"].includes(String(workOrder!.status));
    const message = alreadyInWorkflow
      ? `ลูกค้า ${name} อนุมัติแบบ V${design.version_no} • งานยังคงอยู่ในสถานะเดิมของทีมงาน`
      : `ลูกค้า ${name} อนุมัติแบบ V${design.version_no} • ระบบส่งเข้าไลน์ผลิตอัตโนมัติ`;
    if (alreadyInWorkflow) {
      await database.batch([
        database.prepare("UPDATE design_versions SET status='approved',customer_note=?,responded_by=?,responded_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(note, name, design.id),
        database.prepare("INSERT INTO order_status_history (order_id,status,note) SELECT id,order_status,? FROM orders WHERE id=?").bind(message, design.order_id),
      ]);
      return Response.json({ ok: true, status: "approved", orderStatus: String(workOrder!.status), preservedWorkflow: true });
    }
    await database.batch([
      database.prepare("UPDATE design_versions SET status='approved',customer_note=?,responded_by=?,responded_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(note, name, design.id),
      database.prepare("UPDATE orders SET order_status='waiting_for_production',production_released_at=CURRENT_TIMESTAMP,production_released_by=? WHERE id=?").bind(`ลูกค้า ${name}`, design.order_id),
      database.prepare("UPDATE work_orders SET status='waiting_for_production',planned_production_date=?,confirmed_delivery_date=?,queue_removed=0,queue_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(productionDate, deliveryDate, workOrder!.id),
      database.prepare("INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)").bind(design.order_id, "waiting_for_production", message),
      database.prepare("INSERT INTO work_order_status_history (work_order_id,status,note,changed_by) VALUES (?,?,?,?)").bind(workOrder!.id, "waiting_for_production", message, actorId),
      database.prepare(`INSERT INTO production_queue_events
        (work_order_id,department,action,note,from_status,to_status,from_rank,to_rank,changed_by,changed_by_name)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(workOrder!.id, "print_cut", "customer_approved", message, workOrder!.status, "waiting_for_production", 0, 0, actorId, `ลูกค้า ${name}`),
    ]);
    waitUntil(publishBroadcastEvent({
      type: "production.queue_updated",
      departments: ["print_cut", "sale"],
      workOrderId: workOrder!.id,
      action: "customer_approved",
    }).catch((error) => console.error("customer approval realtime publish failed", { orderId: design.order_id, error: String(error) })));
    return Response.json({ ok: true, status: "approved", orderStatus: "waiting_for_production" });
  }

  const message = `ลูกค้า ${name} ขอแก้ไขแบบ V${design.version_no}: ${note}`;
  await database.batch([
    database.prepare("UPDATE design_versions SET status='changes_requested',customer_note=?,responded_by=?,responded_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(note, name, design.id),
    database.prepare("UPDATE orders SET order_status='artwork_changes_requested' WHERE id=?").bind(design.order_id),
    database.prepare("INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)").bind(design.order_id, "artwork_changes_requested", message),
  ]);
  return Response.json({ ok: true, status: "changes_requested", orderStatus: "artwork_changes_requested" });
}
