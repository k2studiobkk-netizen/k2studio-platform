import { env } from "cloudflare:workers";
import { getStaffUser } from "../../../../staff-auth";
import { hasPermission } from "../../../../production-rbac";
import { dashboardDepartments, type DashboardDepartment } from "../../../../production-dashboard-types";
import { bangkokToday, loadProductionDashboard } from "../../../../production-dashboard-server";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!hasPermission(user.role, "calendar:view")) return Response.json({ error: "บัญชีนี้ไม่มีสิทธิ์ดูคิวผลิต" }, { status: 403 });
  const url = new URL(request.url);
  const requestedDepartment = String(url.searchParams.get("department") || "print_cut");
  const department: DashboardDepartment = dashboardDepartments.includes(requestedDepartment as DashboardDepartment) ? requestedDepartment as DashboardDepartment : "print_cut";
  const requestedDate = String(url.searchParams.get("date") || "");
  const date = datePattern.test(requestedDate) ? requestedDate : bangkokToday();
  const database = (env as unknown as { DB: D1Database }).DB;
  const payload = await loadProductionDashboard(database, department, date);
  return Response.json(payload, { headers: { "cache-control": "no-store, max-age=0" } });
}

