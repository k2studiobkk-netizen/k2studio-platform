import { env } from "cloudflare:workers";
import { redirect } from "next/navigation";
import { requireStaff } from "../../../staff-auth";
import { hasPermission } from "../../../production-rbac";
import { broadcastRowToMessage } from "../../../broadcast-server";
import { bangkokToday, loadProductionDashboard } from "../../../production-dashboard-server";
import { dashboardDepartments, type DashboardDepartment } from "../../../production-dashboard-types";
import DepartmentDashboard from "./DepartmentDashboard";
import LiveBroadcastDisplay from "./LiveBroadcastDisplay";

export const dynamic = "force-dynamic";

const labels: Record<DashboardDepartment, { eyebrow: string; title: string; screen: string }> = {
  print_cut: { eyebrow: "PRINT & CUT", title: "งานรอผลิต", screen: "print-cut-main" },
  pack: { eyebrow: "PACK", title: "งานรอแพ็ก", screen: "pack-main" },
  sale: { eyebrow: "SALE", title: "แนะนำวันลงคิว", screen: "sale-main" },
};

const departmentAliases: Record<string, DashboardDepartment> = {
  production: "print_cut",
  print: "print_cut",
  printcut: "print_cut",
  "print-cut": "print_cut",
  packing: "pack",
  sales: "sale",
};

export default async function ProductionTv({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const requestedValue = Array.isArray(query.department) ? query.department[0] : query.department;
  const requested = String(requestedValue || "").trim().toLowerCase();
  const department: DashboardDepartment = dashboardDepartments.includes(requested as DashboardDepartment)
    ? requested as DashboardDepartment
    : departmentAliases[requested] || "print_cut";
  const screenParam = Array.isArray(query.screen) ? query.screen[0] : query.screen;
  const screenId = String(screenParam || labels[department].screen).replace(/[^a-z0-9_-]/gi, "").slice(0, 80) || labels[department].screen;
  const canonicalParams = new URLSearchParams({ department });
  if (screenParam) canonicalParams.set("screen", screenId);
  const canonicalReturnTo = `/admin/production/tv?${canonicalParams.toString()}`;
  const user = await requireStaff(canonicalReturnTo);
  if (!hasPermission(user.role, "calendar:view")) return <main><p>บัญชีนี้ไม่มีสิทธิ์เปิดจอ Production</p></main>;
  if (!requestedValue || requested !== department || (screenParam && String(screenParam) !== screenId)) redirect(canonicalReturnTo);
  const database = (env as unknown as { DB: D1Database }).DB;
  const today = bangkokToday();
  const [broadcasts, initialData] = await Promise.all([
    database.prepare(`SELECT * FROM broadcast_messages bm WHERE status='active' AND (expire_at='' OR expire_at>CURRENT_TIMESTAMP)
      AND (target_scope='all' OR (target_scope='department' AND target_department=?) OR (target_scope='screen' AND target_screen=?))
      AND NOT EXISTS (SELECT 1 FROM broadcast_acknowledgements ba WHERE ba.message_id=bm.id AND ba.user_id=? AND ba.screen_id=?)
      ORDER BY CASE priority WHEN 'critical' THEN 4 WHEN 'urgent' THEN 3 WHEN 'important' THEN 2 ELSE 1 END DESC,id DESC`).bind(department, screenId, user.id, screenId).all<Record<string, string | number>>(),
    loadProductionDashboard(database, department, today),
  ]);
  return <main className={`productionTv departmentTv k2OpsShell ${department}`}>
    <nav className="k2OpsScreenTabs" aria-label="เลือกจอแผนก"><a className={department === "print_cut" ? "active" : ""} href="/admin/production/tv?department=print_cut">Print &amp; Cut</a><a className={department === "pack" ? "active" : ""} href="/admin/production/tv?department=pack">Pack</a><a className={department === "sale" ? "active" : ""} href="/admin/production/tv?department=sale">Sale</a></nav>
    <span className="k2OpsPageSize">แสดง 9 งานต่อหน้า</span>
    <DepartmentDashboard initialData={initialData} canUpdate canManage={hasPermission(user.role, "queue:manage")} />
    <LiveBroadcastDisplay initialMessages={broadcasts.results.map(broadcastRowToMessage)} screenId={screenId} department={department} displayName={user.displayName} />
  </main>;
}
