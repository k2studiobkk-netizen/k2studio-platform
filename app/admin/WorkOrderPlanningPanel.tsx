"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: number; name: string; code: string };
type Schedule = { id: number; production_date: string; machine_name: string; process_name: string; estimated_minutes: number; quantity: number };

export default function WorkOrderPlanningPanel({
  orderId,
  workOrder,
  machines,
  processes,
  schedules,
  canCreate,
  canSchedule,
  canOverride,
  canManageQueue,
}: {
  orderId: number;
  workOrder: Record<string, string | number> | null;
  machines: Option[];
  processes: Option[];
  schedules: Schedule[];
  canCreate: boolean;
  canSchedule: boolean;
  canOverride: boolean;
  canManageQueue: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function createWorkOrder() {
    setSaving(true);
    setMessage("กำลังออกใบงานฝ่ายผลิต…");
    const response = await fetch(`/api/admin/orders/${orderId}/work-order`, { method: "POST" });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    setMessage(response.ok ? "ออกใบงานแล้ว • งานเข้าสู่จอ Print & Cut ทันที" : result.error || "ออกใบงานไม่สำเร็จ");
    if (response.ok) setTimeout(() => router.refresh(), 600);
  }

  async function addSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workOrder) return;
    setSaving(true);
    setMessage("กำลังตรวจ Capacity…");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/work-orders/${workOrder.id}/schedule`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        machineId: data.get("machine_id"),
        processId: data.get("process_id"),
        productionDate: data.get("production_date"),
        confirmedDeliveryDate: data.get("confirmed_delivery_date"),
        quantity: data.get("quantity"),
        estimatedMinutes: data.get("estimated_minutes"),
        priority: data.get("priority"),
        overrideReason: data.get("override_reason"),
      }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string; percent?: number; estimatedMinutes?: number };
    setSaving(false);
    setMessage(response.ok ? `บันทึกคิวแล้ว • ใช้ ${result.estimatedMinutes} นาที • Load เครื่องหลังเพิ่ม ${result.percent}%` : result.error || "บันทึกคิวไม่สำเร็จ");
    if (response.ok) setTimeout(() => router.refresh(), 700);
  }

  async function updateQueue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workOrder) return;
    setSaving(true); setMessage("กำลังบันทึกโน้ตและลำดับคิว…");
    const data = new FormData(event.currentTarget);
    const status = String(workOrder.status || "");
    const department = ["packing", "waiting_for_packing", "ready_to_ship"].includes(status) ? "pack" : "print_cut";
    const response = await fetch("/api/admin/production/queue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      workOrderId: Number(workOrder.id), department, action: "update_metadata", note: data.get("dashboard_note"), queueRank: data.get("queue_rank"), priority: data.get("queue_priority"),
    }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false); setMessage(response.ok ? "บันทึกโน้ตและลำดับบนจอแล้ว" : result.error || "บันทึกไม่สำเร็จ");
    if (response.ok) setTimeout(() => router.refresh(), 500);
  }

  if (!workOrder) return <section className="productionPlanningPanel empty">
    <span>PRODUCTION WORK ORDER</span>
    <h2>กำลังเตรียมข้อมูลฝ่ายผลิต</h2>
    <p>บันทึกข้อมูลใบงานอีกครั้งเพื่อให้ระบบสร้างข้อมูลเชื่อมปฏิทินและหน้าจอฝ่ายผลิตอัตโนมัติ</p>
    {message && <div role="status">{message}</div>}
  </section>;

  if (String(workOrder.status) === "draft") return <section className="productionPlanningPanel productionDraftReady">
    <header><div><span>AUTO-SYNCED PRODUCTION DRAFT</span><h2>{String(workOrder.work_order_number)}</h2></div><a href="#order-edit">แก้ไขข้อมูลต้นฉบับ ↑</a></header>
    <div className="productionAutoSyncNotice"><b>ข้อมูลเชื่อมระบบฝ่ายผลิตแล้ว</b><p>ชื่อลูกค้า รายการสินค้า จำนวน สเปก และกำหนดส่งจะอัปเดตจากใบงานนี้อัตโนมัติ ทีมงานทุกฝ่ายสามารถเปลี่ยนสถานะเพื่อส่งเข้าจอ Print &amp; Cut ได้</p></div>
    <div className="productionDateSeparation"><article><span>วันที่ลูกค้าต้องการ</span><b>{String(workOrder.customer_requested_date || "ยังไม่ระบุ")}</b><small>ใช้เป็นกำหนดส่งในปฏิทิน</small></article><i>→</i><article className="pending"><span>ขั้นตอนถัดไป</span><b>ทีมงานเลือกสถานะได้ทันที</b><small>การอนุมัติแบบของลูกค้าไม่ล็อกการส่งผลิต</small></article></div>
    <small className="productionAutomaticRelease">ทุกการเปลี่ยนสถานะจะบันทึกชื่อผู้ใช้งานและเวลาไว้ในประวัติ</small>
    {message && <div className="productionPlanningMessage" role="status">{message}</div>}
  </section>;

  return <section className="productionPlanningPanel">
    <header><div><span>PRODUCTION WORK ORDER</span><h2>{String(workOrder.work_order_number)}</h2></div><a href="/admin/production/calendar">เปิด Production Calendar →</a></header>
    <div className="productionDateSeparation">
      <article><span>วันที่ลูกค้าต้องการ</span><b>{String(workOrder.customer_requested_date || "ยังไม่ระบุ")}</b><small>ใช้ประกอบการวางแผนเท่านั้น</small></article>
      <i>≠</i>
      <article className={workOrder.confirmed_delivery_date ? "confirmed" : "pending"}><span>วันส่งที่ฝ่ายผลิตยืนยัน</span><b>{String(workOrder.confirmed_delivery_date || "ยังไม่ยืนยัน")}</b><small>ยึด Production Calendar เป็นหลัก</small></article>
    </div>
    {schedules.length > 0 && <div className="productionSegments"><b>คิวผลิตที่บันทึกแล้ว</b>{schedules.map((row) => <article key={row.id}><span>{row.production_date}</span><strong>{row.machine_name}</strong><small>{row.process_name || "ไม่ระบุกระบวนการ"} • {Number(row.quantity).toLocaleString("th-TH")} หน่วย • {row.estimated_minutes} นาที</small></article>)}</div>}
    {canManageQueue && <form className="productionQueueManager" onSubmit={updateQueue}><div><span>TV QUEUE CONTROL</span><h3>โน้ตและลำดับคิวหน้าจอ</h3><p>เลข 1 จะแทรกขึ้นก่อนเลข 2 ส่วนเลข 0 ให้ระบบเรียงตามกำหนดส่งอัตโนมัติ</p></div><label>โน้ตจากผู้ดูแล<textarea name="dashboard_note" rows={2} maxLength={500} defaultValue={String(workOrder.dashboard_note || "")} placeholder="ข้อความสั้น ๆ ที่ต้องให้ทีมงานเห็นบนการ์ด" /></label><label>ลำดับคิว<input name="queue_rank" type="number" min="0" max="9999" defaultValue={Number(workOrder.queue_rank || 0)} /></label><label>ความเร่งด่วน<select name="queue_priority" defaultValue={String(workOrder.priority || "normal")}><option value="normal">ปกติ</option><option value="high">สำคัญ</option><option value="urgent">ด่วน — แสดงกรอบแสง</option></select></label><button type="submit" disabled={saving}>บันทึกขึ้นจอ</button></form>}
    {canSchedule ? machines.length ? <form className="productionScheduleForm" onSubmit={addSchedule}>
      <h3>เพิ่มช่วงการผลิต</h3><p>เพิ่มซ้ำได้เมื่อแบ่งงานหลายวัน ระบบจะรวม Load ของแต่ละวันและเครื่องแยกกัน</p>
      <label>เครื่องจักร<select name="machine_id" required defaultValue=""><option value="" disabled>เลือกเครื่องจักร</option>{machines.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label>
      <label>กระบวนการ<select name="process_id" defaultValue=""><option value="">ไม่ระบุ</option>{processes.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label>
      <label>วันที่ผลิต<input type="date" name="production_date" required /></label>
      <label>วันส่งที่ยืนยันแล้ว<input type="date" name="confirmed_delivery_date" required defaultValue={String(workOrder.confirmed_delivery_date || "")} /></label>
      <label>จำนวนในช่วงนี้<input type="number" name="quantity" min="1" required defaultValue={Number(workOrder.quantity || 1)} /></label>
      <label>เวลาที่ใช้ (นาที)<input type="number" name="estimated_minutes" min="1" max="14400" placeholder="เว้นว่างเพื่อคำนวณจาก Capacity Rule" /></label>
      <label>ความสำคัญ<select name="priority" defaultValue={String(workOrder.priority || "normal")}><option value="low">ต่ำ</option><option value="normal">ปกติ</option><option value="high">สูง</option><option value="urgent">ด่วน</option></select></label>
      {canOverride && <label className="wide">เหตุผล Override Capacity (กรอกเมื่อคิวเต็ม)<textarea name="override_reason" rows={2} placeholder="ระบุผลกระทบและเหตุผลที่ต้องแทรกคิว" /></label>}
      <button type="submit" disabled={saving}>{saving ? "กำลังตรวจและบันทึก…" : "ตรวจ Capacity และบันทึกคิว"}</button>
    </form> : <div className="capacitySetupRequired"><b>ยังไม่มีเครื่องจักรในระบบ</b><a href="/admin/production/capacity">ตั้งค่าเครื่องจักรและ Capacity →</a></div> : <p className="productionReadOnly">คุณสามารถดูคิวและวันส่งได้ แต่ไม่มีสิทธิ์กำหนดหรือเปลี่ยนวันส่งที่ยืนยันแล้ว</p>}
    {message && <div className="productionPlanningMessage" role="status">{message}</div>}
  </section>;
}
