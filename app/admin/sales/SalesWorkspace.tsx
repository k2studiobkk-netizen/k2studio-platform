"use client";
import { useState } from "react";
import K2Icon from "../../K2Icon";
import { makeSalesCaption, salesKitProducts } from "../../sales-kit.mjs";

export type RankingRow = { id: number | string; label: string; sales: number; orders: number; outstanding: number };
export type SalesData = {
  summary: { sales: number; orders: number; received: number; outstanding: number; average_order: number };
  daily: { day: string; sales: number; orders: number }[];
  sellers: RankingRow[]; channels: RankingRow[];
  products: { id: string; label: string; quantity: number; sales: number }[];
  followups: { id: number; order_number: string; requested_date: string; owner_label: string; outstanding: number }[];
};
const money = (n: number) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function SalesWorkspace({ data, range, displayName, selfOnly, canManage, publicOrigin }: {
  data: SalesData; range: { start: string; end: string; today: string }; displayName: string;
  selfOnly: boolean; canManage: boolean; publicOrigin: string;
}) {
  const [tab, setTab] = useState("overview");
  return <main className="salesWorkspace">
    <header className="salesHeader"><div><a href="/admin">← หลังบ้าน</a><span className="salesEyebrow">K2GROUP / SALES WORKSPACE</span><h1>เติบโตไปด้วยกัน<span className="salesAccent">.</span></h1><p>{displayName} · {selfOnly ? "ดูเฉพาะยอดขายของคุณ" : "ภาพรวมยอดขายของร้าน"}</p></div><a className="salesPrimary" href="/admin/orders/new"><K2Icon name="plus"/>สร้างใบงาน</a></header>
    <nav className="salesTabs" aria-label="ส่วนงานขาย"><button type="button" aria-current={tab === "overview" ? "page" : undefined} onClick={() => setTab("overview")}><K2Icon name="chart"/>ภาพรวมการขาย</button><button type="button" aria-current={tab === "tools" ? "page" : undefined} onClick={() => setTab("tools")}><K2Icon name="package"/>เครื่องมือช่วยขาย</button>{canManage && <a href="/admin/sales/lab"><K2Icon name="gear"/>ทดลองเรตผลตอบแทน</a>}</nav>
    {tab === "overview" ? <>
      <form className="salesDateFilter" method="get"><label>ตั้งแต่<input type="date" name="from" defaultValue={range.start} max={range.today} required/></label><label>ถึง<input type="date" name="to" defaultValue={range.end} max={range.today} required/></label><button className="salesPrimary" type="submit">ดูข้อมูล</button><a href="/admin/sales">เดือนนี้</a></form>
      <section className="salesKpis" aria-label="ตัวเลขภาพรวม"><article className="salesKpiHero"><span>ยอดขายตามใบงาน</span><strong>฿{money(data.summary.sales)}</strong><small>หัก VAT ที่บวกเพิ่มแล้ว · ไม่รวมค่าส่ง / งานยกเลิก</small></article><article><span>ยอดรับที่บันทึก</span><strong>฿{money(data.summary.received)}</strong><small>ตามวันที่รับเงิน รวมงวดของใบงานเก่า · ก่อนคืนเงิน</small></article><article><span>ยอดค้าง</span><strong>฿{money(data.summary.outstanding)}</strong><small>เฉพาะใบงานที่สร้างในช่วงนี้</small></article><article><span>จำนวนใบงาน</span><strong>{data.summary.orders}</strong><small>เฉลี่ย ฿{money(data.summary.average_order)} / ใบงาน</small></article></section>
      <p className="salesHelp">ยอดเพื่อบริหารการขาย ยังไม่ใช่ยอดรายได้สุทธิทางบัญชีหรือรายงานภาษี รายการที่ไม่บวก VAT เพิ่มยังต้องให้ฝ่ายบัญชีแยกต่อ</p>
      <div className="salesDashboardGrid"><section className="salesPanel"><header><div><span className="salesEyebrow">SALES TREND</span><h2>ยอดขายรายวัน</h2></div><small>บาท / วันที่สร้างใบงาน</small></header>{data.daily.length ? <div className="salesTrend">{data.daily.map(row => <div className="salesTrendRow" key={row.day}><span>{row.day.slice(5).replace("-", "/")}</span><div className="salesBarTrack"><i style={{ width: `${Math.max(0, row.sales) / Math.max(1, ...data.daily.map(r => r.sales)) * 100}%` }}/></div><b>฿{money(row.sales)}</b></div>)}</div> : <Empty/>}<p className="salesHelp">แสดงเฉพาะวันที่มีใบงาน ไม่ใช่กราฟเงินเข้าบัญชีธนาคาร</p></section>
        <section className="salesPanel salesFollowups"><header><div><span className="salesEyebrow">NEXT ACTION</span><h2>งานที่ควรติดตาม</h2></div></header>{data.followups.length ? data.followups.map(row => <a href={`/admin/orders/${row.id}`} key={row.id}><span><b>{row.order_number}</b><small>กำหนดส่ง {row.requested_date} · {row.owner_label}</small></span><strong>฿{money(row.outstanding)}</strong></a>) : <p>ไม่มีงานกำหนดส่งถึงวันที่เลือกที่ยังค้างชำระ</p>}<p className="salesHelp">รวมใบงานเก่าที่ถึงกำหนดส่งแล้ว · สูงสุด 12 งาน · เปิดใบงานตรวจยอดก่อนติดต่อลูกค้า</p></section>
        <Ranking title={selfOnly ? "ยอดขายของฉัน" : "ผลงานทีมขาย"} rows={data.sellers}/><Ranking title="ช่องทางที่สร้างยอดขาย" rows={data.channels}/>
        <section className="salesPanel"><header><h2>สัดส่วนสินค้า</h2></header>{data.products.length ? data.products.map(row => <div className="salesProductMetric" key={row.id}><div><b>{row.label}</b><span>{row.quantity.toLocaleString("th-TH")} ชิ้น</span></div><strong>{(row.sales / Math.max(1, data.products.reduce((a, b) => a + b.sales, 0)) * 100).toFixed(1)}%</strong></div>) : <Empty/>}<p className="salesHelp">สัดส่วนมูลค่ารายการที่บันทึก ก่อนส่วนลดรวม ค่าส่ง และภาษีที่บวกเพิ่ม</p></section>
        <section className="salesPanel salesCoach"><span className="salesEyebrow">ทีมขายทำอะไรต่อดี</span><h2>เปลี่ยนข้อมูลเป็นงานถัดไป</h2><p>{data.channels[0] ? `เริ่มเตรียมโพสต์สำหรับ ${data.channels[0].label} ซึ่งเป็นช่องทางยอดขายสูงสุดในช่วงนี้` : "เริ่มสร้างใบงานเพื่อให้มีข้อมูลสำหรับวิเคราะห์"}</p><p>ใช้ยอดขายประกอบกับต้นทุนและกำไร ไม่ตัดสินประสิทธิภาพจากยอดขายเพียงอย่างเดียว</p><button type="button" className="salesPrimary" onClick={() => setTab("tools")}>เตรียมโพสต์ขาย<K2Icon name="chevron"/></button></section>
      </div>
    </> : <SalesTools publicOrigin={publicOrigin}/>}
  </main>;
}
function Empty() { return <p className="salesEmpty">ยังไม่มีข้อมูลในช่วงวันที่เลือก</p>; }
function Ranking({ title, rows }: { title: string; rows: RankingRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.sales, 0);
  return <section className="salesPanel"><header><h2>{title}</h2></header>{rows.length ? rows.map((row, index) => <article className="salesRank" key={row.id}><div><span className="salesRankNumber">{index + 1}</span><b>{row.label}</b><strong>฿{money(row.sales)}</strong></div><div className="salesBarTrack"><i style={{ width: `${total > 0 ? row.sales / total * 100 : 0}%` }}/></div><small>{row.orders} ใบงาน · สัดส่วน {total > 0 ? (row.sales / total * 100).toFixed(1) : "0.0"}%</small></article>) : <Empty/>}</section>;
}
function SalesTools({ publicOrigin }: { publicOrigin: string }) {
  const [productId, setProductId] = useState("keychain"), [tone, setTone] = useState("friendly"), [campaign, setCampaign] = useState("");
  const [shareUrl, setShareUrl] = useState(""), [message, setMessage] = useState(""), [pending, setPending] = useState(false), [editedCaption, setEditedCaption] = useState<string | null>(null);
  const product = salesKitProducts.find(p => p.id === productId)!;
  const caption = editedCaption ?? makeSalesCaption(productId, tone, shareUrl || new URL(product.destination, publicOrigin).href);
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); setMessage("คัดลอกแล้ว พร้อมนำไปส่งหรือโพสต์"); } catch { setMessage("คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความแล้วคัดลอก"); } }
  async function createLink() {
    setPending(true); setMessage("");
    try { const response = await fetch("/api/admin/sales/links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId, campaign }) }); const result = await response.json() as { error?: string; url?: string }; if (!response.ok || typeof result.url !== "string") throw new Error(result.error || "สร้างลิงก์ไม่สำเร็จ"); setShareUrl(result.url); setEditedCaption(null); setMessage("สร้างลิงก์แล้ว ตรวจแคปชั่นก่อนนำไปใช้"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "สร้างลิงก์ไม่สำเร็จ"); } finally { setPending(false); }
  }
  return <section className="salesTools"><div className="salesPanel"><span className="salesEyebrow">SALES KIT</span><h2>เลือกรูป เตรียมข้อความ แชร์ได้เลย</h2><p>ใช้สื่อแบรนด์ที่อยู่บนเว็บไซต์ ไม่ดึงภาพลูกค้าหรือไฟล์ผลิตมาเผยแพร่</p><div className="salesCatalog">{salesKitProducts.map(p => <button type="button" key={p.id} disabled={pending} aria-pressed={productId === p.id} onClick={() => { setProductId(p.id); setShareUrl(""); setEditedCaption(null); setMessage(""); }}><img src={p.image} alt={p.name}/><b>{p.name}</b></button>)}</div><a className="salesPrimary" href={product.image} download={`K2STUDIO-${product.id}.png`}>ดาวน์โหลดภาพ {product.name}</a><p className="salesHelp">เป็นภาพตัวอย่างสินค้า ควรแจ้งลูกค้าว่ารายละเอียดและราคาต้องตรวจตามใบเสนอราคา</p></div>
    <div className="salesPanel"><h2>ลิงก์และแคปชั่นของคุณ</h2><label className="salesField">ชื่อแคมเปญ<input disabled={pending} value={campaign} maxLength={80} placeholder="เช่น โพสต์เดือนกันยายน" onChange={e => { setCampaign(e.target.value); setShareUrl(""); setEditedCaption(null); }}/></label><button type="button" className="salesPrimary" disabled={pending} onClick={createLink}>{pending ? "กำลังสร้าง…" : "สร้างลิงก์แชร์"}</button>{shareUrl && <div className="salesShareResult"><input aria-label="ลิงก์แชร์" readOnly value={shareUrl}/><button type="button" onClick={() => copy(shareUrl)}>คัดลอกลิงก์</button></div>}<p className="salesHelp">ลิงก์ผูกกับบัญชีผู้สร้างเพื่อแยกแคมเปญ ยังไม่ใช้จ่ายค่าคอมอัตโนมัติ และยังไม่รายงานอัตราซื้อจากลิงก์</p><label className="salesField">รูปแบบข้อความ<select value={tone} onChange={e => { setTone(e.target.value); setEditedCaption(null); }}><option value="friendly">เป็นกันเอง</option><option value="business">องค์กร / ธุรกิจ</option><option value="concise">สั้น กระชับ</option></select></label><label className="salesField">แคปชั่น — แก้ไขได้<textarea rows={10} value={caption} onChange={e => setEditedCaption(e.target.value)}/></label><button type="button" className="salesPrimary" onClick={() => copy(caption)}>คัดลอกแคปชั่น</button><p className="salesHelp">สร้างจากแม่แบบข้อมูลสินค้า ไม่ใช่ AI และไม่เพิ่มราคา โปรโมชั่น หรือคำรับประกันที่ยังไม่ได้ยืนยัน</p><p role="status" aria-live="polite">{message}</p></div></section>;
}
