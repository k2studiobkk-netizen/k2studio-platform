"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { statusLabels } from "../order-status";

const receivedStatuses = new Set(["waiting_for_artwork_review", "draft", "waiting_for_graphic", "artwork_preparation", "quotation_pending"]);
const designStatuses = new Set(["artwork_approval_pending", "artwork_changes_requested", "artwork_approved", "confirmed"]);
const productionStatuses = new Set(["work_order_created", "waiting_for_production", "scheduled", "in_production", "quality_check"]);

function nextStatusFor(status: string) {
  if (receivedStatuses.has(status)) return "artwork_approval_pending";
  if (designStatuses.has(status)) return "in_production";
  if (productionStatuses.has(status)) return "packing";
  if (status === "packing") return "ready_to_ship";
  if (["ready_to_ship", "shipped"].includes(status)) return "completed";
  return "";
}

export default function StatusForm({ orderId, publicToken, initialStatus, outstandingAmount, hasPaymentEvidence }: { orderId: number; publicToken: string; initialStatus: string; outstandingAmount: number; hasPaymentEvidence: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const nextStatus = nextStatusFor(initialStatus);
  const paymentLockedStatuses = new Set(["ready_to_ship", "shipped", "completed"]);
  const paymentPending = outstandingAmount > 0.009 || !hasPaymentEvidence;

  async function save(targetStatus?: string) {
    const selectedStatus = targetStatus || status;
    if (paymentPending && paymentLockedStatuses.has(selectedStatus)) {
      setMessage(`ยังปิดงานไม่ได้ • ยอดค้างชำระ ฿${outstandingAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`);
      const paymentTools = document.getElementById("payment-tools") as HTMLDetailsElement | null;
      if (paymentTools) { paymentTools.open = true; paymentTools.scrollIntoView({ behavior: "smooth", block: "start" }); }
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderStatus: selectedStatus, note }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    setMessage(response.ok ? `เปลี่ยนเป็น “${statusLabels[selectedStatus] || selectedStatus}” แล้ว` : result.error || "บันทึกไม่สำเร็จ");
    if (response.ok) {
      setStatus(selectedStatus);
      setNote("");
      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("k2-order-status");
        channel.postMessage({ token: publicToken, status: selectedStatus });
        channel.close();
      }
      router.refresh();
    }
  }

  return <div className="statusForm statusCommandForm">
    <div className="statusCurrent"><span>สถานะปัจจุบัน</span><strong>{statusLabels[initialStatus] || initialStatus}</strong></div>
    {nextStatus ? <button className={`statusNextButton ${paymentPending && paymentLockedStatuses.has(nextStatus) ? "paymentLocked" : ""}`} type="button" onClick={() => void save(nextStatus)} disabled={saving}>
      <span>{saving ? "กำลังบันทึก…" : "เปลี่ยนเป็นขั้นตอนถัดไป"}</span>
      <b>{paymentPending && paymentLockedStatuses.has(nextStatus) ? "แนบสลิปยอดคงเหลือก่อน" : `${statusLabels[nextStatus] || nextStatus} →`}</b>
    </button> : <div className="statusFinished"><b>{initialStatus === "completed" ? "งานนี้เสร็จสมบูรณ์แล้ว" : "ไม่มีขั้นตอนถัดไปอัตโนมัติ"}</b><span>เลือกสถานะอื่นได้จากเมนูด้านล่าง</span></div>}
    <details className="statusAdvanced">
      <summary>เลือกสถานะอื่น / เพิ่มหมายเหตุ</summary>
      <div>
        <label>สถานะที่ต้องการ
          <select aria-label="เลือกสถานะงาน" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="waiting_for_artwork_review">รอตรวจไฟล์</option><option value="waiting_for_graphic">รอกราฟิก</option><option value="artwork_preparation">กราฟิกกำลังเตรียมแบบ</option><option value="quotation_pending">รอยืนยันราคา</option><option value="artwork_approval_pending">ส่งแบบ / รอลูกค้าตรวจ</option><option value="artwork_changes_requested">ลูกค้าขอแก้ไขแบบ</option><option value="artwork_approved">ลูกค้าอนุมัติแบบแล้ว</option><option value="work_order_created">ออกใบงานแล้ว</option><option value="waiting_for_production">รอผลิต</option><option value="scheduled">จัดคิวผลิตแล้ว</option><option value="in_production">กำลังผลิต</option><option value="quality_check">ตรวจคุณภาพ (QC)</option><option value="packing">กำลังแพ็ก</option><option value="ready_to_ship">พร้อมส่ง</option><option value="shipped">จัดส่งแล้ว</option><option value="completed">เสร็จสมบูรณ์</option><option value="on_hold">พักงาน</option><option value="cancelled">ยกเลิก</option>
          </select>
        </label>
        <label>หมายเหตุถึงทีมงาน/ลูกค้า<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="เช่น ลูกค้านัดรับสินค้าเวลา 16:00 น." rows={3}/></label>
        <button type="button" onClick={() => void save()} disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกสถานะที่เลือก"}</button>
      </div>
    </details>
    {message && <small role="status">{message}</small>}
  </div>;
}
