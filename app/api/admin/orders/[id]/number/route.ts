import { env } from "cloudflare:workers";
import { audit, canManageOrderNumber, getStaffUser } from "../../../../../staff-auth";
import { validateOrderNumberChange } from "../../../../../order-number.mjs";

function isOrderNumberConflict(error: unknown) {
  return error instanceof Error &&
    error.message.toLowerCase().includes("unique") &&
    error.message.toLowerCase().includes("order_number");
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canManageOrderNumber(user.role)) {
    return Response.json(
      { error: "เฉพาะผู้ดูแลระบบและหัวหน้างานเท่านั้นที่แก้เลขใบงานได้" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return Response.json({ error: "ใบงานไม่ถูกต้อง" }, { status: 400 });
  }

  const body = await request.json() as { orderNumber?: string };
  const db = (env as unknown as { DB: D1Database }).DB;
  const order = await db.prepare(
    "SELECT order_number FROM orders WHERE id=? LIMIT 1",
  ).bind(orderId).first<{ order_number: string }>();
  if (!order) return Response.json({ error: "ไม่พบใบงาน" }, { status: 404 });

  const result = validateOrderNumberChange(order.order_number, body.orderNumber);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  if (!result.changed) return Response.json({ ok: true, orderNumber: result.value });
  const requestedPrefix = result.value.split("-")[0];
  const knownPrefix = await db.prepare("SELECT id FROM sales_channels WHERE prefix=? LIMIT 1").bind(requestedPrefix).first<{id:number}>();
  if (!knownPrefix) return Response.json({ error: "ไม่พบอักษรนำหน้านี้ในช่องทางขาย กรุณาเพิ่มช่องทางก่อน" }, { status: 400 });

  const duplicate = await db.prepare(
    "SELECT id FROM orders WHERE order_number=? AND id<>? LIMIT 1",
  ).bind(result.value, orderId).first<{ id: number }>();
  if (duplicate) {
    return Response.json(
      { error: "เลขใบงานนี้ถูกใช้งานแล้ว กรุณาเลือกเลขอื่น" },
      { status: 409 },
    );
  }

  try {
    await db.batch([
      db.prepare("UPDATE orders SET order_number=? WHERE id=?").bind(result.value, orderId),
      db.prepare("UPDATE work_orders SET work_order_number=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?").bind(result.value, orderId),
    ]);
  } catch (error) {
    if (isOrderNumberConflict(error)) {
      return Response.json(
        { error: "เลขใบงานนี้ถูกใช้งานแล้ว กรุณาเลือกเลขอื่น" },
        { status: 409 },
      );
    }
    throw error;
  }

  await audit(user, orderId, "แก้ไขเลขใบงาน", `${order.order_number} → ${result.value}`);
  return Response.json({ ok: true, orderNumber: result.value });
}
