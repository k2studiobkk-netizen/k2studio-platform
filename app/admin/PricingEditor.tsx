"use client";

import { useMemo, useState } from "react";
import { calculateOrderTotals } from "../order-pricing.mjs";

type Item = {
  id: number;
  lineNo: number;
  name: string;
  specification: string;
  quantity: number;
  unitPrice: number;
};
type Extra = { id?: number; label: string; amount: number };

const money = (value: number) => new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value);

export default function PricingEditor({
  orderId,
  initialItems,
  initialExtras,
  initialDiscount,
  vatApplied,
  shippingFee,
}: {
  orderId: number;
  initialItems: Item[];
  initialExtras: Extra[];
  initialDiscount: number;
  vatApplied: boolean;
  shippingFee: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [extras, setExtras] = useState(initialExtras);
  const [discount, setDiscount] = useState(initialDiscount);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const totals = useMemo(
    () => calculateOrderTotals(
      items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice })),
      extras.map((extra) => extra.amount),
      discount,
      vatApplied,
      shippingFee,
    ),
    [items, extras, discount, vatApplied, shippingFee],
  );

  const updateItem = (id: number, unitPrice: number) => setItems((current) =>
    current.map((item) => item.id === id ? { ...item, unitPrice } : item),
  );
  const updateExtra = (index: number, key: "label" | "amount", value: string | number) =>
    setExtras((current) => current.map((extra, i) => i === index ? { ...extra, [key]: value } : extra));

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/pricing`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map(({ id, unitPrice }) => ({ id, unitPrice })),
          adjustments: extras,
          discountAmount: discount,
        }),
      });
      if (response.ok) {
        setMessage(`บันทึกราคาครบ ${items.length} รายการแล้ว ใบงานลูกค้าอัปเดตทันที`);
        location.reload();
      } else {
        const data = await response.json().catch(() => ({})) as { error?: string };
        setMessage(data.error || "บันทึกไม่สำเร็จ");
      }
    } catch {
      setMessage("เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return <div className="pricingEditor">
    <p className="pricingAdminNotice">
      แก้ราคาได้แยกทุกบรรทัด • ราคาที่แก้มีผลกับใบงานนี้เท่านั้น และระบบบันทึกชื่อผู้แก้ไข
    </p>
    <div className="pricingItemList">
      {items.map((item) => <article className="pricingItemRow" key={item.id}>
        <div className="pricingItemIdentity">
          <span>รายการ {item.lineNo}</span>
          <b>{item.name}</b>
          <small>{item.specification}</small>
        </div>
        <label>
          จำนวน
          <input aria-label={`จำนวนรายการ ${item.lineNo}`} value={item.quantity.toLocaleString()} readOnly />
        </label>
        <label>
          ราคาต่อหน่วย (บาท)
          <input
            aria-label={`ราคาต่อชิ้นรายการ ${item.lineNo}`}
            type="number"
            min="0"
            step="0.01"
            value={item.unitPrice}
            onChange={(event) => updateItem(item.id, Number(event.target.value))}
          />
        </label>
        <div className="pricingLineTotal">
          <span>รวมรายการ {item.lineNo}</span>
          <strong>฿{money(item.quantity * item.unitPrice)}</strong>
        </div>
      </article>)}
    </div>
    <div className="pricingExtras">
      <div className="pricingExtrasTitle">
        <b>รายการเสริม</b>
        <button type="button" onClick={() => setExtras((current) => [...current, { label: "", amount: 0 }])}>
          + เพิ่มรายการ
        </button>
      </div>
      {extras.length === 0 && <small>ยังไม่มีรายการเสริม</small>}
      {extras.map((extra, index) => <div className="pricingExtraRow" key={extra.id ?? `new-${index}`}>
        <input aria-label={`ชื่อรายการเสริม ${index + 1}`} placeholder="เช่น ค่าออกแบบ / แพ็กพิเศษ" value={extra.label} onChange={(event) => updateExtra(index, "label", event.target.value)} />
        <input aria-label={`ราคารายการเสริม ${index + 1}`} type="number" min="0" step="0.01" placeholder="ราคา" value={extra.amount} onChange={(event) => updateExtra(index, "amount", Number(event.target.value))} />
        <button type="button" aria-label={`ลบรายการเสริม ${index + 1}`} onClick={() => setExtras((current) => current.filter((_, i) => i !== index))}>ลบ</button>
      </div>)}
    </div>
    <label className="pricingDiscount">
      ส่วนลดทั้งใบงาน (บาท)
      <input type="number" min="0" max={totals.grossSubtotal} step="0.01" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} />
    </label>
    <dl className="pricingPreview">
      <div><dt>รวมสินค้าและอะไหล่</dt><dd>฿{money(totals.itemSubtotal)}</dd></div>
      <div><dt>รายการเสริม</dt><dd>฿{money(totals.adjustmentsTotal)}</dd></div>
      <div><dt>ส่วนลด</dt><dd>−฿{money(totals.discount)}</dd></div>
      <div><dt>ค่าจัดส่ง</dt><dd>฿{money(shippingFee)}</dd></div>
      <div><dt>ฐานภาษี (รวมค่าส่ง)</dt><dd>฿{money(totals.subtotal + shippingFee)}</dd></div>
      {vatApplied && <div><dt>VAT 7%</dt><dd>฿{money(totals.vatAmount)}</dd></div>}
      <div className="pricingGrand"><dt>ยอดสุทธิ</dt><dd>฿{money(totals.total + shippingFee)}</dd></div>
    </dl>
    <button className="pricingSave" type="button" onClick={save} disabled={saving}>
      {saving ? "กำลังบันทึก..." : `บันทึกราคาทั้ง ${items.length} รายการ`}
    </button>
    {message && <small className="pricingMessage">{message}</small>}
  </div>;
}
