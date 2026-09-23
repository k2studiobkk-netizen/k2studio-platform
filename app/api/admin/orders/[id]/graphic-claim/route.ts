import { env } from "cloudflare:workers";
import { audit, getStaffUser } from "../../../../../staff-auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(user.role === "admin" || user.role === "production_manager" || user.role === "graphic" || user.teams.includes("graphic"))) {
    return Response.json({ error: "เฉพาะทีมกราฟิกหรือผู้ดูแลระบบที่รับงานได้" }, { status: 403 });
  }
  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId) || orderId <= 0) return Response.json({ error: "เลขใบงานไม่ถูกต้อง" }, { status: 400 });
  const database = (env as unknown as { DB: D1Database }).DB;
  const order = await database.prepare("SELECT order_number,order_status,graphic_claimed_by_id,graphic_claimed_by_name,graphic_claimed_at FROM orders WHERE id=? LIMIT 1").bind(orderId).first<Record<string, string | number | null>>();
  if (!order) return Response.json({ error: "ไม่พบใบงาน" }, { status: 404 });
  if (["in_production","waiting_for_packing","packing","ready_to_ship","shipped","completed","cancelled"].includes(String(order.order_status))) {
    return Response.json({ error: "ใบงานนี้ผ่านขั้นตอนกราฟิกแล้ว" }, { status: 409 });
  }
  if (String(order.graphic_claimed_at || "")) return Response.json({ ok: true, alreadyClaimed: true, claimedBy: order.graphic_claimed_by_name, claimedAt: order.graphic_claimed_at });
  const result = await database.prepare(`UPDATE orders SET graphic_claimed_by_id=?,graphic_claimed_by_name=?,graphic_claimed_at=CURRENT_TIMESTAMP
    WHERE id=? AND graphic_claimed_at=''`).bind(user.id, user.displayName, orderId).run();
  if (!result.meta.changes) return Response.json({ error: "มีทีมงานรับใบงานนี้พร้อมกัน กรุณาโหลดหน้าใหม่" }, { status: 409 });
  await database.prepare("UPDATE work_orders SET graphic_owner_id=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?").bind(user.id, orderId).run();
  await audit(user, orderId, "รับงานกราฟิก", `รับผิดชอบใบงาน ${String(order.order_number)}`);
  return Response.json({ ok: true, claimedBy: user.displayName });
}
