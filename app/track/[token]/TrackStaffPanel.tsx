"use client";

import { useState } from "react";
import { publicOrderStatus, statusLabels, statusSteps } from "../../order-status";

export default function TrackStaffPanel({ token, initialStatus, displayName, designApproved, approvedVersion }: { token: string; initialStatus: string; displayName: string; designApproved: boolean; approvedVersion?: number }) {
  const [statusSaving, setStatusSaving] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [selectedPhotoCount, setSelectedPhotoCount] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const stage = publicOrderStatus(initialStatus);
  const stageIndex = statusSteps.indexOf(stage);
  const packComplete = ["ready_to_ship", "shipped", "completed"].includes(initialStatus);
  const nextStatus = stage === "production" ? "packing" : stage === "packing" && !packComplete ? "ready_to_ship" : "";

  async function updateStatus(targetStatus = selectedStatus) {
    if (!targetStatus) return;
    setStatusSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/orders/${token}/staff-update`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderStatus: targetStatus, note }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "บันทึกสถานะไม่สำเร็จ");
      setMessage(targetStatus === "packing" ? "ผลิตเสร็จแล้ว • งานย้ายไปหน้าจอ Pack" : `อัปเดตเป็น “${statusLabels[targetStatus] || targetStatus}” แล้ว`);
      window.setTimeout(() => location.reload(), 650);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกสถานะไม่สำเร็จ");
    } finally { setStatusSaving(false); }
  }

  async function uploadPhotos(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPhotoSaving(true); setMessage(""); setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const files = data.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) { setPhotoSaving(false); setError("กรุณาเลือกภาพอย่างน้อย 1 ภาพ"); return; }
    if (files.length > 10) { setPhotoSaving(false); setError("อัปโหลดได้ครั้งละไม่เกิน 10 ภาพ"); return; }
    try {
      const response = await fetch(`/api/orders/${token}/progress`, { method: "POST", body: data });
      const result = await response.json() as { error?: string; count?: number };
      if (!response.ok) throw new Error(result.error || "อัปโหลดภาพไม่สำเร็จ");
      setMessage(`อัปโหลดภาพความคืบหน้า ${result.count || files.length} ภาพแล้ว`);
      form.reset();
      setSelectedPhotoCount(0);
      window.setTimeout(() => location.reload(), 650);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "อัปโหลดภาพไม่สำเร็จ");
    } finally { setPhotoSaving(false); }
  }

  function updateSelectedPhotoCount(input: HTMLInputElement) {
    const form = input.form;
    if (!form) return;
    const count = new FormData(form).getAll("photos")
      .filter((value): value is File => value instanceof File && value.size > 0).length;
    setSelectedPhotoCount(count);
    setError("");
  }

  return <section className="trackStaffPanel">
    <header>
      <div><span>STAFF MODE</span><h2>อัปเดตงานจาก QR</h2><p>เข้าสู่ระบบแล้วในชื่อ <b>{displayName}</b></p></div>
      <a href="/api/staff/logout">ออกจากระบบ</a>
    </header>
    <div className="trackStaffGrid">
      <div className="trackStaffStatus simplified">
        <h3>ขั้นตอนการทำงาน</h3>
        <div className="staffWorkflowSteps">{statusSteps.map((item, index) => <span className={index <= stageIndex ? "done" : ""} key={item}><i>{index < stageIndex ? "✓" : index + 1}</i>{statusLabels[item]}</span>)}</div>
        {stage === "received" && <p>รอกราฟิกอัปโหลดและกดส่งแบบ ระบบจะเปลี่ยนเป็น “ส่งแบบ” อัตโนมัติ</p>}
        {stage === "design_sent" && <p>{designApproved ? `ลูกค้าอนุมัติแบบ V${approvedVersion} แล้ว` : "ลูกค้ายังไม่อนุมัติแบบ แต่ทีมงานสามารถเปลี่ยนสถานะและส่งผลิตได้ทันที"}</p>}
        {stage === "production" && <p>งานอยู่ในไลน์ Print &amp; Cut เมื่อผลิตและตัดเสร็จให้กดปุ่มด้านล่าง</p>}
        {stage === "packing" && <p>{packComplete ? "งานแพ็กเสร็จและพร้อมส่งแล้ว" : "งานถูกส่งมายังห้อง Pack แล้ว"}</p>}
        {stage === "completed" && <p>งานเสร็จสมบูรณ์และออกจากคิวงานค้างทุกหน้าจอแล้ว</p>}
        <label>เลือกสถานะ<select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}><option value="waiting_for_artwork_review">รอตรวจไฟล์</option><option value="waiting_for_graphic">รอกราฟิก</option><option value="artwork_preparation">กราฟิกกำลังเตรียมแบบ</option><option value="artwork_approval_pending">ส่งแบบ / รอลูกค้าตรวจ</option><option value="waiting_for_production">รอผลิต</option><option value="scheduled">จัดคิวผลิตแล้ว</option><option value="in_production">กำลังผลิต</option><option value="quality_check">ตรวจคุณภาพ (QC)</option><option value="packing">กำลังแพ็ก</option><option value="ready_to_ship">พร้อมส่ง</option><option value="shipped">จัดส่งแล้ว</option><option value="completed">เสร็จสมบูรณ์</option><option value="on_hold">พักงาน</option><option value="cancelled">ยกเลิก</option></select></label>
        <label>หมายเหตุถึงทีมงาน/ลูกค้า<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="เช่น เริ่มพิมพ์แล้ว หรือตรวจจำนวนครบแล้ว" /></label>
        <button type="button" onClick={() => void updateStatus()} disabled={statusSaving}>{statusSaving ? "กำลังบันทึก..." : "อัปเดตสถานะทันที"}</button>
        {nextStatus && selectedStatus !== nextStatus && <button type="button" className="trackStaffQuickAction" onClick={() => void updateStatus(nextStatus)} disabled={statusSaving}>{nextStatus === "packing" ? "ผลิตเสร็จ → ส่งห้อง Pack" : "แพ็กเสร็จ → พร้อมส่ง"}</button>}
      </div>
      <form className="trackPhotoUpload" onSubmit={uploadPhotos}>
        <h3>อัปโหลดภาพความคืบหน้า</h3>
        <p className="trackPhotoStage"><span>ขั้นตอนปัจจุบัน</span><b>{statusLabels[stage]}</b></p>
        <div className="trackPhotoSources">
          <label className="trackPhotoSource camera"><span aria-hidden="true">📷</span><b>ถ่ายรูปตอนนี้</b><small>เปิดกล้องหลัง</small><input name="photos" type="file" accept="image/*,.heic,.heif" capture="environment" aria-label="ถ่ายรูปด้วยกล้องหลัง" onChange={(event) => updateSelectedPhotoCount(event.currentTarget)} /></label>
          <label className="trackPhotoSource library"><span aria-hidden="true">▧</span><b>เลือกจากเครื่อง</b><small>เลือกได้หลายภาพ</small><input name="photos" type="file" accept="image/*,.heic,.heif" multiple aria-label="เลือกรูปจากเครื่อง" onChange={(event) => updateSelectedPhotoCount(event.currentTarget)} /></label>
        </div>
        <b className={`trackPhotoSelection ${selectedPhotoCount ? "ready" : ""}`} aria-live="polite">{selectedPhotoCount ? `เลือกแล้ว ${selectedPhotoCount} ภาพ • พร้อมอัปโหลด` : "ยังไม่ได้เลือกรูป"}</b>
        <small>รองรับ JPG, PNG, WEBP, HEIC และ HEIF • ภาพละไม่เกิน 20 MB รวมไม่เกิน 60 MB • รูปใหม่จะเพิ่มต่อท้ายโดยไม่ลบรูปเดิม</small>
        <label>คำอธิบาย<textarea name="caption" rows={3} maxLength={300} placeholder="เช่น ตัวอย่างหลังพิมพ์ ก่อนประกอบอะไหล่" /></label>
        <button disabled={photoSaving || selectedPhotoCount === 0}>{photoSaving ? "กำลังอัปโหลด..." : `อัปโหลดเข้า “${statusLabels[stage]}”`}</button>
      </form>
    </div>
    {message && <p className="trackStaffMessage success" role="status">{message}</p>}
    {error && <p className="trackStaffMessage error" role="alert">{error}</p>}
  </section>;
}
