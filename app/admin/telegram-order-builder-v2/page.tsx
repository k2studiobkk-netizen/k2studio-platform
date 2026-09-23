import { requireStaff } from "../../staff-auth";
import TelegramOrderBuilderUpdateSender from "./TelegramOrderBuilderUpdateSender";

export default async function TelegramOrderBuilderUpdatePage() {
  const user = await requireStaff("/admin/telegram-order-builder-v2");
  if (!(user.role === "admin" || user.role === "production_manager")) {
    return <main className="staffLoginPage"><section><span>ACCESS DENIED</span><h1>ไม่มีสิทธิ์ส่งประกาศ</h1><p>เฉพาะผู้ดูแลระบบหรือผู้จัดการฝ่ายผลิต</p><a href="/admin">← กลับหน้าหลังบ้าน</a></section></main>;
  }
  return <TelegramOrderBuilderUpdateSender />;
}
