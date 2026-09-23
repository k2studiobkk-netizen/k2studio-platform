import { env } from "cloudflare:workers";
import { audit, can, getStaffUser } from "../../../../staff-auth";
import { updateOrderStatus } from "../../../../order-status-update";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { orderStatus?: string; note?: string; shippingFee?: number; depositAmount?: number };
  const { id } = await params;
  const orderId = Number(id);
  const database = (env as unknown as { DB: D1Database }).DB;
  const current = await database.prepare("SELECT order_status, estimated_subtotal, vat_applied FROM orders WHERE id = ?")
    .bind(orderId)
    .first<{ order_status: string; estimated_subtotal: string; vat_applied: number }>();
  if (!current) return Response.json({ error: "Not found" }, { status: 404 });

  if (body.depositAmount !== undefined) {
    return Response.json({ error: "ยอดรับชำระต้องบันทึกพร้อมสลิป เพื่อให้ตรวจสอบย้อนหลังได้" }, { status: 400 });
  }
  if (body.shippingFee !== undefined) {
    if (!can(user,"finance:manage")) return Response.json({ error: "ไม่มีสิทธิ์แก้ไขข้อมูลการเงิน" }, { status: 403 });
    const shipping = Number(body.shippingFee ?? 0);
    const subtotal = Number(current.estimated_subtotal || 0);
    const vatAmount = Number(current.vat_applied) === 1 ? Math.round((subtotal + shipping) * 7) / 100 : 0;
    const estimatedTotal = subtotal + vatAmount;
    const payable = estimatedTotal + shipping;
    if (!Number.isFinite(shipping) || shipping < 0) return Response.json({ error: "ค่าจัดส่งไม่ถูกต้อง" }, { status: 400 });
    await database.prepare("UPDATE orders SET shipping_fee = ?, vat_amount = ?, estimated_total = ? WHERE id = ?")
      .bind(shipping.toFixed(2), vatAmount.toFixed(2), estimatedTotal.toFixed(2), orderId).run();
    await audit(user, orderId, "แก้ไขข้อมูลการเงิน", `ค่าจัดส่ง ฿${shipping.toFixed(2)} • VAT ฿${vatAmount.toFixed(2)} • ยอดสุทธิ ฿${payable.toFixed(2)}`);
    return Response.json({ ok: true, payableTotal: payable });
  }

  if (!body.orderStatus) return Response.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  const result = await updateOrderStatus(database, user, orderId, body.orderStatus, body.note ?? "");
  if (!result.ok) return Response.json({ error: result.error }, { status: result.statusCode });
  return Response.json(result);
}
