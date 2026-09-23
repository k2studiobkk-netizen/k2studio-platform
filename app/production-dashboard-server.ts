import type { DashboardDepartment, PaymentDueAlert, ProductionDashboardJob, ProductionDashboardPayload, SaleCapacityDay, TodayDashboardJob, TodayDashboardPayload } from "./production-dashboard-types";
import { capacityBand } from "./production-capacity";

export function bangkokToday(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function fallbackImage(category: string, productName: string) {
  const name = productName.toLowerCase();
  if (category === "acrylic_keychain" || name.includes("สติกเกอร์") || name.includes("พวงกุญแจ")) return "/assets/k2studio/category-keychains-v1.webp";
  if (name.includes("กระเป๋า")) return "/assets/k2studio/category-bags-v1.webp";
  if (name.includes("แก้ว")) return "/assets/k2studio/category-drinkware-v1.webp";
  if (name.includes("หมวก") || name.includes("เสื้อ")) return "/assets/k2studio/category-apparel-v1.webp";
  if (name.includes("สมุด") || name.includes("ปากกา")) return "/assets/k2studio/category-stationery-v1.webp";
  return "/assets/k2studio/hero-products-v1.webp";
}

export async function loadProductionDashboard(database: D1Database, department: DashboardDepartment, date = bangkokToday()): Promise<ProductionDashboardPayload> {
  if (department === "sale") {
    const end = bangkokToday(13);
    const result = await database.prepare(`SELECT production_date,SUM(used_minutes) AS used_minutes,
      SUM(capacity_minutes) AS capacity_minutes,SUM(job_count) AS job_count
      FROM (
        SELECT ps.production_date,m.id AS machine_id,COALESCE(SUM(ps.estimated_minutes),0) AS used_minutes,
          m.daily_capacity_minutes AS capacity_minutes,COUNT(DISTINCT ps.work_order_id) AS job_count
        FROM production_schedule ps JOIN machines m ON m.id=ps.machine_id
        WHERE ps.production_date BETWEEN ? AND ? AND ps.status NOT IN ('cancelled','completed')
        GROUP BY ps.production_date,m.id,m.daily_capacity_minutes
      ) capacity_by_machine
      GROUP BY production_date ORDER BY production_date`).bind(date, end).all<Record<string, string | number>>();
    const byDate = new Map(result.results.map((row) => [String(row.production_date), row]));
    const days: SaleCapacityDay[] = [];
    for (let index = 0; index < 14; index += 1) {
      const current = bangkokToday(index);
      const row = byDate.get(current);
      const capacityMinutes = Math.max(480, Number(row?.capacity_minutes || 0));
      const usedMinutes = Number(row?.used_minutes || 0);
      const percent = Math.round(usedMinutes / capacityMinutes * 1000) / 10;
      days.push({ date: current, usedMinutes, capacityMinutes, percent, jobCount: Number(row?.job_count || 0), state: capacityBand(percent) });
    }
    const recommended = days.find((day) => day.percent < 70)?.date || days.at(-1)?.date || date;
    return { department, date, jobs: [], saleCapacity: days, recommendedDate: recommended };
  }

  const printCut = department === "print_cut";
  const statusClause = printCut
    ? "(wo.status IN ('waiting_for_production','in_production') OR (wo.status='scheduled' AND EXISTS (SELECT 1 FROM production_schedule ps2 WHERE ps2.work_order_id=wo.id AND ps2.production_date<=? AND ps2.status NOT IN ('completed','cancelled'))))"
    : "wo.status IN ('packing','waiting_for_packing','ready_to_ship')";
  const result = await database.prepare(`SELECT wo.id,wo.order_id,wo.work_order_number,wo.product_name,wo.product_category,wo.quantity,
      wo.confirmed_delivery_date,wo.planned_production_date,wo.priority,wo.rush_status,wo.dashboard_note,wo.queue_rank,wo.status,
      o.public_token,(SELECT da.id FROM design_assets da JOIN design_versions dv ON dv.id=da.design_version_id
        WHERE dv.order_id=wo.order_id AND dv.status='approved' ORDER BY dv.version_no DESC,da.sort_order,da.id LIMIT 1) AS design_asset_id
    FROM work_orders wo JOIN orders o ON o.id=wo.order_id
    WHERE wo.queue_removed=0 AND ${statusClause}
    ORDER BY CASE WHEN wo.priority='urgent' OR wo.rush_status NOT IN ('none','rejected') THEN 0 ELSE 1 END,
      CASE WHEN wo.queue_rank>0 THEN 0 ELSE 1 END,wo.queue_rank,wo.confirmed_delivery_date,wo.id LIMIT 120`)
    .bind(...(printCut ? [date] : [])).all<Record<string, string | number>>();
  const jobs: ProductionDashboardJob[] = result.results.map((row) => ({
    id: Number(row.id), orderId: Number(row.order_id), orderNumber: String(row.work_order_number), publicToken: String(row.public_token),
    productName: String(row.product_name || "งานสั่งผลิต"), productCategory: String(row.product_category || "custom"), quantity: Number(row.quantity || 0),
    deliveryDate: String(row.confirmed_delivery_date || ""), productionDate: String(row.planned_production_date || ""), priority: String(row.priority || "normal"),
    rushStatus: String(row.rush_status || "none"), dashboardNote: String(row.dashboard_note || ""), queueRank: Number(row.queue_rank || 0), status: String(row.status || ""),
    imageUrl: Number(row.design_asset_id) > 0 ? `/api/orders/${row.public_token}/design?asset=${row.design_asset_id}` : fallbackImage(String(row.product_category || "custom"), String(row.product_name || "")),
  }));
  return { department, date, jobs, saleCapacity: [], recommendedDate: "" };
}

export async function loadTodayDashboard(database: D1Database, date = bangkokToday()): Promise<TodayDashboardPayload> {
  const [result, paymentAlerts] = await Promise.all([
   database.prepare(`SELECT wo.id,wo.order_id,wo.work_order_number,wo.product_name,wo.product_category,wo.quantity,
      wo.confirmed_delivery_date,wo.planned_production_date,wo.priority,wo.rush_status,wo.dashboard_note,wo.queue_rank,wo.status,
      o.public_token,o.contact_name,(SELECT da.id FROM design_assets da JOIN design_versions dv ON dv.id=da.design_version_id
        WHERE dv.order_id=wo.order_id AND dv.status='approved' ORDER BY dv.version_no DESC,da.sort_order,da.id LIMIT 1) AS design_asset_id
    FROM work_orders wo JOIN orders o ON o.id=wo.order_id
    WHERE wo.queue_removed=0 AND wo.confirmed_delivery_date=? AND wo.status<>'cancelled'
    ORDER BY CASE WHEN wo.priority='urgent' OR wo.rush_status NOT IN ('none','rejected') THEN 0 ELSE 1 END,
      CASE wo.status WHEN 'ready_to_ship' THEN 0 WHEN 'packing' THEN 1 WHEN 'waiting_for_packing' THEN 1 WHEN 'in_production' THEN 2 ELSE 3 END,
      CASE WHEN wo.queue_rank>0 THEN 0 ELSE 1 END,wo.queue_rank,wo.id LIMIT 120`).bind(date).all<Record<string, string | number>>(),
   loadPaymentDueAlerts(database,date),
  ]);
  const jobs: TodayDashboardJob[] = result.results.map((row) => ({
    id: Number(row.id), orderId: Number(row.order_id), orderNumber: String(row.work_order_number), publicToken: String(row.public_token),
    customerName: String(row.contact_name || "ไม่ระบุลูกค้า"), productName: String(row.product_name || "งานสั่งผลิต"),
    productCategory: String(row.product_category || "custom"), quantity: Number(row.quantity || 0),
    deliveryDate: String(row.confirmed_delivery_date || ""), productionDate: String(row.planned_production_date || ""),
    priority: String(row.priority || "normal"), rushStatus: String(row.rush_status || "none"), dashboardNote: String(row.dashboard_note || ""),
    queueRank: Number(row.queue_rank || 0), status: String(row.status || ""),
    imageUrl: Number(row.design_asset_id) > 0 ? `/api/orders/${row.public_token}/design?asset=${row.design_asset_id}` : fallbackImage(String(row.product_category || "custom"), String(row.product_name || "")),
  }));
  return { date, jobs, paymentAlerts };
}

export async function loadPaymentDueAlerts(database: D1Database, date = bangkokToday()): Promise<PaymentDueAlert[]> {
  const result = await database.prepare(`SELECT wo.order_id,wo.work_order_number,wo.status,o.contact_name,
      COALESCE(NULLIF(wo.confirmed_delivery_date,''),o.requested_date) AS delivery_date,
      CAST(o.estimated_total AS REAL)+CAST(COALESCE(o.shipping_fee,0) AS REAL) AS total_amount,
      CAST(COALESCE(o.deposit_amount,0) AS REAL) AS paid_amount,
      CAST(o.estimated_total AS REAL)+CAST(COALESCE(o.shipping_fee,0) AS REAL)-CAST(COALESCE(o.deposit_amount,0) AS REAL) AS outstanding_amount
    FROM work_orders wo JOIN orders o ON o.id=wo.order_id
    WHERE wo.queue_removed=0 AND wo.status NOT IN ('completed','cancelled')
      AND COALESCE(NULLIF(wo.confirmed_delivery_date,''),o.requested_date)<>''
      AND COALESCE(NULLIF(wo.confirmed_delivery_date,''),o.requested_date)<=?
      AND CAST(o.estimated_total AS REAL)+CAST(COALESCE(o.shipping_fee,0) AS REAL)-CAST(COALESCE(o.deposit_amount,0) AS REAL)>0.009
    ORDER BY delivery_date, outstanding_amount DESC, wo.id LIMIT 60`).bind(date).all<Record<string,string|number>>();
  return result.results.map(row=>({
    orderId:Number(row.order_id),orderNumber:String(row.work_order_number),customerName:String(row.contact_name||"ไม่ระบุลูกค้า"),
    deliveryDate:String(row.delivery_date||""),status:String(row.status||""),totalAmount:Number(row.total_amount||0),
    paidAmount:Number(row.paid_amount||0),outstandingAmount:Math.max(0,Number(row.outstanding_amount||0)),
  }));
}
