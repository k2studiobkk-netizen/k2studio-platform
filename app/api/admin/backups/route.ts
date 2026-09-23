import { env, waitUntil } from "cloudflare:workers";
import { runDailyBackup } from "../../../daily-backup";
import { getStaffUser } from "../../../staff-auth";

export async function GET() {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const runtime = env as unknown as { DB: D1Database };
  const latest = await runtime.DB.prepare("SELECT * FROM backup_runs ORDER BY started_at DESC,id DESC LIMIT 1").first();
  return Response.json({ latest });
}

export async function POST() {
  const user = await getStaffUser();
  if (!user || user.role !== "admin") return Response.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 403 });
  waitUntil(runDailyBackup(env as never).catch((error) => console.error(JSON.stringify({ event: "manual_backup_failed", error: String(error) }))));
  return Response.json({ ok: true, message: "เริ่มสำรองข้อมูลแล้ว" }, { status: 202 });
}
