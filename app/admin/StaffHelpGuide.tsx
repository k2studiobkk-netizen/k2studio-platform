"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

type Guide = { label: string; intro: string; steps: string[]; note?: string };

const guides: Array<{ match: (path: string) => boolean; guide: Guide }> = [
  { match: path => path === "/admin", guide: { label: "ภาพรวมงาน", intro: "ใช้หน้านี้ดูใบงานทั้งหมดและงานที่ต้องติดตาม", steps: ["ค้นหาใบงานจากเลข K2-xxxx", "กด “ดูใบงาน” เพื่อแก้ไขข้อมูลหรืออัปเดตสถานะ", "ตรวจงานกราฟิก ยอดค้าง และงานส่งวันนี้จากการ์ดด้านบน"], note: "ถ้าไม่แน่ใจ ให้เปิดใบงานจากรายการล่าสุดก่อน" } },
  { match: path => path === "/admin/orders/new", guide: { label: "สร้างใบงาน", intro: "บันทึกข้อมูลลูกค้า สินค้า และการชำระเงินให้ครบในครั้งเดียว", steps: ["กรอกข้อมูลลูกค้าและรายการสินค้า", "เลือกสถานะการชำระเงิน แล้วแนบสลิปถ้ามี", "กดสร้างใบงาน จากนั้นคัดลอกลิงก์ติดตามส่งให้ลูกค้า"], note: "ตรวจชื่อ เบอร์โทร วันส่ง และยอดรวมก่อนกดสร้าง" } },
  { match: path => /^\/admin\/orders\/\d+/.test(path), guide: { label: "จัดการใบงาน", intro: "หน้านี้เป็นศูนย์กลางของใบงานหนึ่งใบ", steps: ["ดูข้อมูลสินค้าและภาพอาร์ตเวิร์กที่จับคู่กับรายการ", "เลื่อนขึ้นไปใช้ปุ่มเปลี่ยนสถานะหรืออัปโหลดรูปตามขั้นตอน", "ตรวจการเงิน สลิปงวดถัดไป และเลขพัสดุก่อนปิดงาน"], note: "การอัปเดตทุกครั้งจะเชื่อมกับปฏิทินและจอฝ่ายผลิตอัตโนมัติ" } },
  { match: path => path === "/admin/shipments", guide: { label: "เลขพัสดุ / Order Plus", intro: "นำเข้าเลขพัสดุจาก Excel หรือเพิ่มทีละรายการ", steps: ["เลือก Excel หรือวางข้อความจาก Order Plus", "ตรวจว่ารหัสใบงานเป็น K2-xxxx และเลขพัสดุถูกต้อง", "เลือกเฉพาะรายการที่พร้อม แล้วกดยืนยันบันทึก"], note: "ระบบจะไม่เปลี่ยนสถานะงานหรือยอดเงินจากการเพิ่มเลขพัสดุ" } },
  { match: path => path.includes("/production/calendar"), guide: { label: "Production Calendar", intro: "ดูช่วงเวลาผลิตตั้งแต่วันเริ่มงานจนถึงวันส่ง", steps: ["ดูแถบช่วงผลิตและวันที่ส่งของแต่ละใบงาน", "กดใบงานเพื่อเปิดรายละเอียดและจัดคิว", "ใช้งานส่งวันนี้เพื่อโฟกัสงานที่ต้องเสร็จวันนี้"], note: "ปฏิทินใช้วันส่งที่ยืนยันในใบงานเป็นข้อมูลหลัก" } },
  { match: path => path.includes("/production/today"), guide: { label: "Job Today", intro: "รวมงานที่ต้องส่งวันนี้สำหรับผู้จัดการและทีมงาน", steps: ["เปิดการ์ดเพื่อดูข้อมูลสำคัญของใบงาน", "งานด่วนจะมีกรอบเตือนให้จัดลำดับก่อน", "กดเข้าใบงานเพื่ออัปเดตสถานะหรือดูภาพ"], note: "หน้านี้เหมาะสำหรับเปิดค้างบนจอผู้จัดการ" } },
  { match: path => path.includes("/production/tv"), guide: { label: "จอฝ่ายผลิต", intro: "จอ Read-only สำหรับดูคิวของแต่ละแผนก", steps: ["เลือกแผนก Print & Cut, Pack หรือ Sale", "ดูงานรอผลิตและงานที่กำลังทำตามลำดับคิว", "กดใบงานเมื่อจำเป็นเพื่อเปิดรายละเอียดเพิ่มเติม"], note: "สถานะจะเปลี่ยนตามการอัปเดตจากใบงาน ไม่ต้องรีเฟรชเอง" } },
  { match: path => path.includes("/production/broadcast"), guide: { label: "Live Broadcast", intro: "ส่งประกาศไปยังจอฝ่ายผลิตแบบทันที", steps: ["เขียนหัวข้อและข้อความให้สั้น ชัดเจน", "เลือกความสำคัญ รูปแบบการแสดง และกลุ่มจอ", "ตั้งเวลาหมดอายุ แล้วกดส่งประกาศ"], note: "ข้อความ Critical ใช้เฉพาะเหตุจำเป็น เพราะจะแสดงทับเต็มจอ" } },
  { match: path => path.includes("/production/capacity"), guide: { label: "Machines & Capacity", intro: "ตั้งค่ากำลังผลิตเพื่อให้ปฏิทินเตือนคิวแน่น", steps: ["ตรวจเครื่องจักรและเวลาทำงาน", "ตั้งกำลังผลิตมาตรฐานของแต่ละกระบวนการ", "บันทึกแล้วตรวจผลบนปฏิทิน"], note: "แก้ไขหน้านี้เฉพาะผู้จัดการฝ่ายผลิตหรือแอดมิน" } },
  { match: path => path === "/admin/pricing", guide: { label: "ตารางราคา", intro: "จัดการราคาสินค้าและเรตราคาตามจำนวน", steps: ["เลือกสินค้าที่ต้องการแก้ไข", "กรอกช่วงจำนวนและราคาต่อชิ้น", "บันทึกแล้วทดลองคำนวณจากหน้าใบสั่งซื้อ"], note: "อย่าใส่ข้อมูลตัวอย่างในช่องราคา เพราะราคาจะถูกใช้คำนวณจริง" } },
  { match: path => path === "/admin/sales-settings", guide: { label: "การขายและคอมมิชชั่น", intro: "จัดการช่องทางการขาย เพจ และเรตคอมมิชชั่น", steps: ["เพิ่มหรือเปิดใช้ช่องทางขาย", "กำหนดเรตคอมมิชชั่นตามยอด", "ตรวจชื่อเซลล์และช่องทางบนใบงานก่อนสรุปยอด"], note: "การเปลี่ยนเรตมีผลกับการคำนวณรายงานหลังจากบันทึก" } },
  { match: path => path === "/admin/users", guide: { label: "ผู้ใช้งานและสิทธิ์", intro: "จัดทีมงานและสิทธิ์การเข้าถึงระบบ", steps: ["สร้างหรือเลือกบัญชีพนักงาน", "กำหนดทีมงานได้มากกว่าหนึ่งทีม", "บันทึกแล้วให้พนักงานออกเข้าใหม่เพื่อโหลดสิทธิ์ล่าสุด"], note: "ให้สิทธิ์การเงินและการแก้ไขเฉพาะคนที่จำเป็น" } },
];

const fallback: Guide = { label: "การใช้งานหน้านี้", intro: "ใช้ข้อมูลบนหน้านี้เพื่อทำงานตามขั้นตอนของทีม", steps: ["อ่านหัวข้อและสถานะก่อนเริ่มแก้ไข", "ใช้ปุ่มหลักที่มีสีเด่นเพื่อทำงานต่อ", "ตรวจข้อความสำเร็จหรือข้อผิดพลาดหลังบันทึก"], note: "หากไม่แน่ใจ ให้กลับไปที่ภาพรวมงานหรือใช้ผู้ช่วย K2" };

export default function StaffHelpGuide() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (!pathname.startsWith("/admin") || pathname === "/admin/login") return null;
  const guide = guides.find(item => item.match(pathname))?.guide ?? fallback;
  return <div className={`staffHelpGuide${open ? " open" : ""}`}>
    {open && <section className="staffHelpPanel" aria-label={`วิธีใช้${guide.label}`}>
      <header><div><span>QUICK GUIDE</span><strong>{guide.label}</strong><p>{guide.intro}</p></div><button type="button" aria-label="ปิดคำแนะนำ" onClick={() => setOpen(false)}>×</button></header>
      <ol>{guide.steps.map(step => <li key={step}>{step}</li>)}</ol>
      {guide.note && <p className="staffHelpNote">เคล็ดลับ: {guide.note}</p>}
      <a href="/admin">กลับภาพรวมงาน</a>
    </section>}
    <button className="staffHelpLauncher" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}><span>?</span><b>{open ? "ปิดคำแนะนำ" : "วิธีใช้หน้านี้"}</b></button>
  </div>;
}
