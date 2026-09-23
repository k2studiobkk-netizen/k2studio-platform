import { can, requireStaff } from "../../../staff-auth";
import { companyProfile } from "../../../company-profile";
import PartnerLab from "./PartnerLab";
import ManualPayoutPreview from "./ManualPayoutPreview";
import { referralProgramPolicy } from "../../../referral-program-policy.mjs";
import "../sales.css";
export const dynamic = "force-dynamic";
export default async function PartnerLabPage() {
  const user = await requireStaff("/admin/sales/lab");
  if (!can(user, "commission:manage")) return <main className="salesWorkspace"><h1>เฉพาะผู้มีสิทธิ์ตั้งค่าคอมมิชชั่น</h1><a href="/admin/sales">กลับหน้าการขาย</a></main>;
  return <main className="salesWorkspace">
    <header className="salesHeader"><div><a href="/admin/sales">← ภาพรวมการขาย</a><span className="salesEyebrow">PARTNER ECONOMICS / INTERNAL ONLY</span><h1>ทดลองก่อนกำหนดเรต</h1><p>เปรียบเทียบซื้อเองกับแนะนำลูกค้า และตรวจต้นทุนผลตอบแทนรวม</p></div></header>
    <p className="salesLabBanner">พื้นที่จำลองเท่านั้น ไม่บันทึกเป็นเรตจริง ไม่สร้างคะแนนหรือค่าคอม และไม่โอนเงิน บริษัทจะโอนค่าคอมเอง แผนผลตอบแทนหลายชั้นยังรอตรวจข้อกฎหมายและเงื่อนไขประกอบธุรกิจ</p>
    <section className="salesPanel salesProgramRules">
      <span className="salesEyebrow">REWARDS FROM REAL SALES</span><h2>{referralProgramPolicy.name}</h2>
      <p>ผลตอบแทนมาจากยอดขายสินค้าที่ตรวจสอบได้ ไม่ใช่เงินลงทุนหรือจำนวนคนสมัคร</p>
      <ul><li>สมัครและแนะนำให้สมัครอย่างเดียว ไม่เกิดค่าคอม</li><li>ไม่มีค่าสมัครซื้อสิทธิ์ ไม่บังคับซื้อสต็อก และไม่รับประกันรายได้</li><li>ซื้อเองได้ส่วนลด หรือแนะนำลูกค้าได้ค่าคอม — ไม่ให้ซ้ำในรายการเดียวกัน</li><li>พักยอดจนตรวจรับเงิน ส่งมอบ และผ่านเงื่อนไขคืนเงิน</li><li>จำลองได้สูงสุด 3 ชั้น โดยไม่เปิดจ่ายจริงก่อนตรวจแผน</li></ul>
      <p className="salesHelp">การโอนเองแยกจาก Omise แต่ไม่ได้ยกเว้นหน้าที่ตามกฎหมาย หากใช้ Omise รับเงินค่าสินค้า ยังต้องแจ้งรูปแบบธุรกิจตามจริงก่อนเปิดรับเงิน</p>
    </section>
    <PartnerLab/>
    <ManualPayoutPreview/>
    <section className="salesPanel salesCompany"><h2>ข้อมูลบริษัทสำหรับเตรียมระบบใหม่</h2><dl>
      <dt>นิติบุคคล</dt><dd>{companyProfile.legalName}</dd><dt>เลขผู้เสียภาษี</dt><dd>{companyProfile.taxId}</dd>
      <dt>สาขา</dt><dd>{companyProfile.branchName} ({companyProfile.branchCode})</dd><dt>ที่อยู่</dt><dd>{companyProfile.address}</dd>
      <dt>การแสดงราคา</dt><dd>ราคาก่อน VAT · บวก VAT แยกในสรุปยอดรวม</dd>
      <dt>การเรียกเก็บช่วงเปลี่ยนผ่าน</dt><dd>ขอใบกำกับ: บวก VAT / ไม่ขอ: ไม่บวกเพิ่ม ให้ฝ่ายบัญชีแยกต่อ</dd>
      <dt>การเปิดบวกทุกยอด</dt><dd>ผู้ดูแลกดเปิดเอง ไม่มีการเปลี่ยนตามวันอัตโนมัติ · <a href="/admin/sales-settings">ดูโหมดปัจจุบันและตั้งค่า VAT</a></dd>
    </dl><p className="salesHelp">การขอใบกำกับภาษีเต็มรูปแยกจากหน้าที่คำนวณ VAT สำหรับรายการที่ต้องเสียภาษี ตรวจเอกสารบริษัทเมื่อ {companyProfile.documentReviewedAt} โดยไม่เผยแพร่ไฟล์ต้นฉบับหรือแก้ยอดใบงานเก่า</p></section>
  </main>;
}
