import { env } from "cloudflare:workers";
import { audit, getStaffUser } from "../../../../../staff-auth";

type Payload = {
  productionFileUrl?: string;
  productionFileNote?: string;
};

const allowedHosts = new Set(["drive.google.com", "docs.google.com"]);

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function isGoogleDriveUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && allowedHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบทีมงาน" }, { status: 401 });

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId < 1) {
    return Response.json({ error: "เลขใบงานไม่ถูกต้อง" }, { status: 400 });
  }

  const body = await request.json() as Payload;
  const productionFileUrl = clean(body.productionFileUrl, 1000);
  const productionFileNote = clean(body.productionFileNote, 500);
  if (!productionFileUrl || !isGoogleDriveUrl(productionFileUrl)) {
    return Response.json({ error: "กรุณาใส่ลิงก์ Google Drive ที่ขึ้นต้นด้วย https://drive.google.com/ หรือ https://docs.google.com/" }, { status: 400 });
  }

  const database = (env as unknown as { DB: D1Database }).DB;
  const order = await database.prepare("SELECT id,order_number FROM orders WHERE id=? LIMIT 1")
    .bind(orderId).first<{ id: number; order_number: string }>();
  if (!order) return Response.json({ error: "ไม่พบใบงาน" }, { status: 404 });

  await database.prepare(`
    UPDATE orders
    SET production_file_url=?,production_file_note=?,production_file_updated_at=CURRENT_TIMESTAMP,production_file_updated_by=?
    WHERE id=?
  `).bind(productionFileUrl, productionFileNote, user.displayName, orderId).run();
  await audit(user, orderId, "แก้ไขลิงก์ไฟล์พร้อมผลิต", `${order.order_number} • ${productionFileNote || "ไม่มีหมายเหตุ"}`);
  return Response.json({ ok: true });
}
