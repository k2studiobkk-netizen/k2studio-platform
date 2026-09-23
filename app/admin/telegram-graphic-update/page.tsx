import { requireStaff } from "../../staff-auth";
import TelegramGraphicUpdateSender from "./TelegramGraphicUpdateSender";

export default async function TelegramGraphicUpdatePage() {
  const user = await requireStaff("/admin/telegram-graphic-update");
  if (!(user.role === "admin" || user.role === "production_manager")) {
    return <main className="staffLoginPage"><section><span>ACCESS DENIED</span><h1>ไม่มีสิทธิ์ส่งประกาศ</h1><p>เฉพาะผู้ดูแลระบบหรือผู้จัดการฝ่ายผลิต</p><a href="/admin">← กลับหน้าหลังบ้าน</a></section></main>;
  }
  return <TelegramGraphicUpdateSender />;
}
