import { env } from "cloudflare:workers";
import { can, requireStaff, roleLabel } from "../../staff-auth";
import SalesSettingsManager from "./SalesSettingsManager";
import VatPolicySettings from "./VatPolicySettings";
import { getVatCollectionPolicy } from "../../vat-collection-policy.mjs";

export const dynamic = "force-dynamic";

export default async function SalesSettingsPage() {
  const user = await requireStaff("/admin/sales-settings");
  if (!can(user,"commission:manage")) return <main className="staffLoginPage"><section><span>ACCESS DENIED</span><h1>ไม่มีสิทธิ์ตั้งค่าการขาย</h1><p>บัญชีของคุณไม่ได้รับสิทธิ์ตั้งค่าคอมมิชชั่นและช่องทางขาย</p><a href="/admin">← กลับหน้าหลังบ้าน</a></section></main>;
  const db = (env as unknown as { DB: D1Database }).DB;
  const vatPolicy = user.role === "admin" ? await getVatCollectionPolicy(db) : null;
  const [channels, tiers, salesUsers] = await Promise.all([
    db.prepare("SELECT id,code,name,prefix,platform,active,sort_order,created_by,updated_at FROM sales_channels ORDER BY active DESC,sort_order,name").all<Record<string,string|number>>(),
    db.prepare("SELECT t.id,t.sales_owner_id,t.tier_name,t.min_sales,t.max_sales,t.rate_percent,t.effective_from,t.effective_to,t.active,t.created_by_name,t.updated_at,COALESCE(u.display_name,'เรตกลางทุกคน') AS sales_owner_name FROM commission_tiers t LEFT JOIN staff_users u ON u.id=t.sales_owner_id ORDER BY t.active DESC,t.effective_from DESC,t.sales_owner_id,t.min_sales").all<Record<string,string|number|null>>(),
    db.prepare("SELECT u.id,u.display_name,u.username FROM staff_users u WHERE u.active=1 AND (u.role IN ('admin','production_manager','sales') OR EXISTS (SELECT 1 FROM staff_user_teams x WHERE x.user_id=u.id AND x.team_code='sale')) ORDER BY u.display_name,u.username").all<Record<string,string|number>>(),
  ]);
  return <main className="userManagementPage salesSettingsPage"><header><div><a href="/admin">← กลับหน้าหลังบ้าน</a><span>SALES CONFIGURATION</span><h1>คอมมิชชั่นและช่องทางขาย</h1><p>เพิ่มเพจ กำหนดอักษรนำหน้า และตั้งเรตคอมแบบขั้นบันไดได้ตลอดเวลา</p></div><div className="adminUser"><b>{user.displayName}</b><span>@{user.username} • {roleLabel(user.role)}</span></div></header>{vatPolicy && <VatPolicySettings initialMode={vatPolicy.mode} initialRevision={vatPolicy.revision}/>}<SalesSettingsManager channels={channels.results as never} tiers={tiers.results as never} salesUsers={salesUsers.results as never}/></main>;
}
