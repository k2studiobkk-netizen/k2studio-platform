"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { displayModeLabels, priorityLabels, type BroadcastDisplayMode, type BroadcastPriority } from "../../../broadcast-types";

type Screen = { screen_key: string; name: string; department: string; last_seen_at: string };
type History = {
  id: number; title: string; message: string; priority: BroadcastPriority; sender_name: string; display_mode: BroadcastDisplayMode;
  target_scope: string; target_department: string; target_screen: string; expire_at: string; status: string; created_at: string;
  acknowledgement_count: number; acknowledgement_details: string; display_status: string;
};

export default function BroadcastManager({ screens, history }: { screens: Screen[]; history: History[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [targetScope, setTargetScope] = useState("all");
  const [untilDismissed, setUntilDismissed] = useState(false);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage("กำลังส่งไปยังจอทีวี…");
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: data.get("title"), message: data.get("message"), priority: data.get("priority"), displayMode: data.get("display_mode"),
        targetScope, targetDepartment: data.get("target_department"), targetScreen: data.get("target_screen"),
        durationMinutes: data.get("duration_minutes"), untilDismissed,
      }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string; delivered?: number };
    setSaving(false);
    if (!response.ok) { setMessage(result.error || "ส่งประกาศไม่สำเร็จ"); return; }
    setMessage(`ส่งเรียบร้อย • จอที่ออนไลน์ได้รับทันที ${result.delivered || 0} จอ`);
    form.reset(); setTargetScope("all"); setUntilDismissed(false);
    setTimeout(() => router.refresh(), 500);
  }

  async function close(id: number) {
    const response = await fetch(`/api/admin/broadcast/${id}/close`, { method: "POST" });
    const result = await response.json().catch(() => ({})) as { error?: string };
    setMessage(response.ok ? "ปิดประกาศทุกจอแล้ว" : result.error || "ปิดประกาศไม่สำเร็จ");
    if (response.ok) router.refresh();
  }

  return <>
    <form className="broadcastComposer" onSubmit={send}>
      <div className="broadcastComposerHeading"><div><span>LIVE BROADCAST</span><h2>Broadcast Message</h2><p>ข้อความจะปรากฏบนจอเป้าหมายทันทีโดยไม่ต้อง Refresh</p></div><a href="/admin/production/tv?department=print_cut" target="_blank" rel="noreferrer">เปิดหน้าจอ TV ↗</a></div>
      <label>หัวข้อประกาศ<input name="title" required maxLength={120} placeholder="เช่น หยุดเครื่อง UV ชั่วคราว" /></label>
      <label className="wide">ข้อความ<textarea name="message" required maxLength={1200} rows={4} placeholder="รายละเอียดที่ต้องการแจ้งทีมงาน" /></label>
      <label>ระดับความสำคัญ<select name="priority" defaultValue="normal"><option value="normal">ทั่วไป</option><option value="important">สำคัญ</option><option value="urgent">ด่วน</option><option value="critical">วิกฤต</option></select></label>
      <label>รูปแบบแสดงผล<select name="display_mode" defaultValue="top_banner"><option value="top_banner">แถบด้านบน</option><option value="bottom_ticker">ข้อความวิ่งด้านล่าง</option><option value="large_center">แจ้งเตือนกลางจอ</option><option value="fullscreen">ฉุกเฉินเต็มจอ</option></select></label>
      <label>ส่งไปยัง<select value={targetScope} onChange={(event) => setTargetScope(event.target.value)}><option value="all">ทุกจอ</option><option value="department">เฉพาะแผนก</option><option value="screen">เฉพาะจอที่เลือก</option></select></label>
      {targetScope === "department" && <label>แผนก<select name="target_department" required defaultValue="print_cut"><option value="print_cut">Print &amp; Cut</option><option value="pack">Pack</option><option value="sale">Sale</option></select></label>}
      {targetScope === "screen" && <label>จอเป้าหมาย<select name="target_screen" required defaultValue=""><option value="" disabled>เลือกจอ</option>{screens.map((screen) => <option key={screen.screen_key} value={screen.screen_key}>{screen.name} — {screen.department}</option>)}</select></label>}
      <label>ระยะเวลา (นาที)<input name="duration_minutes" type="number" min="1" max="1440" defaultValue="5" disabled={untilDismissed} /></label>
      <label className="broadcastUntil"><input type="checkbox" checked={untilDismissed} onChange={(event) => setUntilDismissed(event.target.checked)} /><span><b>แสดงจนกว่าจะกดปิด</b><small>ไม่มีเวลาหมดอายุอัตโนมัติ</small></span></label>
      <button className="broadcastSend" disabled={saving}>{saving ? "กำลังส่ง…" : "Broadcast Message"}</button>
      {message && <p className="broadcastFormMessage" role="status">{message}</p>}
    </form>
    <section className="broadcastHistory"><header><span>BROADCAST HISTORY</span><h2>ประวัติการประกาศ</h2></header>{history.length ? <div className="broadcastHistoryList">{history.map((item) => <article key={item.id} className={`broadcastHistoryItem ${item.priority}`}><div><span>{priorityLabels[item.priority]} • {displayModeLabels[item.display_mode]}</span><h3>{item.title}</h3><p>{item.message}</p></div><dl><div><dt>ผู้ส่ง</dt><dd>{item.sender_name}</dd></div><div><dt>เวลา</dt><dd>{item.created_at}</dd></div><div><dt>หมดอายุ</dt><dd>{item.expire_at || "จนกว่าจะปิด"}</dd></div><div><dt>เป้าหมาย</dt><dd>{item.target_scope === "all" ? "ทุกจอ" : item.target_department || item.target_screen}</dd></div><div><dt>รับทราบ</dt><dd>{item.acknowledgement_count || 0} ครั้ง</dd></div></dl><div className="broadcastHistoryState"><b>{item.display_status === "active" ? "กำลังแสดง" : item.display_status === "expired" ? "หมดอายุแล้ว" : "สิ้นสุดแล้ว"}</b>{item.acknowledgement_details && <small>รับทราบ: {item.acknowledgement_details}</small>}{item.display_status === "active" && <button type="button" onClick={() => close(item.id)}>ปิดประกาศทุกจอ</button>}</div></article>)}</div> : <div className="productionEmpty">ยังไม่มีประวัติประกาศ</div>}</section>
  </>;
}
