import { requireStaff } from "../../staff-auth";
import TelegramFinanceUpdateSender from "./TelegramFinanceUpdateSender";

export default async function TelegramFinanceUpdatePage() {
  const user = await requireStaff("/admin/telegram-finance-update");
  if (user.role !== "admin") {
    return <main className="staffLoginPage"><section><span>ACCESS DENIED</span><h1>ไม่มีสิทธิ์ส่งประกาศ</h1><p>เฉพาะผู้ดูแลระบบ</p><a href="/admin">← กลับหน้าหลังบ้าน</a></section></main>;
  }
  return <TelegramFinanceUpdateSender />;
}
