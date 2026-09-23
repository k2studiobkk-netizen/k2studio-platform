"use client";

import { useState } from "react";

const money = (value: number) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export default function FinancialForm({ orderId, orderSubtotal, vatApplied, initialShipping, initialPaid }: { orderId: number; orderSubtotal: number; vatApplied: boolean; initialShipping: number; initialPaid: number }) {
  const [shipping, setShipping] = useState(initialShipping);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const safeShipping = Math.max(0, shipping || 0);
  const vatAmount = vatApplied ? Math.round((orderSubtotal + safeShipping) * 7) / 100 : 0;
  const payable = orderSubtotal + vatAmount + safeShipping;
  const outstanding = Math.max(0, payable - Math.max(0, initialPaid || 0));
  async function save() {
    setSaving(true); setMessage("");
    const response = await fetch(`/api/admin/orders/${orderId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ shippingFee: shipping }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false); setMessage(response.ok ? "บันทึกค่าจัดส่งแล้ว" : result.error || "บันทึกไม่สำเร็จ");
    if (response.ok) window.location.reload();
  }
  return <div className="financialForm"><label>ค่าจัดส่ง (บาท)<input type="number" min="0" step="0.01" value={shipping} onChange={event => setShipping(Number(event.target.value))}/></label><p className="financialPaidNotice">ยอดที่รับชำระแล้ว <b>฿{money(initialPaid)}</b><br/><small>ยอดรับชำระแก้ไขได้โดยแนบสลิปงวดใหม่เท่านั้น เพื่อให้ตรวจสอบย้อนหลังได้</small></p><dl><div><dt>ฐานภาษี (สินค้า + อะไหล่ + รายการเสริม + ค่าส่ง − ส่วนลด)</dt><dd>฿{money(orderSubtotal + safeShipping)}</dd></div>{vatApplied && <div><dt>VAT 7%</dt><dd>฿{money(vatAmount)}</dd></div>}<div><dt>ยอดสุทธิ</dt><dd>฿{money(payable)}</dd></div><div><dt>ยอดค้างชำระ</dt><dd>฿{money(outstanding)}</dd></div></dl><button type="button" onClick={save} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกค่าจัดส่ง"}</button>{message && <small>{message}</small>}</div>;
}
