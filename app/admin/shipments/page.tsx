import { env } from "cloudflare:workers";
import { requireStaff } from "../../staff-auth";
import { canManageShipments } from "../../shipments";
import ShipmentManager from "../ShipmentManager";

export const dynamic = "force-dynamic";
export default async function ShipmentsPage() {
  const user = await requireStaff("/admin/shipments");
  const recent = (await env.DB.prepare("SELECT s.id,s.order_id,s.carrier,s.tracking_number,s.created_by_name,s.created_at,s.voided_at,o.order_number FROM order_shipments s JOIN orders o ON o.id=s.order_id ORDER BY s.id DESC LIMIT 50").all<{id:number;order_id:number;carrier:string;tracking_number:string;created_by_name:string;created_at:string;voided_at:string|null;order_number:string}>()).results;
  return <main className="adminPage parcelPage"><header className="adminHeader"><div><span>SHIPPING CENTER</span><h1>เลขพัสดุ / นำเข้า Order Plus</h1></div><a className="adminSecondary" href="/admin">กลับหน้าหลัก</a></header>
    <ShipmentManager canManage={canManageShipments(user)}/>
    <section className="parcelPanel"><h2>รายการบันทึกล่าสุด 50 รายการ</h2>{recent.length ? recent.map(s => <div className="parcelRecent" key={s.id}><a href={`/admin/orders/${s.order_id}#shipments`}>{s.order_number}</a><strong>{s.carrier} · {s.tracking_number}</strong><span>{s.voided_at ? "ยกเลิกเลขแล้ว" : "บันทึกแล้ว"} · {s.created_by_name}</span></div>) : <p>ยังไม่มีรายการบันทึก เริ่มจากวางข้อความหรือเลือกไฟล์ด้านบน</p>}</section>
  </main>;
}
