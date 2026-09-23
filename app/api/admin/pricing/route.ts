import { env } from "cloudflare:workers";
import { audit, canManagePricing, getStaffUser } from "../../../staff-auth";
import { HARDWARE } from "../../../pricing-config";

export async function PATCH(request: Request) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canManagePricing(user))
    return Response.json({ error: "เฉพาะหัวหน้างานและผู้ดูแลระบบ" }, { status: 403 });
  const body = (await request.json()) as { code?: string; price?: number };
  const code = String(body.code || "").toUpperCase();
  const price = Number(body.price);
  if (!HARDWARE.some((item) => item.code === code) || !Number.isFinite(price) || price < 0 || price > 1000)
    return Response.json({ error: "รหัสหรือราคาไม่ถูกต้อง" }, { status: 400 });
  const db = (env as unknown as { DB: D1Database }).DB;
  await db
    .prepare("INSERT INTO hardware_prices (hardware_code,price,updated_by,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(hardware_code) DO UPDATE SET price=excluded.price,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP")
    .bind(code, price.toFixed(2), user.username)
    .run();
  await audit(user, null, "แก้ไขราคาอะไหล่", `${code}: ${price.toFixed(2)} บาท`);
  return Response.json({ ok: true, code, price });
}
