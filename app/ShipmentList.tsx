import { orderPlusUrl, type Shipment } from "./shipment-input";

export default function ShipmentList({ shipments }: { shipments: Shipment[] }) {
  const active = shipments.filter(s => !s.voided_at);
  return <div className="parcelList">{active.length ? active.map(s => <article key={s.id}>
    <div><small>{s.carrier}</small><strong>{s.tracking_number}</strong><span>บันทึกเลขพัสดุแล้ว • ตรวจสถานะจัดส่งจากขนส่ง</span></div>
    {orderPlusUrl(s.external_reference) && <a href={orderPlusUrl(s.external_reference)} target="_blank" rel="noopener noreferrer">ติดตามพัสดุ ↗</a>}
  </article>) : <p className="parcelEmpty">ยังไม่มีเลขพัสดุ เมื่อทีมงานบันทึกแล้วจะแสดงที่นี่</p>}</div>;
}
