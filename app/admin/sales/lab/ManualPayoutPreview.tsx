"use client";
import { useState } from "react";
import { manualPayoutPreview } from "../../../referral-program-policy.mjs";

const money = (amount: number) => (amount / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function ManualPayoutPreview() {
  const [gross, setGross] = useState(""), [tax, setTax] = useState(""), [fee, setFee] = useState("");
  let result: ReturnType<typeof manualPayoutPreview> | null = null, error = "";
  if ([gross, tax, fee].every(value => value.trim())) {
    try {
      const satang = (value: string) => {
        if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("กรอกจำนวนเงินไม่ติดลบและทศนิยมไม่เกิน 2 ตำแหน่ง");
        return Math.round(Number(value) * 100);
      };
      result = manualPayoutPreview({ grossSatang: satang(gross), withholdingSatang: satang(tax), memberFeeSatang: satang(fee) });
    } catch (e) { error = e instanceof Error ? e.message : "ตรวจจำนวนเงินอีกครั้ง"; }
  }
  return <section className="salesPanel salesCompany">
    <span className="salesEyebrow">MANUAL PAYOUT / PREVIEW ONLY</span>
    <h2>บริษัทโอนค่าคอมเอง</h2>
    <p className="salesHelp">เครื่องคำนวณตัวอย่าง ไม่แสดงยอดกระเป๋าจริง ไม่สร้างคำขอถอน และไม่มีการเชื่อมโอนผ่าน Omise</p>
    <ol className="salesPolicySteps"><li>สมาชิกขอถอน</li><li>ฝ่ายการเงินตรวจยอดและกันเงิน</li><li>บริษัทโอนผ่านธนาคาร</li><li>ตรวจหลักฐานและบันทึกผู้โอน</li></ol>
    <div className="salesLabInputs">
      <label className="salesField">ยอดขอถอนก่อนหัก (บาท)<input type="number" inputMode="decimal" min="100" max="10000000" step="0.01" value={gross} onChange={e => setGross(e.target.value)}/></label>
      <label className="salesField">ภาษีหัก ณ ที่จ่ายที่บัญชีคำนวณ (บาท)<input type="number" inputMode="decimal" min="0" max="10000000" step="0.01" value={tax} onChange={e => setTax(e.target.value)}/></label>
      <label className="salesField">ค่าธรรมเนียมที่สมาชิกตกลงรับภาระ (บาท)<input type="number" inputMode="decimal" min="0" max="10000000" step="0.01" value={fee} onChange={e => setFee(e.target.value)}/></label>
    </div>
    <p className="salesHelp">กรอก 0 ถ้าไม่มีรายการหัก ไม่ตั้งภาษีเป็น 3% เหมือนกันทุกคน ต้องให้บัญชีตรวจประเภทผู้รับและเงินได้ก่อน</p>
    <div aria-live="polite">{error ? <p role="alert">{error}</p> : result ? <div className="salesLabTotal"><span>ยอดโอนสุทธิตัวอย่าง</span><strong>฿{money(result.netTransferSatang)}</strong><p>ค่าคอม ฿{money(result.grossSatang)} − ภาษี ฿{money(result.withholdingSatang)} − ค่าธรรมเนียม ฿{money(result.memberFeeSatang)}</p></div> : <p className="salesEmpty">กรอกครบ 3 ช่องเพื่อดูยอดสุทธิ</p>}</div>
    <p className="salesHelp">ระบบจริงต้องป้องกันถอนซ้ำและยอดติดลบ เก็บเลขอ้างอิงธนาคาร หลักฐาน วันเวลา และประวัติผู้อนุมัติ การแนบสลิปอย่างเดียวไม่ยืนยันว่าผู้รับได้เงินแล้ว</p>
  </section>;
}
