"use client";
import { useState } from "react";
import { VAT_ALL_ORDERS, VAT_TRANSITION, vatPolicyModeLabel } from "../../vat-collection-policy.mjs";

export default function VatPolicySettings({ initialMode, initialRevision }: { initialMode: string; initialRevision: number }) {
  const [savedMode, setSavedMode] = useState(initialMode), [mode, setMode] = useState(initialMode), [revision, setRevision] = useState(initialRevision);
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function save() {
    if (!confirmed || busy || mode === savedMode) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/vat-policy", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, revision, confirmed }) });
      const result = await response.json() as { error?: string; mode: string; revision: number };
      if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
      setSavedMode(result.mode); setMode(result.mode); setRevision(result.revision); setConfirmed(false); setMessage("บันทึกแล้ว มีผลกับใบงานใหม่เท่านั้น ใบงานเก่าไม่เปลี่ยนยอด");
    } catch (error) { setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <section className="vatPolicySettings" aria-labelledby="vat-settings-title">
    <h2 id="vat-settings-title">การเรียกเก็บ VAT กับลูกค้า</h2>
    <p>โหมดปัจจุบัน: <strong>{vatPolicyModeLabel(savedMode)}</strong></p>
    <p>เป้าหมายเดือนตุลาคม 2569: บวกทุกยอด โดยผู้ดูแลกดเปิดเอง ไม่มีการสลับตามวันอัตโนมัติ</p>
    <label>โหมดสำหรับใบงานใหม่<select disabled={busy} value={mode} onChange={e => { setMode(e.target.value); setConfirmed(false); setMessage(""); }}><option value={VAT_TRANSITION}>ชั่วคราว — ขอใบกำกับจึงบวก VAT / ไม่ขอให้บัญชีแยกเอง</option><option value={VAT_ALL_ORDERS}>บวก VAT ทุกใบงานใหม่ ไม่ขึ้นกับการขอเอกสาร</option></select></label>
    <p>การไม่บวกเพิ่มกับลูกค้าไม่ใช่การยกเว้นภาษี ใบงานจะเก็บสถานะให้ฝ่ายบัญชีแยกต่อ และไม่ใช้ยอดนี้แทนรายงานภาษี</p>
    {mode !== savedMode && <label className="vatPolicyConfirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy}/>ยืนยันเปลี่ยนยอดเรียกเก็บสำหรับใบงานใหม่ทันทีหลังบันทึก โดยไม่เปลี่ยนใบงานเก่า</label>}
    <button type="button" disabled={busy || mode === savedMode || !confirmed} onClick={save}>{busy ? "กำลังบันทึก…" : "บันทึกโหมด VAT"}</button>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
