"use client";

import { useState } from "react";

type Props = {
  orderId: number;
  initialUrl: string;
  initialNote: string;
  updatedBy: string;
  updatedAt: string;
};

export default function ProductionFileLinkForm({ orderId, initialUrl, initialNote, updatedBy, updatedAt }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/production-file`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productionFileUrl: url, productionFileNote: note }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setMessage(result.error || "บันทึกลิงก์ไม่สำเร็จ");
        return;
      }
      setMessage("บันทึกลิงก์ไฟล์พร้อมผลิตแล้ว");
      window.setTimeout(() => location.reload(), 600);
    } catch {
      setMessage("เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return <div className="productionFileLink">
    <span>PRODUCTION FILE</span>
    <h3>ไฟล์พร้อมผลิตจากกราฟิก</h3>
    <p>วางลิงก์ Google Drive ของไฟล์สุดท้ายที่ฝ่ายผลิตต้องดาวน์โหลด ช่องนี้แยกจากไฟล์ต้นฉบับที่ลูกค้าส่งมา</p>
    {initialUrl && <a className="productionFileOpen" href={initialUrl} target="_blank" rel="noreferrer">เปิดไฟล์พร้อมผลิตใน Google Drive ↗</a>}
    <form onSubmit={submit}>
      <label>ลิงก์ Google Drive
        <input value={url} onChange={(event) => setUrl(event.target.value)} type="url" inputMode="url" placeholder="https://drive.google.com/..." required />
      </label>
      <label>หมายเหตุถึงฝ่ายผลิต
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="เช่น ใช้ไฟล์ PDF ในโฟลเดอร์ FINAL / ห้ามแก้สเกล" />
      </label>
      <small>กรุณาตั้งสิทธิ์ Google Drive เป็น “ทุกคนที่มีลิงก์ดูได้” ก่อนส่งผลิต</small>
      <button type="submit" disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกลิงก์ไฟล์ผลิต"}</button>
      {message && <b className={message.includes("แล้ว") ? "success" : "error"}>{message}</b>}
    </form>
    {updatedBy && <footer>แก้ไขล่าสุดโดย {updatedBy}{updatedAt ? ` • ${updatedAt}` : ""}</footer>}
  </div>;
}
