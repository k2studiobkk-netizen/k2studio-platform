import { env } from "cloudflare:workers";
import { requireStaff } from "../../../staff-auth";
import { hasPermission } from "../../../production-rbac";
import BroadcastManager from "./BroadcastManager";

export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  const user = await requireStaff("/admin/production/broadcast");
  if (!hasPermission(user.role, "broadcast:send")) return <main className="productionWorkspace"><p>เฉพาะผู้จัดการฝ่ายผลิตหรือผู้ดูแลระบบเท่านั้นที่ส่งประกาศได้</p></main>;
  const database = (env as unknown as { DB: D1Database }).DB;
  const [screens, history] = await Promise.all([
    database.prepare("SELECT screen_key,name,department,last_seen_at FROM broadcast_screens WHERE active=1 ORDER BY department,name").all<Record<string, string>>(),
    database.prepare(`SELECT bm.*,COUNT(ba.id) AS acknowledgement_count,
      COALESCE(GROUP_CONCAT(ba.display_name || ' — ' || ba.acknowledged_at, ' • '),'') AS acknowledgement_details,
      CASE WHEN bm.status='active' AND bm.expire_at<>'' AND bm.expire_at<=CURRENT_TIMESTAMP THEN 'expired' ELSE bm.status END AS display_status
      FROM broadcast_messages bm LEFT JOIN broadcast_acknowledgements ba ON ba.message_id=bm.id
      GROUP BY bm.id ORDER BY bm.id DESC LIMIT 100`).all<Record<string, string | number>>(),
  ]);
  return <main className="productionWorkspace"><header className="productionWorkspaceHeader"><div><a href="/admin/production">← ศูนย์ควบคุมการผลิต</a><span>REAL-TIME FACTORY COMMUNICATION</span><h1>Live Broadcast</h1><p>ส่งประกาศไปยังจอ Production Dashboard แบบทันที</p></div><div><b>{user.displayName}</b><span>ผู้ส่งประกาศ</span></div></header><nav className="productionTabs"><a href="/admin/production">Dashboard</a><a href="/admin/production/today">Job Today</a><a href="/admin/production/calendar">Production Calendar</a><a className="active" href="/admin/production/broadcast">Live Broadcast</a><a href="/admin/production/tv?department=print_cut">Print & Cut TV</a><a href="/admin/production/tv?department=pack">Pack TV</a><a href="/admin/production/tv?department=sale">Sale TV</a></nav><BroadcastManager screens={screens.results as never} history={history.results as never} /></main>;
}
