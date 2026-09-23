export const statusSteps = [
  "received",
  "design_sent",
  "production",
  "packing",
  "completed",
] as const;

export type PublicOrderStatus = typeof statusSteps[number];

export function publicOrderStatus(status: string): PublicOrderStatus {
  if (["artwork_approval_pending", "artwork_changes_requested", "artwork_approved"].includes(status)) return "design_sent";
  if (["waiting_for_production", "work_order_created", "scheduled", "in_production", "quality_check"].includes(status)) return "production";
  if (["waiting_for_packing", "packing", "ready_to_ship"].includes(status)) return "packing";
  if (["shipped", "completed"].includes(status)) return "completed";
  return "received";
}

export function publicStatusLabel(status: string) {
  return statusLabels[publicOrderStatus(status)];
}

export const statusLabels: Record<string,string> = {
  received:"รับงาน",
  design_sent:"ส่งแบบ",
  production:"ส่งผลิต",
  completed:"เสร็จสมบูรณ์",
  waiting_for_artwork_review:"รับข้อมูล / รอตรวจไฟล์",
  draft:"ฉบับร่าง",
  waiting_for_graphic:"รอกราฟิก",
  artwork_preparation:"กราฟิกกำลังเตรียมแบบ",
  quotation_pending:"ตรวจสอบราคา",
  artwork_approval_pending:"ส่งแบบแล้ว / รออนุมัติ",
  artwork_changes_requested:"ลูกค้าขอแก้ไขแบบ",
  artwork_approved:"ลูกค้าอนุมัติแบบแล้ว",
  confirmed:"ยืนยันใบสั่งงาน",
  work_order_created:"ออกใบงานแล้ว",
  waiting_for_production:"ส่งผลิต / รอผลิต",
  scheduled:"จัดคิวผลิตแล้ว",
  in_production:"กำลังผลิต",
  quality_check:"ตรวจคุณภาพ (QC)",
  waiting_for_packing:"ส่งเข้าห้องแพ็ก",
  packing:"กำลังแพ็ก",
  ready_to_ship:"พร้อมส่ง",
  shipped:"จัดส่งแล้ว",
  on_hold:"พักงาน",
  cancelled:"ยกเลิก",
};

export function money(value:unknown){return Number(value||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});}
export function thaiDate(value:unknown){if(!value)return "-";const date=new Date(`${String(value)}T00:00:00+07:00`);return new Intl.DateTimeFormat("th-TH",{dateStyle:"long",timeZone:"Asia/Bangkok"}).format(date);}
export function thaiPhotoTimestamp(value:unknown){
  const raw=String(value||"").trim();
  if(!raw)return "ไม่ทราบเวลา";
  const normalized=/Z$|[+-]\d{2}:\d{2}$/.test(raw)?raw:`${raw.replace(" ","T")}Z`;
  const date=new Date(normalized);
  if(Number.isNaN(date.getTime()))return raw;
  return new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",day:"numeric",month:"short",year:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(date).replace("24:","00:");
}
