import { env } from "cloudflare:workers";
import { canManagePricing, requireStaff, roleLabel } from "../../staff-auth";
import { HARDWARE } from "../../pricing-config";
import PriceManager from "./PriceManager";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const user = await requireStaff("/admin/pricing");
  if (!canManagePricing(user)) return <main className="staffLoginPage"><section><span>ACCESS DENIED</span><h1>ไม่มีสิทธิ์จัดการราคา</h1><p>บัญชีของคุณไม่ได้รับสิทธิ์แก้ไขราคากลาง</p><a href="/admin">← กลับหน้าหลังบ้าน</a></section></main>;
  const db = (env as unknown as { DB: D1Database }).DB;
  const saved = (await db.prepare("SELECT hardware_code,price,updated_by,updated_at FROM hardware_prices").all<Record<string,string>>()).results;
  const overrides = new Map(saved.map((row) => [row.hardware_code, row]));
  const rows = HARDWARE.map((item) => {
    const override = overrides.get(item.code);
    return { code: item.code, name: item.name, price: override ? Number(override.price) : Number(item.price || 0), updatedBy: override?.updated_by || "", updatedAt: override?.updated_at || "" };
  });
  return <main className="userManagementPage"><header><div><a href="/admin">← กลับหน้าหลังบ้าน</a><span>PRICE MANAGEMENT</span><h1>จัดการราคาอะไหล่</h1><p>แก้ไขราคาเพิ่มต่อชิ้น ระบบจะใช้ราคาใหม่กับใบสั่งงานที่สร้างหลังจากบันทึก</p></div><div className="adminUser"><b>{user.displayName}</b><span>@{user.username} • {roleLabel(user.role)}</span></div></header><PriceManager rows={rows}/></main>;
}
