"use client";

import { useEffect, useMemo, useState } from "react";
import type { TodayDashboardJob, TodayDashboardPayload } from "../../../production-dashboard-types";

const pageSize = 6;
const money = (value: number) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

function thaiDate(value: string) {
  if (!value) return "รอยืนยัน";
  return new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00+07:00`));
}

function fallbackImage(job: TodayDashboardJob) {
  const name = job.productName.toLowerCase();
  if (job.productCategory === "acrylic_keychain" || name.includes("สติกเกอร์") || name.includes("พวงกุญแจ")) return "/assets/k2studio/category-keychains-v1.webp";
  if (name.includes("กระเป๋า")) return "/assets/k2studio/category-bags-v1.webp";
  if (name.includes("แก้ว")) return "/assets/k2studio/category-drinkware-v1.webp";
  if (name.includes("หมวก") || name.includes("เสื้อ")) return "/assets/k2studio/category-apparel-v1.webp";
  if (name.includes("สมุด") || name.includes("ปากกา")) return "/assets/k2studio/category-stationery-v1.webp";
  return "/assets/k2studio/hero-products-v1.webp";
}

function stage(job: TodayDashboardJob) {
  if (["shipped", "completed"].includes(job.status)) return { key: "done", label: "ส่งแล้ว", department: "เสร็จสมบูรณ์" };
  if (job.status === "ready_to_ship") return { key: "ready", label: "พร้อมส่ง", department: "หน้าร้าน / ขนส่ง" };
  if (["waiting_for_packing", "packing"].includes(job.status)) return { key: "pack", label: "รอแพ็ก", department: "ห้อง Pack" };
  if (job.status === "quality_check") return { key: "quality", label: "ตรวจคุณภาพ", department: "QC" };
  if (["in_production", "scheduled"].includes(job.status)) return { key: "production", label: "กำลังผลิต", department: "Print & Cut" };
  return { key: "waiting", label: "รอผลิต", department: "Print & Cut" };
}

export default function TodayDashboard({ initialData }: { initialData: TodayDashboardPayload }) {
  const [payload, setPayload] = useState(initialData);
  const [page, setPage] = useState(0);
  const [now, setNow] = useState<Date | null>(null);

  async function refresh() {
    const response = await fetch("/api/admin/production/today", { cache: "no-store" });
    if (!response.ok) return;
    setPayload(await response.json() as TodayDashboardPayload);
  }

  useEffect(() => {
    setNow(new Date());
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    const sync = window.setInterval(() => void refresh(), 60000);
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => { window.clearInterval(clock); window.clearInterval(sync); document.removeEventListener("visibilitychange", refreshWhenVisible); };
  }, []);

  const ordered = useMemo(() => [...payload.jobs].sort((a, b) => {
    const urgentA = a.priority === "urgent" || !["none", "rejected"].includes(a.rushStatus) ? 0 : 1;
    const urgentB = b.priority === "urgent" || !["none", "rejected"].includes(b.rushStatus) ? 0 : 1;
    return urgentA - urgentB || a.queueRank - b.queueRank || a.id - b.id;
  }), [payload.jobs]);
  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));
  const visible = ordered.slice(page * pageSize, page * pageSize + pageSize);
  const counts = ordered.reduce((result, job) => { const current = stage(job).key; result[current] = (result[current] || 0) + 1; return result; }, {} as Record<string, number>);
  const outstandingTotal = payload.paymentAlerts.reduce((sum, alert) => sum + alert.outstandingAmount, 0);

  useEffect(() => { if (page >= pageCount) setPage(0); }, [page, pageCount]);
  useEffect(() => {
    if (pageCount <= 1) return;
    const timer = window.setInterval(() => setPage((value) => (value + 1) % pageCount), 10000);
    return () => window.clearInterval(timer);
  }, [pageCount]);

  return <>
    {payload.paymentAlerts.length > 0 && <section className="paymentDeadlineAlert" role="alert" aria-label="แจ้งเตือนยอดค้างถึงกำหนดส่ง">
      <header><div><span>PAYMENT OVERDUE</span><h2>⚠ มียอดค้างชำระถึงวันส่งงาน</h2><p>แจ้งเตือนนี้จะแสดงต่อเนื่องจนกว่าจะชำระครบหรือปิดงาน</p></div><div><strong>{payload.paymentAlerts.length}</strong><span>ใบงาน</span><b>ค้างรวม ฿{money(outstandingTotal)}</b></div></header>
      <div>{payload.paymentAlerts.map(alert => <a href={`/admin/orders/${alert.orderId}#payment-tools`} key={alert.orderId}><div><b>{alert.orderNumber}</b><span>{alert.customerName}</span></div><small>{alert.deliveryDate < payload.date ? `เลยกำหนด ${alert.deliveryDate}` : "กำหนดส่งวันนี้"}</small><strong>ค้าง ฿{money(alert.outstandingAmount)}</strong></a>)}</div>
    </section>}
    <section className="todayDashboardSummary" aria-label="สรุปงานส่งวันนี้">
      <article><span>งานส่งวันนี้</span><strong>{ordered.length}</strong><small>งานทั้งหมด</small></article>
      <article><span>กำลังผลิต / QC</span><strong>{(counts.production || 0) + (counts.quality || 0) + (counts.waiting || 0)}</strong><small>ต้องติดตาม</small></article>
      <article><span>ห้อง Pack</span><strong>{counts.pack || 0}</strong><small>รอแพ็ก</small></article>
      <article className="ready"><span>พร้อมส่ง / ส่งแล้ว</span><strong>{(counts.ready || 0) + (counts.done || 0)}</strong><small>ใกล้จบงาน</small></article>
      <div className="todayDashboardClock"><b>{thaiDate(payload.date)}</b><time>{now ? now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}</time><small>อัปเดตอัตโนมัติทุก 60 วินาที</small></div>
    </section>
    <section className="todayDashboardGrid" aria-label="รายการงานที่ต้องส่งวันนี้">
      {visible.length ? visible.map((job, index) => {
        const current = stage(job);
        const urgent = job.priority === "urgent" || !["none", "rejected"].includes(job.rushStatus);
        return <a className={`todayJobCard ${current.key} ${urgent ? "urgent" : ""}`} href={`/admin/orders/${job.orderId}`} key={job.id}>
          <span className="todayJobIndex">{page * pageSize + index + 1}</span>
          <span className={`todayJobStage ${current.key}`}>{current.label}</span>
          <h2>{job.orderNumber}</h2>
          <div className="todayJobVisual"><img src={job.imageUrl} alt={job.productName} onError={(event) => { event.currentTarget.src = fallbackImage(job); }}/></div>
          <div className="todayJobIdentity"><h3>{job.productName}</h3><p>{job.customerName}</p></div>
          {job.dashboardNote && <p className="todayJobNote"><b>โน้ตผู้จัดการ</b>{job.dashboardNote}</p>}
          <dl><div><dt>จำนวน</dt><dd>{job.quantity.toLocaleString("th-TH")} <small>ชิ้น</small></dd></div><div><dt>อยู่ที่</dt><dd>{current.department}</dd></div></dl>
          {urgent && <strong className="todayJobUrgent">งานด่วน</strong>}
        </a>;
      }) : <div className="todayDashboardEmpty"><img src="/assets/k2studio/k2studio-logo-reference-v1.png" alt="K2STUDIO"/><b>วันนี้ไม่มีงานครบกำหนดส่ง</b><span>งานจะปรากฏที่นี่เมื่อมีการยืนยันกำหนดส่งใน Production Calendar</span></div>}
    </section>
    {pageCount > 1 && <nav className="todayDashboardPager" aria-label="หน้ารายการงาน">{Array.from({ length: pageCount }, (_, index) => <button type="button" className={page === index ? "active" : ""} onClick={() => setPage(index)} key={index}>หน้า {index + 1}</button>)}</nav>}
  </>;
}
