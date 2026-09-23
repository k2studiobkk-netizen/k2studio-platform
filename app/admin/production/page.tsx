import { env } from "cloudflare:workers";
import { hasPermission } from "../../production-rbac";
import { can, requireStaff, roleLabel } from "../../staff-auth";
import { capacityBand, capacityLabel } from "../../production-capacity";
import { loadPaymentDueAlerts } from "../../production-dashboard-server";

export const dynamic = "force-dynamic";

function bangkokDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export default async function ProductionDashboard() {
  const user = await requireStaff("/admin/production");
  if (!hasPermission(user.role, "calendar:view")) return <main className="productionWorkspace"><p>บัญชีนี้ไม่มีสิทธิ์ดู Production Calendar</p></main>;
  const database = (env as unknown as { DB: D1Database }).DB;
  const canSeeFinance = can(user, "finance:view");
  const today = bangkokDate();
  const tomorrow = bangkokDate(1);
  const weekEnd = bangkokDate(7);
  const [metrics, load, notifications, paymentAlerts] = await Promise.all([
    database.prepare(`SELECT
      SUM(CASE WHEN planned_production_date=? THEN 1 ELSE 0 END) AS today_jobs,
      SUM(CASE WHEN planned_production_date=? THEN 1 ELSE 0 END) AS tomorrow_jobs,
      SUM(CASE WHEN confirmed_delivery_date=? AND status NOT IN ('completed','shipped','cancelled') THEN 1 ELSE 0 END) AS due_today,
      SUM(CASE WHEN confirmed_delivery_date BETWEEN ? AND ? AND status NOT IN ('completed','shipped','cancelled') THEN 1 ELSE 0 END) AS due_week,
      SUM(CASE WHEN rush_status='pending' THEN 1 ELSE 0 END) AS rush_jobs,
      SUM(CASE WHEN confirmed_delivery_date<>'' AND confirmed_delivery_date<? AND status NOT IN ('completed','shipped','cancelled') THEN 1 ELSE 0 END) AS delayed,
      (SELECT COUNT(*) FROM orders WHERE order_status IN ('waiting_for_graphic','artwork_preparation','artwork_changes_requested')) AS waiting_graphic,
      SUM(CASE WHEN status='waiting_for_production' THEN 1 ELSE 0 END) AS waiting_production,
      SUM(CASE WHEN status='ready_to_ship' THEN 1 ELSE 0 END) AS ready_to_ship
      FROM work_orders`).bind(today, tomorrow, today, today, weekEnd, today).first<Record<string, number>>(),
    database.prepare(`SELECT ps.production_date,m.id AS machine_id,m.name AS machine_name,m.daily_capacity_minutes,m.busy_threshold,m.nearly_full_threshold,m.full_threshold,SUM(ps.estimated_minutes) AS used_minutes,COUNT(DISTINCT ps.work_order_id) AS job_count
      FROM production_schedule ps JOIN machines m ON m.id=ps.machine_id
      WHERE ps.production_date BETWEEN ? AND ? AND ps.status NOT IN ('cancelled','completed')
      GROUP BY ps.production_date,m.id ORDER BY ps.production_date,m.name`).bind(today, weekEnd).all<Record<string, string | number>>(),
    database.prepare("SELECT id,type,title,message,created_at FROM notifications WHERE read_at='' ORDER BY id DESC LIMIT 8").all<Record<string, string | number>>(),
    canSeeFinance ? loadPaymentDueAlerts(database,today) : Promise.resolve([]),
  ]);
  const rows: Array<Record<string, string | number> & { percent: number; band: ReturnType<typeof capacityBand> }> = load.results.map((row) => {
    const percent = Math.round(Number(row.used_minutes) / Math.max(1, Number(row.daily_capacity_minutes)) * 1000) / 10;
    const band = capacityBand(percent, Number(row.busy_threshold), Number(row.nearly_full_threshold), Number(row.full_threshold));
    return { ...row, percent, band };
  });
  const overCapacity = rows.filter((row) => row.band === "full").length;
  const outstandingTotal = paymentAlerts.reduce((sum,item)=>sum+item.outstandingAmount,0);
  const cards = [
    ["ผลิตวันนี้", metrics?.today_jobs || 0, "Today Production"], ["ผลิตพรุ่งนี้", metrics?.tomorrow_jobs || 0, "Tomorrow Production"],
    ["ครบกำหนดวันนี้", metrics?.due_today || 0, "Jobs Due Today"], ["ครบกำหนดสัปดาห์นี้", metrics?.due_week || 0, "Jobs Due This Week"],
    ["คำของานด่วน", metrics?.rush_jobs || 0, "Rush Jobs"], ["วันที่/เครื่องเกินกำลัง", overCapacity, "Over Capacity"],
    ["งานล่าช้า", metrics?.delayed || 0, "Delayed Jobs"], ["รอกราฟิก", metrics?.waiting_graphic || 0, "Waiting for Graphic"],
    ["รอจัดคิวผลิต", metrics?.waiting_production || 0, "Waiting for Production"],
    ["พร้อมส่ง", metrics?.ready_to_ship || 0, "Ready to Ship"],
  ];
  return <main className="productionWorkspace">
    <header className="productionWorkspaceHeader"><div><a href="/admin">← กลับระบบหลังบ้าน</a><span>PRODUCTION CONTROL CENTER</span><h1>ศูนย์วางแผนการผลิต</h1><p>Production Calendar คือข้อมูลกลางสำหรับคิวโรงงานและวันส่งที่ยืนยันแล้ว</p></div><div><b>{user.displayName}</b><span>{roleLabel(user.role)}</span></div></header>
    <nav className="productionTabs"><a className="active" href="/admin/production">Dashboard</a>{hasPermission(user.role,"queue:manage")&&<a href="/admin/production/today">Job Today</a>}<a href="/admin/production/calendar">Production Calendar</a>{hasPermission(user.role,"broadcast:send")&&<a href="/admin/production/broadcast">Live Broadcast</a>}<a href="/admin/production/tv?department=print_cut">Print & Cut TV</a><a href="/admin/production/tv?department=pack">Pack TV</a><a href="/admin/production/tv?department=sale">Sale TV</a><a href="/admin/production/capacity">Machines & Capacity</a></nav>
    {paymentAlerts.length>0&&<section className="productionPaymentAlert" role="alert"><div><span>PAYMENT DEADLINE ALERT</span><h2>⚠ งานถึงกำหนดส่งแต่ยังมียอดค้าง</h2><p>ระบบจะแจ้งต่อเนื่องจนกว่าจะชำระครบหรือปิดงาน</p></div><div><strong>{paymentAlerts.length}</strong><span>ใบงาน • ค้างรวม ฿{outstandingTotal.toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div><nav>{paymentAlerts.slice(0,6).map(item=><a href={`/admin/orders/${item.orderId}#payment-tools`} key={item.orderId}><b>{item.orderNumber}</b><span>ค้าง ฿{item.outstandingAmount.toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></a>)}{paymentAlerts.length>6&&<a href="/admin/production/today"><b>ดูทั้งหมด</b><span>อีก {paymentAlerts.length-6} ใบงาน</span></a>}</nav></section>}
    <section className="productionMetricGrid">{cards.map(([label, value, sub]) => <article key={String(sub)}><span>{sub}</span><strong>{Number(value).toLocaleString("th-TH")}</strong><b>{label}</b></article>)}</section>
    <section className="productionDashboardGrid"><article className="productionLoadOverview"><header><div><span>CAPACITY OVERVIEW</span><h2>โหลด 7 วันข้างหน้า</h2></div><a href="/admin/production/calendar">ดูปฏิทินทั้งหมด →</a></header>{rows.length ? rows.map((row) => <div className={`machineLoadRow ${row.band}`} key={`${row.production_date}-${row.machine_id}`}><div><b>{row.production_date}</b><span>{row.machine_name} • {row.job_count} งาน</span></div><div className="capacityBar"><i style={{ width: `${Math.min(100, row.percent)}%` }} /></div><strong>{row.percent}%</strong><small>{capacityLabel(row.band)}</small></div>) : <div className="productionEmpty"><b>ยังไม่มีงานใน Production Calendar</b><span>ออก Work Order จากใบสั่งงาน แล้วให้ฝ่ายผลิตจัดคิว</span></div>}</article>
    <aside className="productionNotifications"><span>NOTIFICATION CENTER</span><h2>แจ้งเตือนล่าสุด</h2>{notifications.results.length ? notifications.results.map((item) => <article key={String(item.id)}><b>{item.title}</b><p>{item.message}</p><small>{item.created_at}</small></article>) : <p>ยังไม่มีการแจ้งเตือน</p>}</aside></section>
  </main>;
}
