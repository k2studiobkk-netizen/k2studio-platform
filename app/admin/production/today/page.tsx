import { env } from "cloudflare:workers";
import { can, requireStaff } from "../../../staff-auth";
import { hasPermission } from "../../../production-rbac";
import { bangkokToday, loadTodayDashboard } from "../../../production-dashboard-server";
import TodayDashboard from "./TodayDashboard";

export const dynamic = "force-dynamic";

export default async function JobTodayPage() {
  const user = await requireStaff("/admin/production/today");
  if (!hasPermission(user.role, "queue:manage")) return <main className="productionWorkspace"><p>หน้านี้สำหรับผู้จัดการหรือผู้ดูแลระบบ</p></main>;
  const database = (env as unknown as { DB: D1Database }).DB;
  const initialData = await loadTodayDashboard(database, bangkokToday());
  if (!can(user, "finance:view")) initialData.paymentAlerts = [];
  return <main className="todayDashboardPage">
    <header className="todayDashboardHeader">
      <a className="todayDashboardBrand" href="/admin"><img src="/assets/k2studio/k2studio-logo-reference-v1.png" alt="K2STUDIO"/><span><b>K2STUDIO</b><small>MANAGEMENT VIEW</small></span></a>
      <div><span>JOB TODAY</span><h1>งานที่ต้องส่งวันนี้</h1><p>ภาพรวมงานทุกฝ่ายสำหรับผู้บริหารและผู้จัดการร้าน</p></div>
      <nav aria-label="เมนู Job Today"><a href="/admin">ระบบหลังบ้าน</a><a href="/admin/production">การผลิต</a><a href="/admin/production/calendar">ปฏิทิน</a></nav>
    </header>
    <TodayDashboard initialData={initialData}/>
  </main>;
}
