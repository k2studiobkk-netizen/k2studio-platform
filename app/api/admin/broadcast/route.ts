import { env } from "cloudflare:workers";
import { audit, getStaffUser } from "../../../staff-auth";
import { hasPermission } from "../../../production-rbac";
import { broadcastDepartments, broadcastDisplayModes, broadcastPriorities } from "../../../broadcast-types";
import { broadcastRowToMessage, publishBroadcastEvent } from "../../../broadcast-server";

const sqliteDateTime = (date: Date) => date.toISOString().replace("T", " ").slice(0, 19);

export async function POST(request: Request) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!hasPermission(user.role, "broadcast:send")) return Response.json({ error: "เฉพาะผู้จัดการฝ่ายผลิตหรือผู้ดูแลระบบเท่านั้นที่ส่งประกาศได้" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const title = String(body.title || "").trim().slice(0, 120);
  const message = String(body.message || "").trim().slice(0, 1200);
  const priority = broadcastPriorities.includes(body.priority as never) ? String(body.priority) : "normal";
  const displayMode = broadcastDisplayModes.includes(body.displayMode as never) ? String(body.displayMode) : "top_banner";
  const targetScope = ["all", "department", "screen"].includes(String(body.targetScope)) ? String(body.targetScope) : "all";
  const targetDepartment = broadcastDepartments.includes(body.targetDepartment as never) ? String(body.targetDepartment) : "";
  const targetScreen = String(body.targetScreen || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
  const untilDismissed = Boolean(body.untilDismissed);
  const durationMinutes = Math.min(1440, Math.max(1, Math.floor(Number(body.durationMinutes || 5))));
  if (!title || !message) return Response.json({ error: "กรุณากรอกหัวข้อและข้อความ" }, { status: 400 });
  if (targetScope === "department" && !targetDepartment) return Response.json({ error: "กรุณาเลือกแผนกเป้าหมาย" }, { status: 400 });
  if (targetScope === "screen" && !targetScreen) return Response.json({ error: "กรุณาเลือกจอเป้าหมาย" }, { status: 400 });
  const expireAt = untilDismissed ? "" : sqliteDateTime(new Date(Date.now() + durationMinutes * 60_000));
  const database = (env as unknown as { DB: D1Database }).DB;
  const row = await database.prepare(`INSERT INTO broadcast_messages
    (title,message,priority,sender_id,sender_name,display_mode,target_scope,target_department,target_screen,duration_minutes,expire_at,dismissible)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *`).bind(title, message, priority, user.id, user.displayName, displayMode, targetScope, targetDepartment, targetScreen, durationMinutes, expireAt, untilDismissed ? 1 : 0).first<Record<string, string | number>>();
  if (!row) return Response.json({ error: "ไม่สามารถบันทึกประกาศได้" }, { status: 500 });
  const broadcast = broadcastRowToMessage(row);
  const delivered = await publishBroadcastEvent({ type: "broadcast.created", message: broadcast });
  await audit(user, null, "ส่ง Broadcast Message", `${title} • ${priority} • ${targetScope}:${targetDepartment || targetScreen || "all"} • ส่งถึง ${delivered} จอ`);
  return Response.json({ ok: true, broadcast, delivered });
}
