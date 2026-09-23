import { env } from "cloudflare:workers";
import { audit, getStaffUser } from "../../../../../staff-auth";
import { hasPermission } from "../../../../../production-rbac";
import { publishBroadcastEvent } from "../../../../../broadcast-server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!hasPermission(user.role, "broadcast:send")) return Response.json({ error: "ไม่มีสิทธิ์ปิดประกาศ" }, { status: 403 });
  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isInteger(messageId) || messageId < 1) return Response.json({ error: "ข้อความไม่ถูกต้อง" }, { status: 400 });
  const database = (env as unknown as { DB: D1Database }).DB;
  const result = await database.prepare("UPDATE broadcast_messages SET status='closed',closed_at=CURRENT_TIMESTAMP,closed_by=? WHERE id=? AND status='active'").bind(user.id, messageId).run();
  if (!result.meta.changes) return Response.json({ error: "ประกาศนี้สิ้นสุดแล้ว" }, { status: 409 });
  await publishBroadcastEvent({ type: "broadcast.closed", messageId });
  await audit(user, null, "ปิด Broadcast Message", `Message #${messageId}`);
  return Response.json({ ok: true });
}
