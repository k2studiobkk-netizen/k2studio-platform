import { env } from "cloudflare:workers";
import { can, requireStaff, roleLabel } from "../staff-auth";
import AdminLiveSync from "./AdminLiveSync";
import AdminModuleMenu from "./AdminModuleMenu";
import AdminSidebarNav from "./AdminSidebarNav";
import BackupStatus from "./BackupStatus";
import ProductSalesInsights, { type CustomerInsightRow, type PerformanceRow, type ProductSalesRow } from "./ProductSalesInsights";
import { statusLabels } from "../order-status";
import { calculateCommission } from "../commission.mjs";
import { GRAPHIC_ALERT_START_AT, GRAPHIC_ALERT_START_LABEL } from "../graphic-alert-policy";

export const dynamic = "force-dynamic";

type OrderPreview = {
  key: string;
  url: string;
  label: string;
  fileName: string;
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const user = await requireStaff("/admin");
  const query = await searchParams;
  const rawSearch = Array.isArray(query.q) ? query.q[0] : query.q;
  const orderSearch = String(rawSearch || "").trim().toUpperCase().slice(0, 40);
  const searchPattern = `%${orderSearch.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
  // Searching must stay lightweight even when D1 is busy. The dashboard charts
  // are supplemental, so skip their aggregate queries while locating an order.
  const loadDashboardInsights = orderSearch.length === 0;

  const database = (env as unknown as { DB: D1Database }).DB;
  const canViewRevenue = can(user,"finance:view") || can(user,"sales:view_all") || can(user,"sales:view_team") || can(user,"sales:view_self");
  const selfSalesOnly = can(user,"sales:view_self") && !can(user,"sales:view_team") && !can(user,"sales:view_all") && !can(user,"finance:view");
  const ownerFilter = selfSalesOnly ? ` AND o.sales_owner_id=${Math.max(0,user.id)}` : "";
  const revenue = canViewRevenue && loadDashboardInsights ? await database.prepare(`WITH receipt_totals AS (
      SELECT order_id,SUM(CAST(amount AS REAL)) AS receipt_total FROM order_payment_receipts GROUP BY order_id
    ), payment_events AS (
      SELECT CAST(r.amount AS REAL) AS amount,r.created_at AS payment_at
      FROM order_payment_receipts r JOIN orders o ON o.id=r.order_id WHERE o.order_status<>'cancelled'${ownerFilter}
      UNION ALL
      SELECT MAX(0,CAST(COALESCE(o.deposit_amount,0) AS REAL)-COALESCE(rt.receipt_total,0)) AS amount,o.created_at AS payment_at
      FROM orders o LEFT JOIN receipt_totals rt ON rt.order_id=o.id
      WHERE o.order_status<>'cancelled'${ownerFilter} AND CAST(COALESCE(o.deposit_amount,0) AS REAL)-COALESCE(rt.receipt_total,0)>0.009
    ) SELECT
      COALESCE((SELECT SUM(amount) FROM payment_events),0) AS received_total,
      COALESCE((SELECT SUM(amount) FROM payment_events WHERE date(payment_at,'+7 hours')=date('now','+7 hours')),0) AS received_today,
      COALESCE((SELECT SUM(amount) FROM payment_events WHERE strftime('%Y-%m',payment_at,'+7 hours')=strftime('%Y-%m','now','+7 hours')),0) AS received_month,
      COALESCE(SUM(CAST(estimated_total AS REAL)+CAST(COALESCE(shipping_fee,0) AS REAL)),0) AS sales_total,
      COALESCE(SUM(MAX(0,CAST(estimated_total AS REAL)+CAST(COALESCE(shipping_fee,0) AS REAL)-CAST(COALESCE(deposit_amount,0) AS REAL))),0) AS outstanding_total,
      COUNT(*) AS order_count,
      SUM(CASE WHEN CAST(COALESCE(deposit_amount,0) AS REAL)+0.009>=CAST(estimated_total AS REAL)+CAST(COALESCE(shipping_fee,0) AS REAL) THEN 1 ELSE 0 END) AS paid_order_count
    FROM orders o WHERE o.order_status<>'cancelled'${ownerFilter}`).first<Record<string,number>>() : null;
  const productSales = canViewRevenue && loadDashboardInsights ? (await database.prepare(`WITH item_sales AS (
      SELECT CASE
        WHEN oi.product_type='acrylic_keychain' THEN 'พวงกุญแจอะคริลิก'
        WHEN oi.item_name LIKE '%สติกเกอร์%' OR oi.item_name LIKE '%สติ๊กเกอร์%' THEN 'สติกเกอร์'
        WHEN oi.item_name LIKE '%เสื้อ%' OR oi.item_name LIKE '%หมวก%' THEN 'เสื้อและหมวก'
        WHEN oi.item_name LIKE '%กระเป๋า%' THEN 'กระเป๋า'
        WHEN oi.item_name LIKE '%แก้ว%' OR oi.item_name LIKE '%กระบอก%' OR oi.item_name LIKE '%ขวด%' THEN 'แก้วและภาชนะ'
        WHEN oi.item_name LIKE '%สมุด%' OR oi.item_name LIKE '%ปากกา%' OR oi.item_name LIKE '%เครื่องเขียน%' THEN 'เครื่องเขียน'
        ELSE 'งานสั่งทำอื่น ๆ'
      END AS category,CAST(oi.quantity AS REAL) AS quantity,CAST(oi.line_total AS REAL) AS sales,o.created_at
      FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE o.order_status<>'cancelled'${ownerFilter} AND date(o.created_at,'+7 hours')>=date('now','+7 hours','start of month','-1 month')
    ), period_sales AS (
      SELECT 'today' AS period,category,SUM(quantity) AS quantity,SUM(sales) AS sales FROM item_sales WHERE date(created_at,'+7 hours')=date('now','+7 hours') GROUP BY category
      UNION ALL
      SELECT 'month' AS period,category,SUM(quantity) AS quantity,SUM(sales) AS sales FROM item_sales WHERE strftime('%Y-%m',created_at,'+7 hours')=strftime('%Y-%m','now','+7 hours') GROUP BY category
      UNION ALL
      SELECT 'previous_month' AS period,category,SUM(quantity) AS quantity,SUM(sales) AS sales FROM item_sales WHERE strftime('%Y-%m',created_at,'+7 hours')=strftime('%Y-%m','now','+7 hours','start of month','-1 month') GROUP BY category
    ) SELECT period,category,quantity,sales FROM period_sales ORDER BY period,sales DESC`).all<ProductSalesRow>()).results.map((row) => ({...row, quantity:Number(row.quantity||0), sales:Number(row.sales||0)})) : [];
  let performanceRows = canViewRevenue && loadDashboardInsights ? (await database.prepare(`WITH base AS (
      SELECT o.created_at,COALESCE(o.sales_owner_id,0) AS salesOwnerId,COALESCE(NULLIF(o.sales_owner_name,''),'ยังไม่ระบุเซลล์') AS salesperson,COALESCE(sc.name,CASE o.contact_channel WHEN 'line' THEN 'LINE (ข้อมูลเดิม)' WHEN 'other' THEN 'อื่น ๆ' ELSE NULLIF(o.contact_channel,'') END,'ยังไม่ระบุช่องทาง') AS channel,
        MAX(0,CAST(estimated_total AS REAL)-CAST(COALESCE(vat_amount,0) AS REAL)) AS sales,
        CAST(COALESCE(deposit_amount,0) AS REAL) AS received,
        MAX(0,CAST(estimated_total AS REAL)+CAST(COALESCE(shipping_fee,0) AS REAL)-CAST(COALESCE(deposit_amount,0) AS REAL)) AS outstanding
      FROM orders o LEFT JOIN sales_channels sc ON sc.code=o.contact_channel WHERE o.order_status<>'cancelled'${ownerFilter} AND date(o.created_at,'+7 hours')>=date('now','+7 hours','start of month','-1 month')
    ), period_orders AS (
      SELECT 'today' AS period,* FROM base WHERE date(created_at,'+7 hours')=date('now','+7 hours')
      UNION ALL SELECT 'month',* FROM base WHERE strftime('%Y-%m',created_at,'+7 hours')=strftime('%Y-%m','now','+7 hours')
      UNION ALL SELECT 'previous_month',* FROM base WHERE strftime('%Y-%m',created_at,'+7 hours')=strftime('%Y-%m','now','+7 hours','start of month','-1 month')
    )
    SELECT period,'salesperson' AS kind,salesOwnerId,salesperson AS label,SUM(sales) AS sales,SUM(received) AS received,SUM(outstanding) AS outstanding,COUNT(*) AS orders FROM period_orders GROUP BY period,salesOwnerId,salesperson
    UNION ALL SELECT period,'channel',0,channel,SUM(sales),SUM(received),SUM(outstanding),COUNT(*) FROM period_orders GROUP BY period,channel
    ORDER BY period,kind,sales DESC`).all<PerformanceRow>()).results.map(row=>({...row,sales:Number(row.sales||0),received:Number(row.received||0),outstanding:Number(row.outstanding||0),orders:Number(row.orders||0)})) : [];
  if (canViewRevenue && loadDashboardInsights && (can(user,"commission:view_self") || can(user,"commission:view_all"))) {
    const tiers = (await database.prepare("SELECT sales_owner_id,tier_name,min_sales,max_sales,rate_percent,effective_from,effective_to FROM commission_tiers ORDER BY effective_from DESC,min_sales DESC").all<Record<string,string|number|null>>()).results.map(row=>({salesOwnerId:Number(row.sales_owner_id)||0,tierName:String(row.tier_name),minSales:Number(row.min_sales),maxSales:row.max_sales==null?null:Number(row.max_sales),ratePercent:Number(row.rate_percent),effectiveFrom:String(row.effective_from),effectiveTo:String(row.effective_to||"")}));
    const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const [year,month] = today.split("-").map(Number);const previousReference = new Date(Date.UTC(year,month-1,0)).toISOString().slice(0,10);
    performanceRows = performanceRows.map(row=>{if(row.kind!=="salesperson")return row;const referenceDate=row.period==="previous_month"?previousReference:today;const commission=calculateCommission(row.sales,row.salesOwnerId,referenceDate,tiers);return {...row,commissionRate:commission.rate,commission:commission.amount,commissionTier:commission.tierName}});
  }
  const customerInsights = canViewRevenue && loadDashboardInsights ? (await database.prepare(`WITH customer_orders AS (
      SELECT CASE WHEN TRIM(phone)<>'' THEN 'โทร '||TRIM(phone) WHEN TRIM(email)<>'' THEN lower(TRIM(email)) ELSE 'ใบงาน '||order_number END AS identifier,
        o.contact_name,o.sales_owner_name,COALESCE(sc.name,CASE o.contact_channel WHEN 'line' THEN 'LINE (ข้อมูลเดิม)' WHEN 'other' THEN 'อื่น ๆ' ELSE NULLIF(o.contact_channel,'') END,'ยังไม่ระบุช่องทาง') AS channel,o.created_at,
        MAX(0,CAST(estimated_total AS REAL)-CAST(COALESCE(vat_amount,0) AS REAL)) AS sales,CAST(COALESCE(deposit_amount,0) AS REAL) AS received,
        MAX(0,CAST(estimated_total AS REAL)+CAST(COALESCE(shipping_fee,0) AS REAL)-CAST(COALESCE(deposit_amount,0) AS REAL)) AS outstanding
      FROM orders o LEFT JOIN sales_channels sc ON sc.code=o.contact_channel WHERE o.order_status<>'cancelled'${ownerFilter}
    ) SELECT MAX(contact_name) AS name,identifier,MAX(sales_owner_name) AS salesOwner,MAX(channel) AS channel,COUNT(*) AS orders,SUM(sales) AS sales,SUM(received) AS received,SUM(outstanding) AS outstanding,MAX(date(created_at,'+7 hours')) AS lastOrder
    FROM customer_orders GROUP BY identifier ORDER BY sales DESC LIMIT 12`).all<CustomerInsightRow>()).results.map(row=>({...row,orders:Number(row.orders||0),sales:Number(row.sales||0),received:Number(row.received||0),outstanding:Number(row.outstanding||0)})) : [];
  const ordersStatement = database.prepare(`SELECT o.id,o.public_token,o.order_number,o.created_at,o.contact_name,o.phone,o.sales_owner_id,o.sales_owner_name,o.contact_channel,o.quantity,o.thickness_mm,o.pricing_size_cm,o.hardware_code,o.estimated_total,o.shipping_fee,o.order_status,o.price_status,COALESCE((SELECT oi.product_type FROM order_items oi WHERE oi.order_id=o.id ORDER BY oi.line_no LIMIT 1),'acrylic_keychain') AS product_type,COALESCE((SELECT oi.item_name FROM order_items oi WHERE oi.order_id=o.id ORDER BY oi.line_no LIMIT 1),'') AS item_name,(SELECT COUNT(*) FROM order_items oi WHERE oi.order_id=o.id) AS item_count FROM orders o ${orderSearch ? "WHERE UPPER(o.order_number) LIKE ? ESCAPE '\\'" : ""} ORDER BY o.id DESC LIMIT 100`);
  const result = orderSearch ? await ordersStatement.bind(searchPattern).all() : await ordersStatement.all();
  const orders = result.results as Array<Record<string, string | number>>;
  let graphicWorkflow = [] as Array<Record<string, string | number>>;
  if (loadDashboardInsights) try {
    graphicWorkflow = (await database.prepare(`WITH latest_design AS (
      SELECT d.order_id,d.status,d.created_at,ROW_NUMBER() OVER (PARTITION BY d.order_id ORDER BY d.version_no DESC,d.id DESC) AS design_rank
      FROM design_versions d
    )
    SELECT o.id,o.order_number,o.contact_name,o.sales_owner_name,o.requested_date,o.graphic_claimed_by_name,
      CASE WHEN o.graphic_claimed_at='' THEN 'unclaimed' ELSE 'working' END AS graphic_stage,
      CASE WHEN o.graphic_claimed_at='' THEN o.created_at ELSE o.graphic_claimed_at END AS stage_started_at,
      CAST((julianday('now')-julianday(CASE WHEN o.graphic_claimed_at='' THEN o.created_at ELSE o.graphic_claimed_at END))*24 AS INTEGER) AS waiting_hours
    FROM orders o
    WHERE o.order_status IN ('waiting_for_artwork_review','waiting_for_graphic')
      AND o.created_at>=?
      AND NOT EXISTS (SELECT 1 FROM design_versions d WHERE d.order_id=o.id)
    UNION ALL
    SELECT o.id,o.order_number,o.contact_name,o.sales_owner_name,o.requested_date,o.graphic_claimed_by_name,
      'confirmation',d.created_at,CAST((julianday('now')-julianday(d.created_at))*24 AS INTEGER)
    FROM orders o JOIN latest_design d ON d.order_id=o.id AND d.design_rank=1
    WHERE o.order_status='artwork_approval_pending' AND d.status='pending' AND o.created_at>=?
    ORDER BY waiting_hours DESC LIMIT 30`).bind(GRAPHIC_ALERT_START_AT, GRAPHIC_ALERT_START_AT).all<Record<string, string | number>>()).results;
  } catch (error) {
    console.error(JSON.stringify({ event: "graphic_workflow_dashboard_unavailable", message: error instanceof Error ? error.message : String(error) }));
  }
  const orderTokens = new Map(orders.map((order) => [Number(order.id), String(order.public_token || "")]));
  const previewsByOrder = new Map<number, OrderPreview[]>();
  try {
    // Load the latest customer-confirmation artwork in one bounded query. This
    // avoids an extra database request for every order on the dashboard.
    const previewStatement = database.prepare(`
      WITH recent_orders AS (
        SELECT o.id FROM orders o ${orderSearch ? "WHERE UPPER(o.order_number) LIKE ? ESCAPE '\\'" : ""} ORDER BY o.id DESC LIMIT 100
      ), latest_designs AS (
        SELECT d.id,d.order_id,d.scale_file_key,d.mockup_file_key,d.file_key,
          ROW_NUMBER() OVER (PARTITION BY d.order_id ORDER BY d.version_no DESC,d.id DESC) AS design_rank
        FROM design_versions d
        JOIN recent_orders recent ON recent.id=d.order_id
        WHERE d.status IN ('pending','approved','changes_requested')
      ), ranked_assets AS (
        SELECT latest.order_id,latest.scale_file_key,latest.mockup_file_key,latest.file_key,
          asset.id AS asset_id,asset.asset_type,asset.file_name,asset.caption,
          ROW_NUMBER() OVER (
            PARTITION BY latest.order_id
            ORDER BY CASE asset.asset_type WHEN 'scale' THEN 0 WHEN 'mockup' THEN 1 ELSE 2 END,
              asset.sort_order,asset.id
          ) AS asset_rank
        FROM latest_designs latest
        LEFT JOIN design_assets asset ON asset.design_version_id=latest.id
        WHERE latest.design_rank=1
      )
      SELECT order_id,scale_file_key,mockup_file_key,file_key,asset_id,asset_type,file_name,caption
      FROM ranked_assets
      WHERE asset_rank<=6
      ORDER BY order_id DESC,asset_rank
    `);
    const previewRows = (orderSearch
      ? await previewStatement.bind(searchPattern).all<Record<string, string | number | null>>()
      : await previewStatement.all<Record<string, string | number | null>>()).results;

    for (const row of previewRows) {
      const orderId = Number(row.order_id);
      const token = orderTokens.get(orderId) || "";
      if (!token) continue;
      const previews = previewsByOrder.get(orderId) ?? [];
      if (Number(row.asset_id) > 0) {
        const kind = String(row.asset_type) === "scale" ? "ภาพแบบมีสเกล" : "ภาพม็อกอัป";
        previews.push({
          key: `asset-${row.asset_id}`,
          url: `/api/orders/${token}/design?asset=${row.asset_id}`,
          label: String(row.caption || kind),
          fileName: String(row.file_name || kind),
        });
      } else {
        if (String(row.scale_file_key || "")) previews.push({
          key: "legacy-scale",
          url: `/api/orders/${token}/design?kind=scale`,
          label: "ภาพแบบมีสเกล",
          fileName: "ภาพแบบมีสเกล",
        });
        if (String(row.mockup_file_key || row.file_key || "")) previews.push({
          key: "legacy-mockup",
          url: `/api/orders/${token}/design?kind=mockup`,
          label: "ภาพม็อกอัป",
          fileName: "ภาพม็อกอัป",
        });
      }
      if (previews.length) previewsByOrder.set(orderId, previews);
    }
  } catch (error) {
    // Preview images are supplemental. Keep the order dashboard usable even if
    // an older database has not received the design_assets migration yet.
    console.error(JSON.stringify({
      event: "admin_order_previews_unavailable",
      message: error instanceof Error ? error.message : String(error),
    }));
  }
  const waiting = orders.filter((order) => order.order_status === "waiting_for_artwork_review").length;
  const producing = orders.filter((order) => order.order_status === "in_production").length;
  const completed = orders.filter((order) => order.order_status === "completed").length;
  let latestBackup: Record<string, string | number> | null = null;
  if (loadDashboardInsights) try {
    latestBackup = await database.prepare("SELECT backup_date,status,order_count,file_count,google_drive_url,google_sheet_url,error_message,completed_at FROM backup_runs ORDER BY started_at DESC,id DESC LIMIT 1").first<Record<string,string|number>>();
  } catch (error) {
    // Backup status is supplemental information. A missing/temporarily unavailable
    // backup table must not take the whole order dashboard offline.
    console.error(JSON.stringify({
      event: "admin_backup_status_unavailable",
      message: error instanceof Error ? error.message : String(error),
    }));
  }
  return <main className="adminShell">
    <aside className="adminSidebar">
      <a className="adminBrand" href="/admin"><img src="/assets/k2studio/k2studio-logo-reference-v1.png" alt="K2STUDIO"/><div><b>K2STUDIO</b><span>ORDER &amp; PRODUCTION</span></div></a>
      <AdminSidebarNav role={user.role} permissions={user.permissions}/>
      <div className="adminSidebarFooter"><span>เข้าสู่ระบบโดย</span><b>{user.displayName}</b><small>{roleLabel(user.role)}</small><a className="adminSignOut" href="/api/staff/logout">ออกจากระบบ</a></div>
    </aside>
    <section className="adminMain">
      <header className="adminTopbar"><div><span>K2STUDIO ADMIN</span><h1>ภาพรวมการทำงาน</h1><p>ใบสั่งงาน คิวผลิต และกำหนดส่งที่ต้องจัดการวันนี้</p></div><div className="adminTopbarAside"><div className="adminTopbarActions"><AdminLiveSync/><div className="adminUser"><b>{user.displayName}</b><span>@{user.username} • {roleLabel(user.role)}</span></div></div><div className="adminTopbarCtas">{can(user.role,"calendar:view")&&<a href="/admin/production/calendar">เปิดปฏิทินผลิต</a>}{can(user.role,"orders:create")&&<a className="primary" href="/admin/orders/new">สร้างใบงาน</a>}</div></div></header>
      {revenue&&<section className="adminRevenueHero" aria-label="ยอดรับชำระสะสม"><div className="adminRevenueLead"><span>LIVE REVENUE</span><p>ยอดรับชำระสะสม ณ ปัจจุบัน</p><strong>฿{Number(revenue.received_total||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><small>คำนวณจากยอดที่บันทึกรับชำระจริงทุกงวด • ไม่รวมงานยกเลิก</small></div><div className="adminRevenueMetrics"><article className="today"><span>รับชำระวันนี้</span><b>฿{Number(revenue.received_today||0).toLocaleString("th-TH",{maximumFractionDigits:0})}</b><small>รวมยอดจากสลิปที่บันทึกวันนี้</small></article><article className="month"><span>รับชำระเดือนนี้</span><b>฿{Number(revenue.received_month||0).toLocaleString("th-TH",{maximumFractionDigits:0})}</b></article><article><span>ยอดขายจากใบงาน</span><b>฿{Number(revenue.sales_total||0).toLocaleString("th-TH",{maximumFractionDigits:0})}</b></article><article className="due"><span>ยอดค้างรอรับ</span><b>฿{Number(revenue.outstanding_total||0).toLocaleString("th-TH",{maximumFractionDigits:0})}</b></article><article><span>อัตราเก็บเงินครบ</span><b>{Number(revenue.order_count)>0?Math.round(Number(revenue.paid_order_count||0)/Number(revenue.order_count)*100):0}%</b></article></div><a href="/admin/orders/new"><span>เพิ่มยอดขายวันนี้</span><b>+ สร้างใบงานใหม่</b></a></section>}
      {canViewRevenue&&<ProductSalesInsights rows={productSales} performanceRows={performanceRows} customerRows={customerInsights}/>}
      {graphicWorkflow.length > 0 && <section className="graphicAlertCenter" aria-labelledby="graphic-alert-title">
        <header><div><span>GRAPHIC WATCH</span><h2 id="graphic-alert-title">งานกราฟิกที่ต้องติดตาม</h2><p>เตือนเมื่อค้างเกิน 24 ชั่วโมง • เริ่มนับเฉพาะใบงานใหม่ตั้งแต่ {GRAPHIC_ALERT_START_LABEL}</p></div><b>{graphicWorkflow.filter(item=>Number(item.waiting_hours)>=24).length} งานเกินเวลา</b></header>
        <div className="graphicAlertSummary"><span><b>{graphicWorkflow.filter(item=>item.graphic_stage==='unclaimed').length}</b> ยังไม่มีคนรับ</span><span><b>{graphicWorkflow.filter(item=>item.graphic_stage==='working').length}</b> กำลังทำแบบ</span><span><b>{graphicWorkflow.filter(item=>item.graphic_stage==='confirmation').length}</b> รอลูกค้าคอนเฟิร์ม</span></div>
        <div className="graphicAlertList">{graphicWorkflow.map(item=>{const overdue=Number(item.waiting_hours)>=24;const stage=String(item.graphic_stage);const label=stage==='unclaimed'?'ยังไม่มีกราฟิกรับงาน':stage==='working'?'กราฟิกรับงานแล้ว • กำลังทำแบบ':'ส่งแบบแล้ว • รอลูกค้าคอนเฟิร์ม';return <a className={overdue?'overdue':''} href={`/admin/orders/${item.id}`} key={`${item.id}-${stage}`}><i>{overdue?'!':'•'}</i><div><strong>{String(item.order_number)}</strong><span>{String(item.contact_name)} • เซลล์ {String(item.sales_owner_name||'ยังไม่ระบุ')}</span><small>{label}{item.graphic_claimed_by_name?` • ${String(item.graphic_claimed_by_name)}`:''}</small></div><em>{overdue?`เกิน ${Number(item.waiting_hours)} ชม.`:`รอ ${Math.max(0,Number(item.waiting_hours))} ชม.`}<small>ส่ง {String(item.requested_date||'ยังไม่กำหนด')}</small></em></a>})}</div>
      </section>}
      {can(user.role,"calendar:view")&&<div className="adminMobileProductionNav" role="navigation" aria-label="ทางลัดระบบการผลิตบนมือถือ">
        <a href="/admin/production"><span>PRODUCTION</span><b>แดชบอร์ดการผลิต</b></a>
        <a href="/admin/production/calendar"><span>CALENDAR</span><b>ปฏิทินงาน</b></a>
        {can(user.role,"queue:manage")&&<a href="/admin/production/today"><span>JOB TODAY</span><b>งานส่งวันนี้</b></a>}
      </div>}
      <div className="adminStats">
        <article><span>ใบสั่งงานล่าสุด</span><strong>{orders.length}</strong><small>รายการในระบบ</small></article>
        <article><span>รอตรวจไฟล์</span><strong>{waiting}</strong><small>ต้องตรวจสอบ</small></article>
        <article className="accent"><span>กำลังผลิต</span><strong>{producing}</strong>{can(user.role,"calendar:view")?<a className="adminStatLink" href="/admin/production">ดูคิวการผลิต</a>:<small>อยู่ระหว่างผลิต</small>}</article>
        <article><span>เสร็จแล้ว</span><strong>{completed}</strong><small>พร้อมส่งหรือปิดงาน</small></article>
      </div>
      <AdminModuleMenu role={user.role} permissions={user.permissions}/>
      <section className="adminOrders" id="orders">
        <div className="adminSectionTitle"><div><span>ORDER MANAGEMENT</span><h2>รายการใบสั่งงานล่าสุด</h2></div><a href="/admin/orders/new">+ สร้างใบงานใหม่</a></div>
        <form className="adminOrderSearch" action="/admin" method="get" role="search">
          <label htmlFor="order-number-search">ค้นหาเลขใบงาน</label>
          <div><input id="order-number-search" name="q" type="search" inputMode="search" autoComplete="off" defaultValue={orderSearch} placeholder="เช่น K2-1234 หรือ 1234" aria-describedby="order-search-help"/><button type="submit">ค้นหา</button>{orderSearch&&<a href="/admin#orders">ล้างการค้นหา</a>}</div>
          <small id="order-search-help">ค้นหาได้จากเลขเต็มหรือเลขบางส่วน</small>
          {orderSearch&&<p aria-live="polite">พบ <b>{orders.length}</b> ใบงานสำหรับ “{orderSearch}”</p>}
        </form>
        {orders.length === 0 ? <div className="adminEmpty"><b>{orderSearch?"ไม่พบเลขใบงานนี้":"ยังไม่มีใบสั่งงาน"}</b><p>{orderSearch?"ลองตรวจสอบเลขแล้วค้นหาอีกครั้ง หรือพิมพ์เฉพาะตัวเลข":"เมื่อลูกค้าส่งแบบฟอร์ม ข้อมูลจะปรากฏที่นี่ทันที"}</p>{orderSearch&&<a href="/admin#orders">แสดงใบงานทั้งหมด</a>}</div> :
        <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>เลขที่งาน</th><th>ลูกค้า</th><th>สินค้า</th><th>แบบลูกค้า</th><th>จำนวน</th><th>ยอดสุทธิ</th><th>สถานะ</th><th></th></tr></thead><tbody>{orders.map((order) => {
          const previews = previewsByOrder.get(Number(order.id)) ?? [];
          const canSeeAmount=can(user,"finance:view")||can(user,"sales:view_all")||can(user,"sales:view_team")||(can(user,"sales:view_self")&&Number(order.sales_owner_id)===user.id);
          return <tr key={String(order.id)}><td data-label="เลขที่งาน"><b>{order.order_number}</b><small>{String(order.created_at)}</small></td><td data-label="ลูกค้า">{order.contact_name}<small>{order.phone}</small></td><td data-label="สินค้า">{String(order.product_type)==="custom"?String(order.item_name||"งานสั่งทำอื่น ๆ"):`พวงกุญแจ ${order.thickness_mm} มม. / ${order.pricing_size_cm} ซม.`}<small>{Number(order.item_count)>1?`${order.item_count} รายการ`:String(order.product_type)==="custom"?"งานสั่งทำ":"อะไหล่ "+order.hardware_code}</small></td><td className="adminOrderPreviewCell" data-label="ภาพแบบลูกค้าคอนเฟิร์ม">{previews.length ? <div className="adminOrderPreview" role="list" aria-label={`ภาพแบบของใบงาน ${order.order_number}`}>{previews.map((preview) => <a key={preview.key} href={preview.url} target="_blank" rel="noreferrer" role="listitem" aria-label={`เปิด ${preview.label} เต็มจอ`}><img src={preview.url} alt={`${preview.label} ใบงาน ${order.order_number}`} loading="lazy"/><span>{preview.label}</span><small>{preview.fileName}</small></a>)}</div> : <span className="adminOrderPreviewEmpty">ยังไม่มีภาพแบบ</span>}</td><td data-label="จำนวน">{Number(order.quantity).toLocaleString()} หน่วย</td><td data-label="ยอดสุทธิ">{canSeeAmount?<><b>฿{(Number(order.estimated_total)+Number(order.shipping_fee||0)).toLocaleString()}</b>{Number(order.shipping_fee||0)>0&&<small>รวมค่าส่ง ฿{Number(order.shipping_fee).toLocaleString()}</small>}</>:<span className="financiallyRestricted">ซ่อนตามสิทธิ์</span>}</td><td data-label="สถานะ"><span className={`orderBadge ${order.order_status}`}>{statusLabel(String(order.order_status))}</span></td><td data-label="จัดการ"><a className="adminView" href={`/admin/orders/${order.id}`} aria-label={`ดูใบงาน ${order.order_number}`}><span>ดูใบงาน</span><i aria-hidden="true">→</i></a></td></tr>;
        })}</tbody></table></div>}
      </section>
      <BackupStatus initial={latestBackup as never} canRun={user.role==="admin"}/>
    </section>
  </main>;
}

function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}
