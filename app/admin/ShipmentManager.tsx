"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ShipmentList from "../ShipmentList";
import { MAX_SHIPMENT_ROWS, normalizeShipment, parseOrderPlusSheet, parseOrderPlusText, type Shipment, type ShipmentInput, type ShipmentPreview } from "../shipment-input";

type Props = { orderId?: number; orderCode?: string; shipments?: Shipment[]; canManage: boolean };
const empty: ShipmentInput = { orderCode: "", carrier: "", trackingNumber: "", reference: "" };

export default function ShipmentManager({ orderId, orderCode = "", shipments = [], canManage }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(!orderId);
  const [text, setText] = useState("");
  const [form, setForm] = useState<ShipmentInput>({ ...empty, orderCode });
  const [rows, setRows] = useState<ShipmentPreview[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [voidId, setVoidId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const invalidate = () => { setRows([]); setSelected([]); setMessage(""); };
  async function request(body: object) {
    const response = await fetch("/api/admin/shipments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") throw new Error("ระบบตอบกลับไม่ถูกต้อง กรุณาลองใหม่");
    const data = payload as Record<string, unknown>;
    if (typeof data.error === "string") throw new Error(data.error);
    return { rows: (Array.isArray(data.rows) ? data.rows : []) as ShipmentPreview[], ok: data.ok === true, saved: Number(data.saved || 0) };
  }
  async function preview(input: ShipmentInput[]) {
    setBusy(true); setMessage(""); setRows([]);
    try {
      const data = await request({ action: "preview", rows: input, ...(orderId ? { orderId } : {}) });
      setRows(data.rows); setSelected(data.rows.filter((r: ShipmentPreview) => r.status === "ready").map((r: ShipmentPreview) => r.index));
    } catch (e) { setMessage(e instanceof Error ? e.message : "ตรวจสอบไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file) return;
    invalidate(); setBusy(true); setFileName(file.name);
    try {
      if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw new Error("รองรับไฟล์ .xlsx ขนาดไม่เกิน 5 MB");
      const { readSheet } = await import("read-excel-file/browser");
      const data = await readSheet(file);
      await preview(parseOrderPlusSheet(data));
    } catch (e) { setMessage(e instanceof Error ? e.message : "อ่านไฟล์ไม่สำเร็จ กรุณาตรวจว่าเป็นไฟล์ Order Plus"); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!selected.length) return;
    setBusy(true); setMessage("");
    try {
      const data = await request({ action: "save", rows: rows.filter(r => selected.includes(r.index)).map(r => ({ ...normalizeShipment(r), expectedOrderId: r.orderId })), ...(orderId ? { orderId } : {}) });
      setRows([]); setSelected([]);
      setMessage(data.ok ? `✓ บันทึก ${data.saved} รายการแล้ว ลูกค้าดูเลขพัสดุได้จากลิงก์เดิม` : `บันทึก ${data.saved} รายการ มีข้อมูลเปลี่ยนระหว่างทำรายการ กรุณาตรวจสอบใหม่`);
      if (data.ok) { setText(""); setForm({ ...empty, orderCode }); }
      router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function voidNumber() {
    setBusy(true);
    try {
      const data = await request({ action: "void", id: voidId, reason });
      if (!data.ok) throw new Error("ข้อมูลเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่");
      setVoidId(null); setReason(""); invalidate(); setMessage("ยกเลิกเลขเดิมแล้ว ประวัติยังอยู่ สามารถเพิ่มเลขที่ถูกต้องได้"); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "แก้ไขไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <section className="parcelPanel" id="shipments">
    <header><div><span className="parcelEyebrow">SHIPPING · ORDER PLUS</span><h2>เลขพัสดุและการจัดส่ง</h2><p>ใช้ลิงก์ติดตามเดิมของลูกค้า ไม่ต้องส่งลิงก์ใบงานใหม่</p></div>{canManage && orderId && <button type="button" className="parcelPrimary" onClick={() => setOpen(!open)}>{open ? "ปิดช่องเพิ่ม" : "+ เพิ่มเลขพัสดุ"}</button>}</header>
    {orderId && <ShipmentList shipments={shipments}/>}
    {canManage && open && <div className="parcelEditor">
      <div className="parcelSteps" aria-label="ขั้นตอนการเพิ่มเลขพัสดุ"><span className="parcelStep active"><b>1</b> เลือกวิธีเพิ่ม</span><span className="parcelStep"><b>2</b> ตรวจสอบข้อมูล</span><span className="parcelStep"><b>3</b> ยืนยันบันทึก</span></div>
      {!orderId && <div className="parcelUpload parcelMethodCard"><div className="parcelMethodTitle"><span className="parcelMethodIcon">↥</span><div><strong>นำเข้า Excel จาก Order Plus</strong><span>เหมาะสำหรับหลายรายการในครั้งเดียว</span></div></div><p>ใส่รหัสใบงาน เช่น <b>K2-1248</b> ในนามสกุลลูกค้า • สูงสุด {MAX_SHIPMENT_ROWS} แถวต่อครั้ง</p><label className="parcelFileButton" htmlFor="parcel-xlsx">เลือกไฟล์ Excel (.xlsx)<input id="parcel-xlsx" type="file" accept=".xlsx" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }}/></label>{fileName && <small className="parcelFileName">✓ {fileName} • อ่านชีตแรกแล้ว</small>}</div>}
      <details open={Boolean(orderId)} className="parcelPaste parcelMethodCard"><summary><span className="parcelMethodTitle"><span className="parcelMethodIcon">＋</span><span><strong>{orderId ? "เพิ่มเลขพัสดุให้ใบงานนี้" : "เพิ่มทีละรายการ / วางข้อความ Order Plus"}</strong><small>กรอกเองได้ หรือคัดลอกข้อความจาก Order Plus</small></span></span></summary>
        <div className="parcelPasteBody"><label><span>วางข้อความจาก Order Plus <em>(ถ้ามี)</em></span><textarea aria-label="ข้อความ Order Plus" rows={4} value={text} maxLength={10000} disabled={busy} onChange={e => { setText(e.target.value); invalidate(); }} placeholder="วางข้อความที่มี จัดส่งโดย และเลขพัสดุ"/></label>
        <button type="button" className="parcelSecondary" disabled={busy || !text.trim()} onClick={() => { const parsed = parseOrderPlusText(text); setForm({ ...parsed, orderCode: parsed.orderCode || orderCode }); invalidate(); }}>อ่านข้อมูลจากข้อความ</button>
        <div className="parcelFields">{([["orderCode", "รหัสใบงาน"], ["carrier", "ขนส่ง"], ["trackingNumber", "เลขพัสดุ / เลขแทร็ก"], ["reference", "เลขอ้างอิง Order Plus (ถ้ามี)"]] as const).map(([key, label]) => <label key={key}>{label}<input value={form[key]} aria-label={label} maxLength={key === "reference" ? 80 : 60} disabled={busy} autoCapitalize={key === "carrier" ? "words" : "characters"} autoComplete="off" onChange={e => { setForm({ ...form, [key]: e.target.value }); invalidate(); }}/></label>)}</div>
        <button type="button" className="parcelPrimary parcelConfirmButton" disabled={busy} onClick={() => void preview([form])}>{busy ? "กำลังตรวจสอบ…" : "ตรวจสอบข้อมูลก่อนบันทึก"}</button></div>
      </details>
      <p className="parcelNotice">การเพิ่มเลขพัสดุไม่เปลี่ยนสถานะงานหรือยอดเงิน และไม่ได้ยืนยันว่าส่งสินค้าแล้ว</p>
    </div>}
    {busy && <p role="status">กำลังอ่านและตรวจสอบข้อมูล กรุณารอสักครู่…</p>}
    {rows.length > 0 && <div className="parcelReview"><h3>ตรวจสอบใบงานและเลขพัสดุก่อนยืนยัน</h3><p>พร้อม {rows.filter(r => r.status === "ready").length} • ซ้ำ {rows.filter(r => r.status === "duplicate").length} • ต้องตรวจสอบ {rows.filter(r => r.status === "blocked").length}</p>
      {rows.map(r => <label className={`parcelReviewRow ${r.status}`} key={r.index}><input type="checkbox" aria-label={`เลือกรายการ ${r.orderCode || r.index + 1}`} checked={selected.includes(r.index)} disabled={busy || r.status !== "ready"} onChange={e => setSelected(e.target.checked ? [...selected, r.index] : selected.filter(i => i !== r.index))}/><div><b>{r.orderCode || "ไม่มีรหัสใบงาน"} {r.orderId && <a href={`/admin/orders/${r.orderId}`} target="_blank" rel="noreferrer">เปิดใบงาน ↗</a>}</b>{r.customer && <span>{r.customer}</span>}<strong>{r.carrier} · {r.trackingNumber || "ไม่มีเลขพัสดุ"}</strong><small>{r.reference ? `Order Plus: ${r.reference} · ` : ""}{r.message}</small></div></label>)}
      <button type="button" className="parcelPrimary" disabled={busy || !selected.length} onClick={() => void save()}>{busy ? "กำลังบันทึก…" : `ยืนยันบันทึก ${selected.length} รายการ`}</button>
    </div>}
    {message && <p className="parcelFeedback" role="status">{message}</p>}
    {canManage && shipments.some(s => !s.voided_at) && <details className="parcelHistory"><summary>แก้เลขผิด / ยกเลิกเลขเดิม</summary><p>ยกเลิกพร้อมเหตุผลก่อนเพิ่มเลขใหม่ ประวัติจะไม่ถูกลบ</p>{shipments.filter(s => !s.voided_at).map(s => <div key={s.id}><span>{s.carrier} · {s.tracking_number}</span><button type="button" disabled={busy} onClick={() => { setVoidId(s.id); setReason(""); }}>ยกเลิกเลขนี้</button></div>)}{voidId && <div className="parcelVoid"><label>เหตุผล<input value={reason} maxLength={300} onChange={e => setReason(e.target.value)} placeholder="เช่น กรอกเลขผิด"/></label><button disabled={busy || reason.trim().length < 3} onClick={() => void voidNumber()}>ยืนยันยกเลิกเลขพัสดุ</button><button onClick={() => setVoidId(null)}>กลับ</button></div>}</details>}
    {!!shipments.length && <details className="parcelHistory"><summary>ประวัติการบันทึกเลขพัสดุ ({shipments.length})</summary>{shipments.map(s => <p key={s.id}><b>{s.tracking_number}</b> · {s.created_by_name} · {new Date(`${s.created_at.replace(" ", "T")}Z`).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}{s.voided_at ? ` · ยกเลิก: ${s.void_reason}` : " · ใช้งานอยู่"}</p>)}</details>}
    {orderId && <a className="parcelBulkLink" href="/admin/shipments">เปิดศูนย์เลขพัสดุ / นำเข้า Excel →</a>}
  </section>;
}
