import { env } from "cloudflare:workers";
import { audit, getStaffUser } from "../../../../../staff-auth";
import { publishBroadcastEvent } from "../../../../../broadcast-server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { id } = await params;
  const messageId = Number(id);
  const body = await request.json().catch(() => ({})) as { screenId?: string };
  const screenId = String(body.screenId || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
  if (!Number.isInteger(messageId) || messageId < 1) return Response.json({ error: "ข้อความไม่ถูกต้อง" }, { status: 400 });
  const database = (env as unknown as { DB: D1Database }).DB;
  const active = await database.prepare("SELECT id,priority FROM broadcast_messages WHERE id=? AND status='active' LIMIT 1").bind(messageId).first<{ id: number; priority: string }>();
  if (!active) return Response.json({ error: "ประกาศนี้สิ้นสุดแล้ว" }, { status: 409 });
  await database.prepare(`INSERT OR IGNORE INTO broadcast_acknowledgements (message_id,user_id,display_name,screen_id)
    VALUES (?,?,?,?)`).bind(messageId, user.id, user.displayName, screenId).run();
  const acknowledgedAt = new Date().toISOString();
  await publishBroadcastEvent({ type: "broadcast.acknowledged", messageId, displayName: user.displayName, acknowledgedAt });
  await audit(user, null, "รับทราบ Broadcast", `Message #${messageId} • ${screenId || "ไม่ระบุจอ"}`);
  return Response.json({ ok: true, acknowledgedAt });
}
