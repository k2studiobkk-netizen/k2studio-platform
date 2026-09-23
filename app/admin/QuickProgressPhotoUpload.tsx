"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publicOrderStatus, statusLabels } from "../order-status";

export default function QuickProgressPhotoUpload({ token, initialStatus }: { token: string; initialStatus: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const stage = publicOrderStatus(initialStatus);

  function updateSelectedCount(input: HTMLInputElement) {
    const form = input.form;
    if (!form) return;
    const count = new FormData(form).getAll("photos")
      .filter((value): value is File => value instanceof File && value.size > 0).length;
    setSelectedCount(count);
    setMessage("");
    setError("");
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const files = data.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) { setError("กรุณาถ่ายรูปหรือเลือกรูปก่อนบันทึก"); return; }
    if (files.length > 10) { setError("อัปโหลดได้ครั้งละไม่เกิน 10 ภาพ"); return; }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/orders/${token}/progress`, { method: "POST", body: data });
      const result = await response.json().catch(() => ({})) as { error?: string; count?: number };
      if (!response.ok) throw new Error(result.error || "บันทึกภาพไม่สำเร็จ");
      setMessage(`บันทึกภาพงาน ${result.count || files.length} ภาพแล้ว`);
      form.reset();
      setSelectedCount(0);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกภาพไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return <form className="quickProgressPhoto" onSubmit={upload}>
    <header><div><span>QUICK PHOTO UPDATE</span><h2>ถ่ายรูปงานตอนนี้</h2><p>ใช้ได้เมื่อค้นหาเลขใบงานแล้วเปิดหน้านี้ ไม่ต้องสแกน QR</p></div><b>{statusLabels[stage]}</b></header>
    <div className="quickProgressPhotoBody">
      <div className="quickPhotoSources">
        <label className="quickPhotoButton camera"><span aria-hidden="true">📷</span><b>เปิดกล้องถ่ายรูป</b><small>ใช้กล้องหลังของมือถือ</small><input name="photos" type="file" accept="image/*,.heic,.heif" capture="environment" aria-label="ถ่ายรูปงานด้วยกล้องหลัง" onChange={(event) => updateSelectedCount(event.currentTarget)}/></label>
        <label className="quickPhotoButton library"><span aria-hidden="true">▧</span><b>เลือกจากเครื่อง</b><small>เลือกพร้อมกันได้หลายภาพ</small><input name="photos" type="file" accept="image/*,.heic,.heif" multiple aria-label="เลือกรูปงานจากเครื่อง" onChange={(event) => updateSelectedCount(event.currentTarget)}/></label>
      </div>
      <label className="quickPhotoCaption"><span>รายละเอียดภาพ (ไม่บังคับ)</span><input name="caption" type="text" maxLength={300} placeholder="เช่น พิมพ์เสร็จแล้ว รอตัด"/></label>
      <button type="submit" disabled={saving || selectedCount === 0}>{saving ? "กำลังบันทึกภาพ…" : selectedCount ? `บันทึก ${selectedCount} ภาพในใบงาน` : "เลือกหรือถ่ายรูปก่อน"}</button>
    </div>
    {message&&<p className="quickPhotoMessage success" role="status">✓ {message}</p>}
    {error&&<p className="quickPhotoMessage error" role="alert">{error}</p>}
  </form>;
}
