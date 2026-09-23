import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import { getStaffUser } from "../../staff-auth";
import { publicOrderStatus, publicStatusLabel, statusLabels, statusSteps, thaiDate } from "../../order-status";
import TrackStaffPanel from "./TrackStaffPanel";
import TrackLiveSync from "./TrackLiveSync";
import QrCodeImage from "../../QrCodeImage";
import ApprovalPanel from "../../order/[token]/ApprovalPanel";
import ProgressPhotoTimeline from "../../ProgressPhotoTimeline";
import ShipmentList from "../../ShipmentList";
import type { Shipment } from "../../shipment-input";

export const dynamic = "force-dynamic";

export default async function TrackOrder({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/i.test(token)) notFound();
  const runtime = env as unknown as { DB: D1Database };
  const order = await runtime.DB.prepare(`
    SELECT id,order_number,created_at,contact_name,requested_date,quantity,order_status,public_token
    FROM orders WHERE public_token=? LIMIT 1
  `).bind(token).first<Record<string, string | number>>();
  if (!order) notFound();
  const shipments = (await runtime.DB.prepare("SELECT id,carrier,tracking_number,external_reference FROM order_shipments WHERE order_id=? AND voided_at IS NULL ORDER BY id DESC").bind(Number(order.id)).all<Shipment>()).results;

  const [historyResult, photoResult, staffUser, approvedDesign, latestDesign] = await Promise.all([
    runtime.DB.prepare("SELECT status,note,created_at FROM order_status_history WHERE order_id=? ORDER BY id DESC")
      .bind(Number(order.id)).all<Record<string, string>>(),
    runtime.DB.prepare(`
      SELECT id,status,file_name,caption,created_by_name,created_at
      FROM order_progress_photos WHERE order_id=? ORDER BY id ASC
    `).bind(Number(order.id)).all<Record<string, string | number>>(),
    getStaffUser(),
    runtime.DB.prepare("SELECT version_no,responded_by FROM design_versions WHERE order_id=? AND status='approved' AND responded_by<>'' ORDER BY version_no DESC LIMIT 1")
      .bind(Number(order.id)).first<{ version_no: number; responded_by: string }>(),
    runtime.DB.prepare("SELECT id,version_no,note,status,created_by,created_at,responded_by,responded_at,customer_note FROM design_versions WHERE order_id=? AND status IN ('pending','approved','changes_requested') ORDER BY version_no DESC LIMIT 1")
      .bind(Number(order.id)).first<Record<string, string | number>>(),
  ]);
  const history = historyResult.results;
  const photos = photoResult.results;
  const designAssets = latestDesign ? (await runtime.DB.prepare("SELECT id,asset_type,file_name,caption,sort_order FROM design_assets WHERE design_version_id=? ORDER BY CASE asset_type WHEN 'scale' THEN 0 ELSE 1 END,sort_order,id")
    .bind(Number(latestDesign.id)).all<Record<string, string | number>>()).results : [];
  const base = process.env.PUBLIC_SITE_URL || "https://order.k2group.site";
  const trackUrl = `${base}/track/${token}`;
  const current = String(order.order_status);
  const currentPublicStatus = publicOrderStatus(current);
  const currentIndex = statusSteps.indexOf(currentPublicStatus);
  const returnTo = `/track/${token}`;
  const publicHistory = history.reduce<Array<Record<string, string>>>((visible, item) => {
    const stage = publicOrderStatus(String(item.status));
    if (visible.at(-1)?.stage === stage) return visible;
    visible.push({ ...item, stage });
    return visible;
  }, []);

  return <main className="trackingPage">
    <section className="trackingHero">
      <img src="/assets/k2sign-logo.png" alt="K2SIGN" />
      <div><span>ORDER TRACKING</span><h1>ติดตามใบสั่งงาน</h1><p>เลขที่ <b>{order.order_number}</b></p></div>
      <QrCodeImage className="trackingQr" value={trackUrl} width={320} alt={`QR ติดตาม ${order.order_number}`} />
    </section>

    {staffUser
      ? <TrackStaffPanel key={current} token={token} initialStatus={current} displayName={staffUser.displayName} designApproved={Boolean(approvedDesign?.responded_by)} approvedVersion={approvedDesign?.version_no} />
      : <section className="trackStaffEntry"><div><b>สำหรับทีมงาน K2SIGN</b><span>สแกน QR เดียวกันแล้วเข้าสู่ระบบเพื่อเปลี่ยนสถานะหรือเพิ่มรูปสินค้า</span></div><a href={`/admin/login?returnTo=${encodeURIComponent(returnTo)}`}>Staff Login</a></section>}

    <section className="trackingCard">
      <TrackLiveSync />
      <div className={`trackingStatus ${currentPublicStatus}`}><span>สถานะล่าสุด</span><strong>{publicStatusLabel(current)}</strong><small>กำหนดส่ง {thaiDate(order.requested_date)}</small></div>
      <div className="trackingSteps">{statusSteps.map((step, index) => <div className={index <= currentIndex ? "done" : ""} key={step}><i>{index < currentIndex ? "✓" : index + 1}</i><span>{statusLabels[step]}</span></div>)}</div>
    </section>

    <section className="parcelPanel"><header><div><span className="parcelEyebrow">PARCEL TRACKING</span><h2>ติดตามพัสดุของคุณ</h2></div></header><ShipmentList shipments={shipments}/></section>
    <section className={`customerDesignApproval ${latestDesign ? String(latestDesign.status) : "waiting"}`}>
      <header><div><span>DESIGN APPROVAL</span><h2>{latestDesign ? `แบบล่าสุด V${latestDesign.version_no}` : "รอกราฟิกส่งแบบ"}</h2></div>{latestDesign && <b>{String(latestDesign.status) === "pending" ? "รอคุณลูกค้าอนุมัติ" : String(latestDesign.status) === "approved" ? "อนุมัติแล้ว" : "แจ้งแก้ไขแล้ว"}</b>}</header>
      {!latestDesign ? <p>เมื่อกราฟิกส่งแบบ ภาพและปุ่มอนุมัติจะปรากฏตรงนี้ในลิงก์เดิมโดยอัตโนมัติ</p> : <>
        <p>{String(latestDesign.note || "กรุณาตรวจข้อความ ขนาด สี และรายละเอียดทั้งหมดก่อนอนุมัติผลิต")}</p>
        {designAssets.length > 0 && <div className="customerDesignGrid">{designAssets.map((asset, index) => <figure key={String(asset.id)}>
          <img src={`/api/orders/${token}/design?asset=${asset.id}`} alt={`${String(asset.asset_type) === "scale" ? "ภาพแบบมีสเกล" : "ภาพม็อกอัป"} ${index + 1}`} />
          <figcaption><b>{String(asset.asset_type) === "scale" ? "ภาพแบบมีสเกล" : "ภาพม็อกอัป"}</b><span>{String(asset.caption || asset.file_name)}</span></figcaption>
        </figure>)}</div>}
        <ApprovalPanel token={token} version={Number(latestDesign.version_no)} status={String(latestDesign.status)} />
      </>}
    </section>

    <section className="trackingDetails">
      <article><span>ลูกค้า</span><b>{order.contact_name}</b></article>
      <article><span>จำนวน</span><b>{Number(order.quantity).toLocaleString("th-TH")} ชิ้น</b></article>
      <article><span>วันรับใบสั่งงาน</span><b>{String(order.created_at)}</b></article>
      <article><span>วันส่งงาน</span><b>{thaiDate(order.requested_date)}</b></article>
    </section>

    <ProgressPhotoTimeline photos={photos} token={token} orderNumber={String(order.order_number)} />

    <section className="historyCard">
      <div><span>STATUS HISTORY</span><h2>ประวัติการดำเนินงาน</h2></div>
      {publicHistory.length ? <ol>{publicHistory.map((item, index) => <li key={`${item.created_at}-${index}`}><i></i><div><b>{statusLabels[item.stage]}</b><p>{item.note || "อัปเดตสถานะใบสั่งงาน"}</p><small>{item.created_at}</small></div></li>)}</ol> : <p>กำลังรับข้อมูลเข้าสู่ระบบ</p>}
      <div className="trackingActions"><a href={`/order/${token}`}>เปิดใบสั่งงาน</a><span>ลิงก์และ QR นี้ใช้กับใบงาน {String(order.order_number)} เท่านั้น</span></div>
    </section>
  </main>;
}
