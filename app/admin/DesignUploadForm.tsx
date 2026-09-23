"use client";

import { useState } from "react";

type DesignOrderItem = { id: number; lineNo: number; name: string };

export default function DesignUploadForm({ orderId, items }: { orderId: number; items: DesignOrderItem[] }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<{ scale: string[]; mockup: string[] }>({ scale: [], mockup: [] });

  function selectFiles(type: "scale" | "mockup", files: FileList | null) {
    setSelected((current) => ({ ...current, [type]: Array.from(files || []).map((file) => file.name) }));
  }

  function captionFields(type: "scale" | "mockup", files: string[]) {
    if (!files.length) return null;
    return <div className="designCaptionList">
      <b>ข้อความใต้ภาพ — กรอกได้อิสระ</b>
      {files.map((fileName, index) => <label className="designCaptionRow" key={`${type}-${index}-${fileName}`}>
        <span>{index + 1}. {fileName}</span>
        <input name={`${type}_caption_${index}`} maxLength={300} placeholder="เช่น ด้านหน้า • สีตามแบบ • ขนาดจริง 5 ซม." />
      </label>)}
    </div>;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const scale = data.get("scale_design");
    const mockup = data.get("mockup_design");
    if (!(scale instanceof File && scale.size) && !(mockup instanceof File && mockup.size)) {
      setMessage("กรุณาเลือกภาพแบบมีสเกลหรือภาพม็อกอัปอย่างน้อย 1 ภาพ");
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/orders/${orderId}/designs`, { method: "POST", body: data });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (response.ok) {
      setMessage("ส่งแบบแล้ว • สถานะเปลี่ยนเป็น “ส่งแบบ” และลูกค้าสามารถอนุมัติจากลิงก์เดิมได้");
      event.currentTarget.reset();
      setSelected({ scale: [], mockup: [] });
      setTimeout(() => location.reload(), 700);
    } else {
      setMessage(result.error || "อัปโหลดไม่สำเร็จ");
    }
  }

  return <form className="designUploadForm" onSubmit={submit}>
    <label className="designItemTarget">
      <b>ภาพชุดนี้เป็นของรายการใด *</b>
      <span>ระบบจะแสดงภาพไว้กับรายการที่เลือกในใบงานฉบับเดียว</span>
      <select name="order_item_id" required defaultValue={items.length === 1 ? String(items[0].id) : ""}>
        {items.length > 1 && <option value="" disabled>เลือกรายการสินค้า</option>}
        {items.map((item) => <option key={item.id} value={item.id}>รายการ {item.lineNo} — {item.name}</option>)}
      </select>
    </label>
    <div className="designFilePair">
      <label>
        <b>1. ภาพแบบมีสเกล (เลือกได้)</b>
        <span>เลือกได้หลายภาพ เช่น ด้านหน้า ด้านหลัง และรายละเอียดขนาด</span>
        <input multiple type="file" name="scale_design" accept=".png,.jpg,.jpeg,.webp" onChange={(event) => selectFiles("scale", event.currentTarget.files)} />
        {captionFields("scale", selected.scale)}
      </label>
      <label>
        <b>2. ภาพม็อกอัป (เลือกได้)</b>
        <span>เลือกภาพจำลองสินค้าได้หลายมุม</span>
        <input multiple type="file" name="mockup_design" accept=".png,.jpg,.jpeg,.webp" onChange={(event) => selectFiles("mockup", event.currentTarget.files)} />
        {captionFields("mockup", selected.mockup)}
      </label>
    </div>
    <small className="designUploadHint">เลือกอย่างใดอย่างหนึ่งหรือทั้งสองประเภทก็ได้ • รายการละหลายภาพ • ประเภทละไม่เกิน 10 ภาพ</small>
    <label>หมายเหตุถึงลูกค้า<textarea name="note" rows={3} placeholder="เช่น โปรดตรวจขนาด สี ตำแหน่งรู และอะไหล่ก่อนเซ็นยืนยัน" /></label>
    <p className="graphicSignatureNote">ผู้จัดทำแบบ: ระบบจะลงชื่อผู้ใช้งานที่กำลังล็อกอินและบันทึกวันเวลาให้อัตโนมัติ</p>
    <button disabled={saving}>{saving ? "กำลังส่งแบบ..." : "ส่งแบบให้ลูกค้าอนุมัติ"}</button>
    {message && <small>{message}</small>}
  </form>;
}
