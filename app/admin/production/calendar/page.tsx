import { env } from "cloudflare:workers";
import { hasPermission } from "../../../production-rbac";
import { requireStaff } from "../../../staff-auth";
import { capacityBand, capacityLabel } from "../../../production-capacity";

export const dynamic = "force-dynamic";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function shift(date: string, days: number) { const d = new Date(`${date}T12:00:00+07:00`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function dayIndex(start: string, value: string) { return Math.max(0, Math.round((new Date(`${value}T12:00:00+07:00`).getTime() - new Date(`${start}T12:00:00+07:00`).getTime()) / 86400000)); }
const money = (value: number | string | null | undefined) => Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const selectedPrice = (orderSubtotal: string | number, shippingFee: string | number) => `฿${money(Number(orderSubtotal || 0) + Number(shippingFee || 0))}`;

export default async function ProductionCalendar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStaff("/admin/production/calendar");
  if (!hasPermission(user.role, "calendar:view")) return <main className="productionWorkspace"><p>บัญชีนี้ไม่มีสิทธิ์ดู Production Calendar</p></main>;
  const query = await searchParams;
  const view = ["day", "week", "month"].includes(String(query.view)) ? String(query.view) : "week";
  const focus = datePattern.test(String(query.date)) ? String(query.date) : today();
  const monthStart = `${focus.slice(0, 7)}-01`;
  const monthEnd = new Date(Number(focus.slice(0, 4)), Number(focus.slice(5, 7)), 0).toISOString().slice(0, 10);
  const weekday = (new Date(`${focus}T12:00:00+07:00`).getUTCDay() + 6) % 7;
  const start = view === "day" ? focus : view === "week" ? shift(focus, -weekday) : monthStart;
  const end = view === "day" ? focus : view === "week" ? shift(start, 6) : monthEnd;
  const database = (env as unknown as { DB: D1Database }).DB;
  const [scheduleResult, timelineResult, dueTodayResult] = await Promise.all([
    database.prepare(`SELECT ps.id,ps.production_date,ps.estimated_minutes,ps.quantity,wo.id AS work_order_id,wo.order_id,wo.work_order_number,wo.product_name,wo.priority,wo.confirmed_delivery_date,wo.customer_requested_date,wo.rush_status,wo.status,m.id AS machine_id,m.code AS machine_code,m.name AS machine_name,m.daily_capacity_minutes,m.busy_threshold,m.nearly_full_threshold,m.full_threshold,p.name AS process_name,o.estimated_total,o.shipping_fee
      FROM production_schedule ps JOIN work_orders wo ON wo.id=ps.work_order_id JOIN machines m ON m.id=ps.machine_id LEFT JOIN production_processes p ON p.id=ps.process_id LEFT JOIN orders o ON o.id=wo.order_id
      WHERE ps.production_date BETWEEN ? AND ? AND ps.status<>'cancelled' ORDER BY ps.production_date,m.name,ps.sequence_no,ps.id`).bind(start, end).all<Record<string, string | number>>(),
    database.prepare(`SELECT wo.id,wo.order_id,wo.work_order_number,wo.product_name,wo.quantity,wo.planned_production_date,wo.confirmed_delivery_date,wo.priority,wo.rush_status,wo.status,o.estimated_total,o.shipping_fee
      FROM work_orders wo LEFT JOIN orders o ON o.id=wo.order_id WHERE wo.queue_removed=0 AND wo.status NOT IN ('completed','shipped','cancelled')
      AND planned_production_date<>'' AND confirmed_delivery_date<>'' AND planned_production_date<=? AND confirmed_delivery_date>=?
      ORDER BY CASE WHEN priority='urgent' OR rush_status NOT IN ('none','rejected') THEN 0 ELSE 1 END,confirmed_delivery_date,wo.queue_rank,wo.id LIMIT 40`).bind(end, start).all<Record<string, string | number>>(),
    database.prepare(`SELECT wo.id,wo.order_id,wo.work_order_number,wo.product_name,wo.quantity,wo.status,wo.priority,o.estimated_total,o.shipping_fee
      FROM work_orders wo LEFT JOIN orders o ON o.id=wo.order_id
      WHERE wo.queue_removed=0 AND wo.confirmed_delivery_date=? AND wo.status NOT IN ('completed','shipped','cancelled')
      ORDER BY CASE WHEN priority='urgent' THEN 0 ELSE 1 END,wo.queue_rank,wo.id`).bind(today()).all<Record<string, string | number>>(),
  ]);
  const rows = scheduleResult.results;
  const days: string[] = [];
  for (let cursor = start; cursor <= end; cursor = shift(cursor, 1)) days.push(cursor);
  const previous = view === "month" ? shift(monthStart, -1) : shift(start, view === "week" ? -7 : -1);
  const next = view === "month" ? shift(monthEnd, 1) : shift(end, 1);
  return <main className="productionWorkspace">
    <header className="productionWorkspaceHeader compact"><div><a href="/admin/production">← Production Dashboard</a><span>FACTORY SOURCE OF TRUTH</span><h1>Production Calendar</h1><p>แถบสีน้ำเงินคือช่วงผลิตถึงกำหนดส่ง ส่วนเส้นสีชมพูคือวันส่งที่ยืนยันแล้ว</p></div></header>
    <nav className="productionTabs"><a href="/admin/production">Dashboard</a>{hasPermission(user.role,"queue:manage")&&<a href="/admin/production/today">Job Today</a>}<a className="active" href="/admin/production/calendar">Production Calendar</a><a href="/admin/production/tv?department=print_cut">Print &amp; Cut TV</a><a href="/admin/production/tv?department=pack">Pack TV</a><a href="/admin/production/tv?department=sale">Sale TV</a><a href="/admin/production/capacity">Machines &amp; Capacity</a></nav>
    <section className="calendarToolbar"><div className="calendarViews">{["day", "week", "month"].map((item) => <a className={view === item ? "active" : ""} href={`/admin/production/calendar?view=${item}&date=${focus}`} key={item}>{item === "day" ? "วัน" : item === "week" ? "สัปดาห์" : "เดือน"}</a>)}</div><div className="calendarPaging"><a href={`/admin/production/calendar?view=${view}&date=${previous}`}>← ก่อนหน้า</a><b>{start} — {end}</b><a href={`/admin/production/calendar?view=${view}&date=${next}`}>ถัดไป →</a></div></section>
    <section className="calendarSourceLayout"><div>
      <section className="productionTimeline"><header><div><span>PRODUCTION RANGE</span><h2>ช่วงผลิต → กำหนดส่ง</h2></div><small>สีชมพู = วันส่ง</small></header><div className="timelineDays" style={{ gridTemplateColumns: `repeat(${days.length},minmax(42px,1fr))` }}>{days.map((date) => <span className={date === today() ? "today" : ""} key={date}><b>{date.slice(8)}</b><small>{new Intl.DateTimeFormat("th-TH", { weekday: "short" }).format(new Date(`${date}T12:00:00+07:00`))}</small></span>)}</div><div className="timelineRows">{timelineResult.results.length ? timelineResult.results.map((job) => {
        const first = Math.max(0, dayIndex(start, String(job.planned_production_date)));
        const last = Math.min(days.length - 1, dayIndex(start, String(job.confirmed_delivery_date)));
        const urgent = String(job.priority) === "urgent" || !["none", "rejected"].includes(String(job.rush_status));
        return <article className={urgent ? "urgent" : ""} style={{ gridTemplateColumns: `repeat(${days.length},minmax(42px,1fr))` }} key={String(job.id)}><a href={`/admin/orders/${job.order_id}`} style={{ gridColumn: `${first + 1}/${last + 2}` }}><b>{job.work_order_number}</b><span>{job.product_name} • {Number(job.quantity).toLocaleString("th-TH")} ชิ้น</span><strong>{selectedPrice(job.estimated_total, job.shipping_fee)}</strong><i title={`กำหนดส่ง ${job.confirmed_delivery_date}`} /></a></article>;
      }) : <div className="timelineEmpty">ยังไม่มีงานที่ยืนยันวันผลิตและวันส่งในช่วงนี้</div>}</div></section>
      <section className={`productionCalendar ${view}`}>{days.map((date) => {
        const jobs = rows.filter((row) => row.production_date === date);
        const machineLoads = new Map<number, { name: string; used: number; capacity: number; busy: number; nearly: number; full: number }>();
        for (const job of jobs) { const id = Number(job.machine_id); const current = machineLoads.get(id) || { name: String(job.machine_name), used: 0, capacity: Number(job.daily_capacity_minutes), busy: Number(job.busy_threshold), nearly: Number(job.nearly_full_threshold), full: Number(job.full_threshold) }; current.used += Number(job.estimated_minutes); machineLoads.set(id, current); }
        const loads = [...machineLoads.values()].map((item) => ({ ...item, percent: Math.round(item.used / Math.max(1, item.capacity) * 1000) / 10 }));
        const peak = loads.reduce((maximum, item) => Math.max(maximum, item.percent), 0);
        const thresholds = loads.sort((a, b) => b.percent - a.percent)[0];
        const band = capacityBand(peak, thresholds?.busy, thresholds?.nearly, thresholds?.full);
        return <article className={`calendarDay ${band} ${date === today() ? "today" : ""}`} key={date}><header><div><small>{new Intl.DateTimeFormat("th-TH", { weekday: "short" }).format(new Date(`${date}T12:00:00+07:00`))}</small><b>{date.slice(8)}</b></div><span>{jobs.length} งาน</span></header>{loads.length > 0 && <div className="dayCapacity"><strong>{peak}%</strong><span>{capacityLabel(band)}</span></div>}<div className="calendarJobs">{jobs.map((job) => <a className={`calendarJob ${job.priority} ${job.rush_status !== "none" ? "rush" : ""}`} href={`/admin/orders/${job.order_id}`} key={String(job.id)}><b>{job.work_order_number}</b><span>{job.machine_code} • {job.process_name || "ผลิต"}</span><small>{job.product_name} • {job.estimated_minutes} นาที</small><strong>{selectedPrice(job.estimated_total, job.shipping_fee)}</strong><em>ส่งยืนยัน {job.confirmed_delivery_date || "ยังไม่ยืนยัน"}</em></a>)}</div></article>;
      })}</section>
    </div><aside className="calendarDueToday"><span>TODAY DELIVERY</span><h2>งานส่งวันนี้</h2><strong>{dueTodayResult.results.length}</strong>{dueTodayResult.results.length ? dueTodayResult.results.map((job) => <a className={String(job.priority) === "urgent" ? "urgent" : ""} href={`/admin/orders/${job.order_id}`} key={String(job.id)}><b>{job.work_order_number}</b><span>{job.product_name}</span><small>{Number(job.quantity).toLocaleString("th-TH")} ชิ้น • {job.status}</small><em>ราคารวม {selectedPrice(job.estimated_total, job.shipping_fee)}</em></a>) : <p>วันนี้ไม่มีงานครบกำหนดส่ง</p>}</aside></section>
  </main>;
}
