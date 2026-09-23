import { env } from "cloudflare:workers";
import { can, getStaffUser } from "../../../../staff-auth";
import { hasPermission } from "../../../../production-rbac";
import { bangkokToday, loadTodayDashboard } from "../../../../production-dashboard-server";

export async function GET() {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!hasPermission(user.role, "queue:manage")) return Response.json({ error: "เฉพาะผู้จัดการหรือผู้ดูแลระบบ" }, { status: 403 });
  const database = (env as unknown as { DB: D1Database }).DB;
  const payload = await loadTodayDashboard(database, bangkokToday());
  if (!can(user, "finance:view")) payload.paymentAlerts = [];
  return Response.json(payload, { headers: { "cache-control": "no-store, max-age=0" } });
}
