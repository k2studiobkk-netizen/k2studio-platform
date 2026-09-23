import { env } from "cloudflare:workers";
import Home from "../../../page";
import { canManagePricing, requireStaff } from "../../../staff-auth";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const user = await requireStaff("/admin/orders/new");
  const database = (env as unknown as { DB: D1Database }).DB;
  const [salesUsersResult,channelsResult] = await Promise.all([
    database.prepare("SELECT u.id,u.display_name,u.username FROM staff_users u WHERE u.active=1 AND (u.role IN ('admin','production_manager','sales','sales_manager') OR EXISTS (SELECT 1 FROM staff_user_teams t WHERE t.user_id=u.id AND t.team_code='sale')) ORDER BY u.display_name,u.username").all<{id:number;display_name:string;username:string}>(),
    database.prepare("SELECT code,name,prefix,platform FROM sales_channels WHERE active=1 ORDER BY sort_order,name").all<{code:string;name:string;prefix:string;platform:string}>(),
  ]);
  const salesUsers = salesUsersResult.results;
  return <Home
    canCreateOrder
    staffName={user.displayName}
    staffId={user.id}
    salesUsers={salesUsers.map((item) => ({ id:Number(item.id), name:String(item.display_name), username:String(item.username) }))}
    salesChannels={channelsResult.results.map((item) => ({ code:String(item.code), name:String(item.name), prefix:String(item.prefix), platform:String(item.platform) }))}
    canManagePricing={canManagePricing(user)}
    canManageUsers={user.role === "admin"}
  />;
}
