"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { DashboardDepartment, ProductionDashboardJob, ProductionDashboardPayload } from "../../../production-dashboard-types";
import K2Icon from "../../../K2Icon";

const pageSize = 9;
const screenLabels: Record<DashboardDepartment, { eyebrow: string; title: string }> = {
  print_cut: { eyebrow: "PRINT & CUT", title: "งานรอผลิต" },
  pack: { eyebrow: "PACK", title: "งานรอแพ็ก" },
  sale: { eyebrow: "SALE", title: "แนะนำวันลงคิว" },
};

function thaiDate(value: string, long = false) {
  if (!value) return "รอยืนยัน";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: long ? "long" : "short", year: "2-digit" }).format(new Date(`${value}T12:00:00+07:00`));
}

function fallbackImage(job: ProductionDashboardJob) {
  const name = job.productName.toLowerCase();
  if (job.productCategory === "acrylic_keychain" || name.includes("สติกเกอร์") || name.includes("พวงกุญแจ")) return "/assets/k2studio/category-keychains-v1.webp";
  if (name.includes("กระเป๋า")) return "/assets/k2studio/category-bags-v1.webp";
  if (name.includes("แก้ว")) return "/assets/k2studio/category-drinkware-v1.webp";
  if (name.includes("หมวก") || name.includes("เสื้อ")) return "/assets/k2studio/category-apparel-v1.webp";
  if (name.includes("สมุด") || name.includes("ปากกา")) return "/assets/k2studio/category-stationery-v1.webp";
  return "/assets/k2studio/hero-products-v1.webp";
}

function jobStatus(job: ProductionDashboardJob, department: DashboardDepartment) {
  if (job.status === "ready_to_ship") return { label: "พร้อมส่ง", tone: "complete" };
  if (department === "pack" || ["packing", "waiting_for_packing"].includes(job.status)) return { label: job.status === "packing" ? "กำลังแพ็ก" : "รอแพ็ก", tone: job.status === "packing" ? "working" : "waiting" };
  if (job.status === "in_production") return { label: "กำลังผลิต", tone: "working" };
  return { label: "รอผลิต", tone: "waiting" };
}

export default function DepartmentDashboard({ initialData, canUpdate, canManage }: { initialData: ProductionDashboardPayload; canUpdate: boolean; canManage: boolean }) {
  const [payload, setPayload] = useState(initialData);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ProductionDashboardJob | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const department = payload.department;

  async function refresh() {
    const response = await fetch(`/api/admin/production/dashboard?department=${department}`, { cache: "no-store" });
    if (!response.ok) return;
    const next = await response.json() as ProductionDashboardPayload;
    setPayload(next);
    setSelected((current) => current ? next.jobs.find((job) => job.id === current.id) || null : null);
  }

  useEffect(() => {
    setNow(new Date());
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    const fallback = window.setInterval(refresh, 60000);
    const liveUpdate = () => void refresh();
    window.addEventListener("k2-production-queue-updated", liveUpdate);
    return () => { window.clearInterval(clock); window.clearInterval(fallback); window.removeEventListener("k2-production-queue-updated", liveUpdate); };
  }, [department]);

  const ordered = useMemo(() => [...payload.jobs].sort((a, b) => {
    const urgentA = a.priority === "urgent" || !["none", "rejected"].includes(a.rushStatus) ? 0 : 1;
    const urgentB = b.priority === "urgent" || !["none", "rejected"].includes(b.rushStatus) ? 0 : 1;
    return urgentA - urgentB || (a.queueRank || 9999) - (b.queueRank || 9999) || a.deliveryDate.localeCompare(b.deliveryDate) || a.id - b.id;
  }), [payload.jobs]);
  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));
  const waitingCount = ordered.filter((job) => jobStatus(job, department).tone === "waiting").length;
  const workingCount = ordered.filter((job) => jobStatus(job, department).tone === "working").length;
  const completeCount = ordered.filter((job) => jobStatus(job, department).tone === "complete").length;
  const totalCount = Math.max(ordered.length, 1);
  const progress = Math.round(completeCount / totalCount * 100);
  const urgentJob = ordered.find((job) => job.priority === "urgent" || !["none", "rejected"].includes(job.rushStatus)) || ordered[0];

  useEffect(() => { if (page >= pageCount) setPage(0); }, [page, pageCount]);
  useEffect(() => {
    if (pageCount <= 1 || selected) return;
    const timer = window.setInterval(() => setPage((value) => (value + 1) % pageCount), 10000);
    return () => window.clearInterval(timer);
  }, [pageCount, selected]);

  async function action(name: "complete" | "remove" | "update_metadata", values: Record<string, unknown> = {}) {
    if (!selected) return;
    setSaving(true); setMessage("กำลังบันทึก…");
    const response = await fetch("/api/admin/production/queue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workOrderId: selected.id, department, action: name, ...values }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) { setMessage(result.error || "บันทึกไม่สำเร็จ"); return; }
    setMessage(name === "complete" ? department === "print_cut" ? "ย้ายงานไปห้อง Pack แล้ว" : "อัปเดตเป็นพร้อมส่งแล้ว" : "บันทึกแล้ว");
    await refresh();
    if (name !== "update_metadata") window.setTimeout(() => { setSelected(null); setMessage(""); }, 700);
  }

  if (department === "sale") {
    return <section className="departmentTvSale">
      <div className="saleRecommendation"><span>วันที่แนะนำเร็วที่สุด</span><strong>{thaiDate(payload.recommendedDate, true)}</strong><p>วันที่โหลดรวมต่ำกว่า 70% เหมาะสำหรับฝ่ายขายรับคิวใหม่ โดยต้องยืนยันกับฝ่ายผลิตก่อนแจ้งลูกค้า</p></div>
      <div className="saleCapacityGrid">{payload.saleCapacity.map((day) => <article className={day.state} key={day.date}><span>{thaiDate(day.date)}</span><strong>{day.percent}%</strong><b>{day.jobCount} งาน</b><div><i style={{ width: `${Math.min(day.percent, 100)}%` }} /></div><small>{day.state === "available" ? "ลงคิวได้" : day.state === "busy" ? "เริ่มแน่น" : day.state === "nearly_full" ? "เกือบเต็ม" : "เต็ม"}</small></article>)}</div>
    </section>;
  }

  const visible = ordered.slice(page * pageSize, page * pageSize + pageSize);
  return <>
    <section className="k2OpsHero">
      <header><div className="k2GroupLogo"><strong>K2<span>GROUP</span></strong><small>PEOPLE · PROCESS · GREAT MERCH</small></div><div className="k2OpsDate"><span>{thaiDate(payload.date, true)}</span><b>{now ? now.toLocaleDateString("th-TH", { weekday: "long" }) : ""}</b></div><a href="/admin" className="k2OpsAvatar" aria-label="กลับหน้าระบบหลังบ้าน"><K2Icon name="users"/><i/></a></header>
      <div className="k2OpsHeading"><h1>{department === "print_cut" ? <>ผลิตให้สำเร็จ<br/>ส่งต่อความพิเศษ</> : <>แพ็กให้เรียบร้อย<br/>พร้อมส่งถึงลูกค้า</>}</h1><span>Good Merch<br/>Brighter People</span></div>
      <div className="k2OpsProgress">
        <div className="k2OpsRing" style={{ "--progress": `${progress * 3.6}deg` } as CSSProperties}><div><span>งานในคิว</span><strong>{progress}%</strong><small>เสร็จแล้ว<br/>{completeCount} / {ordered.length} งาน</small></div></div>
        <div className="k2OpsStats"><article className="blue"><K2Icon name="package"/><span>{department === "print_cut" ? "รอผลิต" : "รอแพ็ก"}<strong>{waitingCount}</strong></span></article><article className="yellow"><K2Icon name="gear"/><span>{department === "print_cut" ? "กำลังผลิต" : "กำลังแพ็ก"}<strong>{workingCount}</strong></span></article><article className="lime"><K2Icon name="check"/><span>{department === "print_cut" ? "ผลิตเสร็จ" : "พร้อมส่ง"}<strong>{completeCount}</strong></span></article></div>
      </div>
    </section>
    {urgentJob && <button className="k2OpsUrgent" type="button" onClick={() => { setSelected(urgentJob); setMessage(""); }}><div><span><K2Icon name="flame"/>งาน{urgentJob.priority === "urgent" ? "ด่วน" : "ลำดับแรก"}<K2Icon name="chevron"/></span><strong>#{urgentJob.orderNumber}</strong><p>{urgentJob.productName} {urgentJob.quantity.toLocaleString("th-TH")} ชิ้น</p><em>{urgentJob.deliveryDate === payload.date ? "ต้องเสร็จวันนี้" : `ส่ง ${thaiDate(urgentJob.deliveryDate)}`}</em></div><div className={`k2OpsSteps ${jobStatus(urgentJob, department).tone}`}><span className="done"><K2Icon name="check"/>รับไฟล์</span><span className={jobStatus(urgentJob, department).tone !== "waiting" ? "done" : "current"}><K2Icon name={jobStatus(urgentJob, department).tone === "waiting" ? "clock" : "check"}/>ผลิต</span><span className={department === "pack" || jobStatus(urgentJob, department).tone === "complete" ? "done" : "current"}><K2Icon name={department === "pack" || jobStatus(urgentJob, department).tone === "complete" ? "check" : "clock"}/>ตรวจสอบ</span><span className={jobStatus(urgentJob, department).tone === "complete" ? "done" : ""}><K2Icon name={jobStatus(urgentJob, department).tone === "complete" ? "check" : "clock"}/>แพ็ก/ส่ง</span></div></button>}
    <section className="k2OpsCapacity"><div><strong>คิวงาน{department === "print_cut" ? "ผลิต" : "แพ็ก"}</strong><span>งานในระบบ <b>{ordered.length} งาน</b></span><b>{Math.min(100, Math.round(ordered.length / 100 * 100))}%</b></div><progress value={Math.min(ordered.length, 100)} max="100">{ordered.length}%</progress></section>
    <section className="k2OpsJobs" aria-label={screenLabels[department].title}>
      <header><h2>รายการงานวันนี้</h2><span>แตะสถานะเพื่ออัปเดต</span></header>
      <div>{visible.length ? visible.map((job) => {
        const urgent = job.priority === "urgent" || !["none", "rejected"].includes(job.rushStatus);
        const dueToday = job.deliveryDate === payload.date;
        const overdue = Boolean(job.deliveryDate) && job.deliveryDate < payload.date;
        const status = jobStatus(job, department);
        return <article className={`${urgent ? "urgent" : ""} ${dueToday ? "dueToday" : ""} ${overdue ? "overdue" : ""}`} key={job.id}>
          <img src={job.imageUrl} alt={job.productName} onError={(event) => { event.currentTarget.src = fallbackImage(job); }}/>
          <div><p>{overdue && <b className="departmentOverdueMark" aria-label="เลยกำหนดส่ง">!</b>}<strong>#{job.orderNumber}</strong>{urgent && <em>ด่วน</em>}{overdue && <em className="overdue">เลยกำหนด</em>}</p><span>{job.productName}</span><small>{job.quantity.toLocaleString("th-TH")} ชิ้น · ส่ง {thaiDate(job.deliveryDate)}</small>{job.dashboardNote && <small className="note">โน้ต: {job.dashboardNote}</small>}</div>
          <button className={`k2OpsStatus ${status.tone}`} type="button" onClick={() => { setSelected(job); setMessage(""); }}>{status.label}<K2Icon name="chevron"/></button>
        </article>;
      }) : <div className="k2OpsEmpty"><K2Icon name="check"/><b>{department === "print_cut" ? "ไม่มีงานรอผลิต" : "ไม่มีงานรอแพ็ก"}</b><span>ระบบจะอัปเดตทันทีเมื่อมีงานเข้าคิว</span></div>}</div>
    </section>
    {pageCount > 1 && <nav className="departmentTvPager" aria-label="หน้าคิวงาน">{Array.from({ length: pageCount }, (_, index) => <button type="button" aria-label={`หน้า ${index + 1}`} className={page === index ? "active" : ""} onClick={() => setPage(index)} key={index}>{index + 1}</button>)}</nav>}
    {selected && <div className="departmentJobModal" role="dialog" aria-modal="true" aria-labelledby="department-job-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
      <article>
        <button className="departmentModalClose" type="button" onClick={() => setSelected(null)} aria-label="ปิด">ปิด</button>
        <span>{screenLabels[department].eyebrow} • ลำดับ {ordered.findIndex((job) => job.id === selected.id) + 1}</span>
        <h2 id="department-job-title">{selected.orderNumber}</h2>
        <p>{selected.productName} • {selected.quantity.toLocaleString("th-TH")} ชิ้น • ส่ง {thaiDate(selected.deliveryDate)}</p>
        {selected.dashboardNote && <div className="departmentModalNote"><b>โน้ตจากผู้ดูแล</b><p>{selected.dashboardNote}</p></div>}
        {canManage && <form className="departmentQueueEdit" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void action("update_metadata", { note: data.get("note"), queueRank: data.get("queueRank"), priority: data.get("priority") }); }}>
          <label>โน้ตสำหรับทีมงาน<textarea name="note" rows={2} defaultValue={selected.dashboardNote} placeholder="เช่น เช็กสีโลโก้ก่อนเริ่มพิมพ์" /></label>
          <label>ลำดับคิว<input name="queueRank" type="number" min="0" max="9999" defaultValue={selected.queueRank || 0} /></label>
          <label>ความเร่งด่วน<select name="priority" defaultValue={selected.priority}><option value="normal">ปกติ</option><option value="high">สำคัญ</option><option value="urgent">ด่วน</option></select></label>
          <button type="submit" disabled={saving}>บันทึกโน้ต / แทรกลำดับ</button>
        </form>}
        <div className="departmentModalActions">
          {canUpdate && !(department === "pack" && selected.status === "ready_to_ship") && <button className="complete" type="button" disabled={saving} onClick={() => void action("complete")}>{department === "print_cut" ? "ผลิตเสร็จแล้ว → ส่งห้อง Pack" : "แพ็กเสร็จแล้ว → พร้อมส่ง"}</button>}
          <a href={`/admin/orders/${selected.orderId}`}>เปิดข้อมูลเพิ่มเติม</a>
          {canManage && <form onSubmit={(event) => { event.preventDefault(); const reason = String(new FormData(event.currentTarget).get("reason") || ""); void action("remove", { note: reason }); }}><input name="reason" required minLength={3} placeholder="เหตุผลที่นำออกจากคิว"/><button type="submit" disabled={saving}>นำออกจากคิว</button></form>}
        </div>
        {message && <p className="departmentModalMessage" role="status">{message}</p>}
      </article>
    </div>}
    <nav className="k2OpsBottom" aria-label="เมนูฝ่ายผลิต"><a className="active" href="/admin/production/tv?department=print_cut"><K2Icon name="chart"/><span>ภาพรวม</span></a><a href="/admin/production/today"><K2Icon name="clipboard"/><span>งานวันนี้</span></a><a href="/admin/production/tv?department=pack"><K2Icon name="package"/><span>ห้องแพ็ก</span></a><a href="/admin/production/calendar"><K2Icon name="clock"/><span>ปฏิทิน</span></a><a href="/admin"><K2Icon name="grid"/><span>เพิ่มเติม</span></a></nav>
  </>;
}
