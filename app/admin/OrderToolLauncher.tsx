"use client";

function openTool(id: string) {
  const tool = document.getElementById(id) as HTMLDetailsElement | null;
  if (!tool) return;
  tool.open = true;
  window.setTimeout(() => tool.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
}

export default function OrderToolLauncher({ outstanding, paidAmount, paymentEvidence }: { outstanding: number; paidAmount: number; paymentEvidence: boolean }) {
  return <div className="orderFocusActions">
    <button type="button" onClick={() => openTool("design-tools")}><span>GRAPHIC</span><b>ส่งแบบให้ลูกค้า</b></button>
    <button type="button" onClick={() => openTool("production-file-tools")}><span>PRODUCTION</span><b>เพิ่มไฟล์พร้อมผลิต</b></button>
    {outstanding > 0.009 || !paymentEvidence ? <button className="paymentDueAction" type="button" onClick={() => openTool("payment-tools")}><span>PAYMENT REQUIRED</span><b>{outstanding > 0.009 ? `${paidAmount > 0.009 ? "มัดจำแล้ว" : "ยังไม่ชำระ"} • แนบสลิปยอดค้าง ฿${outstanding.toLocaleString("th-TH", { minimumFractionDigits: 2 })}` : "แนบสลิปยืนยันยอดเดิม"}</b></button> : <button className="paymentSettledAction" type="button" onClick={() => openTool("payment-tools")}><span>PAYMENT</span><b>✓ ชำระเต็มจำนวน</b></button>}
  </div>;
}
