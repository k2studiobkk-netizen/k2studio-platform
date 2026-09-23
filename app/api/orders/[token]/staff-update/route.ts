import { env } from "cloudflare:workers";
import { getStaffUser } from "../../../../staff-auth";
import { updateOrderStatus } from "../../../../order-status-update";

export async function PATCH(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบทีมงาน" }, { status: 401 });

  const { token } = await params;
  if (!/^[a-f0-9]{32}$/i.test(token)) return Response.json({ error: "ไม่พบใบสั่งงาน" }, { status: 404 });
  const body = await request.json() as { orderStatus?: string; note?: string };
  const runtime = env as unknown as { DB: D1Database };
  const order = await runtime.DB.prepare("SELECT id FROM orders WHERE public_token=? LIMIT 1")
    .bind(token).first<{ id: number }>();
  if (!order) return Response.json({ error: "ไม่พบใบสั่งงาน" }, { status: 404 });

  const result = await updateOrderStatus(runtime.DB, user, Number(order.id), String(body.orderStatus || ""), String(body.note || ""), "qr");
  if (!result.ok) return Response.json({ error: result.error }, { status: result.statusCode });
  return Response.json(result);
}
