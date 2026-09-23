"use client";
import { useState } from "react";
import { simulatePartnerEconomics, quoteProposedShipping } from "../../../commerce-policy.mjs";
const money = (satang: number) => (satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fields = [
  ["revenue", "ยอดสินค้าอ้างอิงก่อน VAT / ค่าส่ง", "บาท"], ["cost", "ต้นทุนผลิตรวม", "บาท"],
  ["shipping", "ค่าส่งที่ร้านช่วยออก", "บาท"], ["fee", "ค่ารับชำระและค่าโอนที่ร้านรับภาระ", "บาท"],
  ["partner", "ส่วนลดซื้อเอง / คอมผู้แนะนำโดยตรง", "%"], ["employee", "ค่าคอมเซลล์บริษัท", "%"],
  ["level2", "ผู้แนะนำชั้นที่ 2 (ทดลอง)", "%"], ["level3", "ผู้แนะนำชั้นที่ 3 (ทดลอง)", "%"],
  ["points", "ต้นทุนสำรองคะแนนแลกรางวัล", "บาท"], ["bonus", "ต้นทุนสำรองเงินพิเศษตามเป้า", "บาท"],
  ["margin", "กำไรส่วนเกินขั้นต่ำที่ต้องการ", "%"],
] as const;
type Field = typeof fields[number][0];
export default function PartnerLab() {
  const [values, setValues] = useState<Record<Field, string>>(() => Object.fromEntries(fields.map(([key]) => [key, ""])) as Record<Field, string>);
  const [route, setRoute] = useState("self_order");
  const [quantity, setQuantity] = useState("");
  const complete = fields.every(([key]) => values[key].trim() !== "");
  let result: ReturnType<typeof simulatePartnerEconomics> | null = null, error = "";
  if (complete) try {
    const n = (key: Field) => { const num = Number(values[key]); if (!Number.isFinite(num) || num < 0) throw new Error("กรอกตัวเลขตั้งแต่ศูนย์ขึ้นไป"); return Math.round(num * 100); };
    result = simulatePartnerEconomics({ route, revenueSatang: n("revenue"), productionCostSatang: n("cost"), shippingSubsidySatang: n("shipping"), paymentFeeSatang: n("fee"),
      partnerRateBps: n("partner"), employeeRateBps: n("employee"), upstreamRatesBps: [n("level2"), n("level3")], pointsReserveSatang: n("points"), bonusReserveSatang: n("bonus"), minMarginBps: n("margin") });
  } catch (e) { error = e instanceof Error ? e.message : "ข้อมูลไม่ถูกต้อง"; }
  let shipping: ReturnType<typeof quoteProposedShipping> | null = null;
  if (Number.isSafeInteger(Number(quantity)) && Number(quantity) > 0 && Number(quantity) <= 1_000_000) shipping = quoteProposedShipping([{ productType: "acrylic_keychain", quantity: Number(quantity) }]);
  return <><div className="salesLabGrid"><section className="salesPanel"><h2>ใส่ต้นทุนและเรตที่อยากลอง</h2><p className="salesHelp">ไม่มีเรตตัวอย่างตั้งให้ล่วงหน้า กรอก 0 ในรายการที่ไม่มีต้นทุน ใช้ฐานยอดสินค้าเดียวกันเพื่อเปรียบเทียบสองช่องทางอย่างเป็นธรรม</p><label className="salesField">ช่องทาง<select value={route} onChange={e => setRoute(e.target.value)}><option value="self_order">ตัวแทนซื้อเอง — ลดราคาทันที</option><option value="referral_order">ลูกค้าซื้อผ่านผู้แนะนำ — รับค่าคอม</option></select></label><div className="salesLabInputs">{fields.map(([key, label, unit]) => <label className="salesField" key={key}>{label} ({unit})<input type="number" min="0" max={unit === "%" ? "100" : "10000000"} step="0.01" value={values[key]} onChange={e => setValues(current => ({ ...current, [key]: e.target.value }))}/></label>)}</div></section><section className="salesPanel"><h2>ผลจำลองต่อคำสั่งซื้อ</h2><div aria-live="polite">{error ? <p role="alert">{error}</p> : result ? <><div className="salesLabResult"><span>{route === "self_order" ? "ส่วนลดตัวแทน (ไม่จ่ายคอมซ้ำ)" : "ค่าคอมผู้แนะนำโดยตรง"}</span><b>฿{money(result.partnerBenefitSatang)}</b></div><div className="salesLabResult"><span>เซลล์บริษัท</span><b>฿{money(result.employeeSatang)}</b></div>{result.upstreamSatang.map((amount: number, index: number) => <div className="salesLabResult" key={index}><span>ผู้แนะนำชั้นที่ {index + 2} · จำลอง</span><b>฿{money(amount)}</b></div>)}<div className="salesLabResult"><span>ผลตอบแทนรวม + สำรองคะแนน/โบนัส</span><b>฿{money(result.benefitSatang)}</b></div><div className={`salesLabTotal ${result.passesMargin ? "" : "negative"}`}><span>เหลือหลังต้นทุนที่กรอก</span><strong>฿{money(result.contributionSatang)}</strong><p>{(result.marginBps / 100).toFixed(2)}% · {result.passesMargin ? "ผ่านเป้าหมายจำลอง" : "ต่ำกว่าเป้าหมาย ควรลดผลตอบแทนหรือปรับราคา"}</p></div><p className="salesHelp">ไม่ใช่กำไรสุทธิทางบัญชี ยังต้องเผื่อค่าใช้จ่ายคงที่ งานเสีย การคืนเงิน และภาษีที่เกี่ยวข้อง ผลผ่านเป้าหมายไม่ได้แปลว่ารูปแบบธุรกิจผ่านการอนุมัติ</p></> : <p className="salesEmpty">กรอกข้อมูลครบทุกช่องเพื่อคำนวณ ยังไม่แสดงกำไรจากต้นทุนที่ขาดหาย</p>}</div><details><summary>กติกาที่ต้องยืนยันก่อนเปิดใช้จริง</summary><p>ไม่มีค่าตอบแทนจากการสมัคร ไม่มีค่าสมัครซื้อสิทธิ์ ไม่มีการบังคับซื้อสะสมสินค้า ไม่มีรายได้ที่รับประกัน ต้องเกิดการขายจริงและผ่านเงื่อนไขยกเลิก/คืนเงินก่อนจ่าย บริษัทโอนค่าคอมเอง ไม่ใช้ Omise จ่ายค่าคอม การจ่ายหลายชั้นต้องตรวจแผนและหน้าที่จดทะเบียนกับ สคบ. หรือผู้เชี่ยวชาญก่อน ส่วน Omise เกี่ยวข้องเฉพาะการรับเงินค่าสินค้าหากนำมาใช้</p></details><a href="/admin/sales-settings">ดูเรตเซลล์ที่มีอยู่ในระบบ</a></section></div><section className="salesPanel salesCompany"><h2>ทดลองค่าส่งพวงกุญแจ</h2><p>ร่างเรตตามจำนวน สำหรับส่งรวมหนึ่งที่อยู่ ยังไม่เปลี่ยนค่าจัดส่งในใบงานจริง</p><label className="salesField">จำนวนรวมทุกแบบ<input type="number" min="1" max="1000000" step="1" value={quantity} onChange={e => setQuantity(e.target.value)}/></label>{shipping && <p role="status">{shipping.feeSatang === null ? shipping.reason : `ค่าส่งเสนอ ฿${money(shipping.feeSatang)}`}</p>}<p className="salesHelp">1–100 ชิ้น 50 บาท · 101–300 ชิ้น 70 บาท · 301–500 ชิ้น 100 บาท · 501–1,000 ชิ้น 150 บาท · สินค้าอื่น/แบบผสม/มากกว่า 1,000 ชิ้นยังต้องกำหนดเรต</p></section></>;
}
