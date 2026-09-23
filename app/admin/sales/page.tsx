import { env } from "cloudflare:workers";
import { can, requireStaff } from "../../staff-auth";
import { salesDateRange, salesQueries, salesScope } from "../../sales-dashboard.mjs";
import { safeSalesOrigin } from "../../sales-kit.mjs";
import SalesWorkspace, { type SalesData, type RankingRow } from "./SalesWorkspace";
import "./sales.css";

export const dynamic = "force-dynamic";
export default async function SalesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requireStaff("/admin/sales");
  let scope: number | null;
  try { scope = salesScope({ id: user.id, all: can(user, "sales:view_all"), team: can(user, "sales:view_team"), self: can(user, "sales:view_self") }); }
  catch { return <main className="salesWorkspace"><h1>ไม่มีสิทธิ์ดูข้อมูลการขาย</h1><a href="/admin">กลับหลังบ้าน</a></main>; }
  const query = await searchParams;
  let range: ReturnType<typeof salesDateRange>;
  try { range = salesDateRange(query.from, query.to); }
  catch { return <main className="salesWorkspace"><h1>ช่วงวันที่ไม่ถูกต้อง</h1><p>เลือกช่วงไม่เกินหนึ่งปีและไม่เกินวันนี้</p><a href="/admin/sales">ดูเดือนนี้</a></main>; }
  try {
    const entries = Object.entries(salesQueries);
    const results = await env.DB.batch(entries.map(([, sql]) => env.DB.prepare(sql).bind(scope, range.start, range.end)));
    const byName = Object.fromEntries(entries.map(([key], index) => [key, results[index].results]));
    const summary = byName.summary[0] as SalesData["summary"];
    const cash = byName.cash[0] as { received: number } | undefined;
    const data: SalesData = { summary: { ...summary, received: Number(cash?.received || 0) },
      daily: byName.daily as SalesData["daily"], sellers: byName.sellers as RankingRow[], channels: byName.channels as RankingRow[],
      products: byName.products as SalesData["products"], followups: byName.followups as SalesData["followups"] };
    return <SalesWorkspace data={data} range={range} displayName={user.displayName} selfOnly={scope !== null}
      canManage={can(user, "commission:manage")} publicOrigin={safeSalesOrigin(env.PUBLIC_SITE_URL || "https://order.k2group.site")} />;
  } catch (error) {
    console.error(JSON.stringify({ event: "sales_workspace_load_failed", message: error instanceof Error ? error.message : "Unknown" }));
    return <main className="salesWorkspace"><h1>ยังโหลดข้อมูลการขายไม่ได้</h1><p>ไม่ได้แทนข้อมูลที่ขาดด้วยยอดศูนย์ กรุณาลองโหลดใหม่</p><a href="/admin/sales">โหลดใหม่</a></main>;
  }
}
