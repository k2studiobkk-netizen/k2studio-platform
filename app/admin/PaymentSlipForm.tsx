"use client";

import { useState } from "react";

type Receipt = { id: number; amount: number; fileName: string; createdBy: string; createdAt: string };
export type SlipAnalysis = {
  receiptId: number | null;
  status: string;
  expectedAmount: number;
  detectedAmount: number | null;
  transactionDate: string;
  transactionTime: string;
  referenceNo: string;
  senderName: string;
  receiverName: string;
  confidence: string;
  note: string;
  errorMessage: string;
  updatedAt: string;
};

const money = (value: number) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

function AnalysisResult({ analysis }: { analysis?: SlipAnalysis }) {
  if (!analysis) return <div className="slipAnalysisCard empty"><b>ยังไม่ได้อ่านสลิปด้วย AI</b><span>กด “อ่านสลิป” เพื่อดึงยอดและข้อมูลการโอน</span></div>;
  const waiting = ["queued", "processing"].includes(analysis.status);
  const tone = analysis.status === "matched" ? "matched" : analysis.status === "mismatch" ? "mismatch" : waiting ? "reading" : "unreadable";
  const title = analysis.status === "matched" ? "✓ AI อ่านยอดตรงกับที่บันทึก" : analysis.status === "mismatch" ? "! ยอดในสลิปไม่ตรง" : waiting ? "กำลังอ่านสลิป…" : analysis.status === "error" ? "อ่านสลิปไม่สำเร็จ" : "อ่านยอดไม่ชัด กรุณาตรวจเอง";
  return <div className={`slipAnalysisCard ${tone}`} aria-live="polite">
    <b>{title}</b>
    {analysis.detectedAmount !== null && <strong>AI อ่านได้ ฿{money(analysis.detectedAmount)} <small>• ยอดที่กรอก ฿{money(analysis.expectedAmount)}</small></strong>}
    {(analysis.transactionDate || analysis.transactionTime) && <span>โอนเมื่อ {analysis.transactionDate || "-"} {analysis.transactionTime}</span>}
    {analysis.referenceNo && <span>เลขอ้างอิง {analysis.referenceNo}</span>}
    {analysis.senderName && <span>จาก {analysis.senderName}</span>}
    {analysis.receiverName && <span>ถึง {analysis.receiverName}</span>}
    {(analysis.note || analysis.errorMessage) && <small>{analysis.note || analysis.errorMessage}</small>}
    {!waiting && <em>AI ช่วยอ่านเบื้องต้น ทีมงานต้องเปิดสลิปตรวจซ้ำก่อนยืนยันการเงิน</em>}
  </div>;
}

export default function PaymentSlipForm({ orderId, totalAmount, paidAmount, hasLegacySlip, legacyAmount, receipts, analyses, canManage }: { orderId: number; totalAmount: number; paidAmount: number; hasLegacySlip: boolean; legacyAmount: number; receipts: Receipt[]; analyses: SlipAnalysis[]; canManage: boolean }) {
  const outstanding = Math.max(0, totalAmount - paidAmount);
  const paymentEvidence = hasLegacySlip || receipts.length > 0;
  const [amount, setAmount] = useState(outstanding);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const initialAnalysis = analyses.find(item => item.receiptId === null);
  const receiptAnalysis = (receiptId: number) => analyses.find(item => item.receiptId === receiptId);
  const recordedInstallments = receipts.length + (hasLegacySlip ? 1 : 0);
  const nextInstallment = recordedInstallments + 1;

  async function confirm() {
    if (!file) { setMessage("กรุณาแนบภาพสลิปของยอดที่รับครั้งนี้"); return; }
    const evidenceOnly = outstanding <= 0.009 && !paymentEvidence;
    if (!evidenceOnly && (!Number.isFinite(amount) || amount <= 0 || amount > outstanding + 0.009)) { setMessage("กรุณาตรวจสอบยอดที่รับครั้งนี้"); return; }
    setSaving(true); setMessage("");
    const data = new FormData(); data.set("payment_slip", file); data.set("amount", evidenceOnly ? "0" : String(amount));
    const response = await fetch(`/api/admin/orders/${orderId}/payment-slip`, { method: "POST", body: data });
    const result = await response.json().catch(() => ({})) as { error?: string; revenueRecordedToday?: number };
    setSaving(false);
    if (response.ok) {
      const recorded = Number(result.revenueRecordedToday || 0);
      setMessage(recorded > 0
        ? `บันทึกแล้ว • เพิ่มรายรับวันนี้ ฿${money(recorded)} • AI กำลังอ่านสลิป`
        : "บันทึกหลักฐานแล้ว • ไม่เพิ่มยอดรายรับซ้ำ • AI กำลังอ่านสลิป");
      window.setTimeout(() => window.location.reload(), 900);
    }
    else setMessage(result.error || "บันทึกไม่สำเร็จ");
  }

  async function analyze(receiptId: number | null) {
    const key = receiptId === null ? "initial" : String(receiptId);
    setReading(key); setMessage("");
    const response = await fetch(`/api/admin/orders/${orderId}/payment-slip/analyze`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ receiptId }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setMessage(result.error || "สั่งอ่านสลิปไม่สำเร็จ"); setReading(null); return; }
    setMessage("AI กำลังอ่านสลิป ใช้เวลาประมาณไม่กี่วินาที…");
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await wait(2500);
      const query = receiptId === null ? "" : `?receipt=${receiptId}`;
      const check = await fetch(`/api/admin/orders/${orderId}/payment-slip/analyze${query}`, { cache: "no-store" });
      if (!check.ok) continue;
      const data = await check.json() as { analysis?: { status?: string } };
      if (data.analysis?.status && !["queued", "processing"].includes(data.analysis.status)) { window.location.reload(); return; }
    }
    setReading(null); setMessage("ระบบยังอ่านสลิปอยู่ กรุณารีเฟรชหน้านี้อีกครั้ง");
  }

  return <div className="paymentSlipForm">
    <div className="paymentInstallmentIntro"><div><span>PAYMENT INSTALLMENTS</span><h3>แบ่งชำระได้หลายงวด</h3></div><b>{recordedInstallments} งวดที่บันทึกแล้ว</b></div>
    <div className={`paymentStateHeadline ${outstanding <= 0.009 && paymentEvidence ? "settled" : "due"}`}><span>สถานะการชำระเงิน</span><b>{outstanding <= 0.009 && paymentEvidence ? "✓ ชำระเต็มจำนวน" : paidAmount > 0.009 ? `มัดจำแล้ว • ค้าง ฿${money(outstanding)}` : `ยังไม่ชำระ • ค้าง ฿${money(outstanding)}`}</b></div>
    <div className={`paymentBalance ${outstanding <= 0 ? "settled" : "due"}`}><div><span>ยอดสุทธิ</span><b>฿{money(totalAmount)}</b></div><div><span>รับชำระแล้ว</span><b>฿{money(paidAmount)}</b></div><div><span>ยอดค้างชำระ</span><strong>฿{money(outstanding)}</strong></div></div>
    {canManage ? (outstanding > 0 ? <><div className="paymentGate pending"><b>ยังปิดงานไม่ได้</b><span>สามารถแบ่งชำระกี่งวดก็ได้ แต่ต้องแนบสลิปและรับชำระครบก่อนปิดงาน</span></div><label>ยอดชำระงวดที่ {nextInstallment} (บาท)<input type="number" min="0.01" max={outstanding} step="0.01" value={amount} onChange={event => setAmount(Number(event.target.value))}/></label><label>แนบสลิปงวดที่ {nextInstallment} *<input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onChange={event => setFile(event.target.files?.[0] || null)}/><small>กดเพื่อถ่ายรูปหรือเลือกรูปจากมือถือ • PNG, JPG หรือ WEBP • ไม่เกิน 8 MB</small></label><button type="button" onClick={confirm} disabled={saving || !file}>{saving ? "กำลังบันทึก…" : `บันทึกการชำระงวดที่ ${nextInstallment}`}</button></> : !paymentEvidence ? <><div className="paymentGate pending"><b>ยอดครบ แต่ยังไม่มีหลักฐาน</b><span>แนบสลิปประกอบยอดรับชำระเดิมก่อนปิดงาน</span></div><label>แนบสลิปยืนยันยอดเดิม *<input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onChange={event => setFile(event.target.files?.[0] || null)}/></label><button type="button" onClick={confirm} disabled={saving || !file}>{saving ? "กำลังบันทึก…" : "บันทึกหลักฐานและอ่านยอด"}</button></> : <div className="paymentGate verified"><b>✓ ชำระครบแล้ว</b><span>สามารถเปลี่ยนสถานะเป็นพร้อมส่ง ส่งแล้ว หรือเสร็จสมบูรณ์ได้</span></div>) : <div className="paymentGate viewOnly"><b>ดูข้อมูลการชำระได้อย่างเดียว</b><span>หากต้องเพิ่มยอดหรือแนบสลิป กรุณาให้ผู้มีสิทธิ์การเงินเป็นผู้บันทึก</span></div>}
    {(hasLegacySlip || receipts.length > 0) && <div className="paymentReceiptHistory"><h3>ประวัติการชำระทั้งหมด • {recordedInstallments} งวด</h3><ol>
      {hasLegacySlip && <li><div className="paymentReceiptMeta"><div><span className="installmentNumber">งวดที่ 1</span><b>฿{money(legacyAmount)}</b><small>ชำระตอนสร้างใบงาน</small></div><div className="paymentReceiptActions"><a href={`/api/admin/orders/${orderId}/payment-slip`} target="_blank" rel="noreferrer">ดูสลิป ↗</a><button className="reanalyzeSlip" type="button" onClick={() => void analyze(null)} disabled={reading === "initial"}>{reading === "initial" ? "กำลังอ่าน…" : "อ่านสลิป"}</button></div></div><AnalysisResult analysis={initialAnalysis}/></li>}
      {receipts.map((receipt, index) => <li key={receipt.id}><div className="paymentReceiptMeta"><div><span className="installmentNumber">งวดที่ {index + 1 + (hasLegacySlip ? 1 : 0)}</span><b>฿{money(receipt.amount)}</b><span>{receipt.fileName}</span><small>{receipt.createdAt} • {receipt.createdBy}</small></div><div className="paymentReceiptActions"><a href={`/api/admin/orders/${orderId}/payment-slip?receipt=${receipt.id}`} target="_blank" rel="noreferrer">ดูสลิป ↗</a><button className="reanalyzeSlip" type="button" onClick={() => void analyze(receipt.id)} disabled={reading === String(receipt.id)}>{reading === String(receipt.id) ? "กำลังอ่าน…" : "อ่านสลิป"}</button></div></div><AnalysisResult analysis={receiptAnalysis(receipt.id)}/></li>)}
    </ol></div>}
    {message && <small className="paymentMessage" role="status" aria-live="polite">{message}</small>}
  </div>;
}
