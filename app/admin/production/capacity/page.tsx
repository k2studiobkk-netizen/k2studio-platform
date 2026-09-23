import { env } from "cloudflare:workers";
import { hasPermission } from "../../../production-rbac";
import { requireStaff } from "../../../staff-auth";
import CapacityManager from "./CapacityManager";

export const dynamic = "force-dynamic";

export default async function CapacityPage() {
  const user = await requireStaff("/admin/production/capacity");
  if (!hasPermission(user.role, "capacity:manage")) return <main className="productionWorkspace"><header className="productionWorkspaceHeader compact"><div><a href="/admin/production">← Production Dashboard</a><h1>Machines & Capacity</h1><p>คุณดูปฏิทินได้ แต่การตั้งค่า Capacity จำกัดเฉพาะผู้จัดการฝ่ายผลิตและผู้ดูแลระบบ</p></div></header></main>;
  const database = (env as unknown as { DB: D1Database }).DB;
  const [machines, processes, rules] = await Promise.all([
    database.prepare("SELECT * FROM machines WHERE active=1 ORDER BY name").all<Record<string, string | number>>(),
    database.prepare("SELECT * FROM production_processes WHERE active=1 ORDER BY sequence_no,name").all<Record<string, string | number>>(),
    database.prepare("SELECT pc.*,m.name AS machine_name,p.name AS process_name FROM production_capacity pc JOIN machines m ON m.id=pc.machine_id LEFT JOIN production_processes p ON p.id=pc.process_id WHERE pc.active=1 ORDER BY m.name,p.sequence_no").all<Record<string, string | number>>(),
  ]);
  return <main className="productionWorkspace"><header className="productionWorkspaceHeader compact"><div><a href="/admin/production">← Production Dashboard</a><span>FACTORY CONFIGURATION</span><h1>Machines & Capacity</h1><p>ตั้งเวลาทำงาน มาตรฐานกำลังผลิต และ Threshold ที่ใช้เตือนคิวเต็ม</p></div></header><nav className="productionTabs"><a href="/admin/production">Dashboard</a><a href="/admin/production/today">Job Today</a><a href="/admin/production/calendar">Production Calendar</a><a className="active" href="/admin/production/capacity">Machines & Capacity</a></nav><CapacityManager machines={machines.results} processes={processes.results} rules={rules.results} /></main>;
}
