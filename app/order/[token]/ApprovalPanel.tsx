"use client";

import { useRef, useState } from "react";

export default function ApprovalPanel({ token, version, status }: { token: string; version: number; status: string }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const nameRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  function showFieldError(text: string, field: HTMLInputElement | HTMLTextAreaElement | null) {
    setMessageType("error");
    setMessage(text);
    field?.focus();
    field?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function act(action: "approve" | "request_changes") {
    if (saving) return;
    if (!name.trim()) {
      showFieldError("กรุณากรอกชื่อผู้อนุมัติก่อนกดยืนยัน", nameRef.current);
      return;
    }
    if (action === "approve" && !confirmed) {
      showFieldError("กรุณาติ๊กช่องยืนยันข้อมูลและภาพก่อนอนุมัติ", confirmRef.current);
      return;
    }
    if (action === "request_changes" && !note.trim()) {
      showFieldError("กรุณาระบุจุดที่ต้องการแก้ไข", noteRef.current);
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${token}/approval`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, customerName: name.trim(), note: note.trim(), confirmed }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง");
      setMessageType("success");
      setMessage(action === "approve" ? "อนุมัติแบบเรียบร้อยแล้ว" : "ส่งคำขอแก้ไขให้ทีมงานแล้ว");
      window.setTimeout(() => location.reload(), 1100);
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  if (status !== "pending") return <div className={`approvalResult ${status}`}><b>{status === "approved" ? "✓ ลูกค้าอนุมัติแบบนี้สำหรับผลิตแล้ว" : "ลูกค้าขอแก้ไขแบบนี้"}</b></div>;

  return <div className="approvalPanel">
    <label>ชื่อผู้อนุมัติ (พิมพ์ชื่อ–นามสกุล) *<input ref={nameRef} value={name} onChange={(event) => { setName(event.target.value); setMessage(""); }} placeholder="ชื่อ–นามสกุล หรือชื่อบริษัท" autoComplete="name" /></label>
    <label>ความคิดเห็น / จุดที่ต้องการแก้<textarea ref={noteRef} rows={3} value={note} onChange={(event) => { setNote(event.target.value); setMessage(""); }} placeholder="กรอกเมื่อขอแก้ไข หรือฝากหมายเหตุเพิ่มเติม" /></label>
    <label className="approvalConfirm"><input ref={confirmRef} type="checkbox" checked={confirmed} onChange={(event) => { setConfirmed(event.target.checked); setMessage(""); }} /><span>ข้าพเจ้ายืนยันข้อมูลและภาพทั้งหมดในแบบ V{version} เพื่อส่งผลิตจริง</span></label>
    <p className="approvalHelp">ก่อนอนุมัติ: กรอกชื่อผู้อนุมัติ และติ๊กช่องยืนยันด้านบน</p>
    {message && <small className={`approvalMessage ${messageType}`} role={messageType === "error" ? "alert" : "status"}>{message}</small>}
    <div><button type="button" className="approveButton" disabled={saving} onClick={() => void act("approve")}>{saving ? "กำลังบันทึก…" : "อนุมัติแบบและยืนยันผลิต"}</button><button type="button" className="changesButton" disabled={saving} onClick={() => void act("request_changes")}>ขอแก้ไขแบบ</button></div>
  </div>;
}
