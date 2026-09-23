"use client";

import { useState } from "react";

type Item = Record<string, string | number>;

export default function CapacityManager({ machines, processes, rules }: { machines: Item[]; processes: Item[]; rules: Item[] }) {
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setMessage("กำลังบันทึก…");
    const response = await fetch("/api/admin/production/capacity", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...data }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setMessage(response.ok ? "บันทึกแล้ว" : result.error || "บันทึกไม่สำเร็จ");
    if (response.ok) setTimeout(() => location.reload(), 600);
  }
  return <div className="capacityManager">
    {message && <div className="capacityMessage" role="status">{message}</div>}
    <section className="capacityForms">
      <form onSubmit={(event) => submit(event, "machine")}><span>MACHINE</span><h2>เพิ่มหรือแก้เครื่องจักร</h2><p>ใช้รหัสเดิมเพื่อแก้ไขค่าของเครื่องที่มีอยู่</p>
        <label>รหัสเครื่อง<input name="code" required pattern="[A-Za-z0-9_-]{2,30}" placeholder="UV-A" /></label>
        <label>ชื่อเครื่อง<input name="name" required placeholder="UV Printer A" /></label>
        <label>แผนก<input name="department" placeholder="Printing" /></label>
        <label>เวลาทำงานต่อวัน (นาที)<input name="dailyCapacityMinutes" type="number" min="30" max="1440" defaultValue="480" required /></label>
        <div className="thresholdRow"><label>Busy %<input name="busyThreshold" type="number" defaultValue="70" required /></label><label>Nearly Full %<input name="nearlyFullThreshold" type="number" defaultValue="90" required /></label><label>Full %<input name="fullThreshold" type="number" defaultValue="100" required /></label></div>
        <button>บันทึกเครื่องจักร</button>
      </form>
      <form onSubmit={(event) => submit(event, "process")}><span>PROCESS</span><h2>เพิ่มหรือแก้กระบวนการ</h2>
        <label>รหัสกระบวนการ<input name="code" required pattern="[A-Za-z0-9_-]{2,30}" placeholder="UV-PRINT" /></label>
        <label>ชื่อกระบวนการ<input name="name" required placeholder="พิมพ์ UV" /></label>
        <label>ลำดับงาน<input name="sequenceNo" type="number" min="0" defaultValue="10" /></label>
        <button>บันทึกกระบวนการ</button>
      </form>
      <form onSubmit={(event) => submit(event, "rule")}><span>CAPACITY RULE</span><h2>มาตรฐานกำลังผลิต</h2>
        <label>เครื่องจักร<select name="machineId" required defaultValue=""><option value="" disabled>เลือกเครื่อง</option>{machines.map((item) => <option key={String(item.id)} value={item.id}>{item.code} — {item.name}</option>)}</select></label>
        <label>กระบวนการ<select name="processId" defaultValue=""><option value="">ใช้ทุกกระบวนการ</option>{processes.map((item) => <option key={String(item.id)} value={item.id}>{item.code} — {item.name}</option>)}</select></label>
        <label>หน่วย<select name="capacityUnit"><option value="items">ชิ้น</option><option value="sheets">แผ่น</option><option value="sets">ชุด</option><option value="hours">ชั่วโมง</option></select></label>
        <label>ทำได้ต่อชั่วโมง<input name="unitsPerHour" type="number" min="0.01" step="0.01" required /></label>
        <label>เวลาเตรียมเครื่อง (นาที)<input name="setupMinutes" type="number" min="0" defaultValue="0" /></label>
        <label>หมายเหตุ<textarea name="notes" rows={2} /></label><button>เพิ่ม Capacity Rule</button>
      </form>
    </section>
    <section className="capacityLists"><article><h2>เครื่องจักร</h2>{machines.length ? machines.map((item) => <div key={String(item.id)}><b>{item.code} — {item.name}</b><span>{item.department || "ไม่ระบุแผนก"} • {item.daily_capacity_minutes} นาที/วัน</span><small>Busy {item.busy_threshold}% • Nearly Full {item.nearly_full_threshold}% • Full {item.full_threshold}%</small></div>) : <p>ยังไม่มีเครื่องจักร</p>}</article>
    <article><h2>กฎ Capacity</h2>{rules.length ? rules.map((item) => <div key={String(item.id)}><b>{item.machine_name} • {item.process_name || "ทุกกระบวนการ"}</b><span>{item.units_per_hour} {item.capacity_unit}/ชั่วโมง • Setup {item.setup_minutes} นาที</span><small>{item.notes || "ไม่มีหมายเหตุ"}</small></div>) : <p>ยังไม่มีกฎ Capacity</p>}</article></section>
  </div>;
}
