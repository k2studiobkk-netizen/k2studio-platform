import { env } from "cloudflare:workers";
import { statusLabels } from "../../../../order-status";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/i.test(token)) {
    return Response.json({ error: "ไม่พบใบสั่งงาน" }, { status: 404, headers: { "cache-control": "no-store" } });
  }

  const database = (env as unknown as { DB: D1Database }).DB;
  const order = await database.prepare("SELECT order_status FROM orders WHERE public_token=? LIMIT 1")
    .bind(token)
    .first<{ order_status: string }>();
  if (!order) {
    return Response.json({ error: "ไม่พบใบสั่งงาน" }, { status: 404, headers: { "cache-control": "no-store" } });
  }

  const status = String(order.order_status);
  return Response.json({ status, label: statusLabels[status] || status }, {
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
