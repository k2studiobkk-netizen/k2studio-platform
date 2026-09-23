// Customer-contact destination confirmed by the owner on 2026-09-23.
export const CUSTOMER_LINE_ID = "@k2studio";
export const CUSTOMER_LINE_URL = "https://line.me/R/ti/p/@k2studio";

export function buildCustomerShareMessage({ orderNumber, trackingUrl, phase = "tracking", designVersion }) {
  if (phase === "design") return `แบบงาน ${orderNumber}${designVersion ? ` V${designVersion}` : ""} พร้อมตรวจสอบแล้วครับ\nกรุณาเปิดลิงก์เดิมเพื่อตรวจแบบ หากถูกต้องให้กด “อนุมัติแบบและยืนยันผลิต” ได้เลย\n${trackingUrl}`;
  return `สร้างใบงาน ${orderNumber} เรียบร้อยแล้วครับ\n\nกรุณาแอด LINE ${CUSTOMER_LINE_ID} เพื่อคุยรายละเอียดและรับแบบงาน\n${CUSTOMER_LINE_URL}\nหลังแอดแล้ว รบกวนส่งเลขใบงาน ${orderNumber} ให้ทีมงานด้วยครับ\n\nคุณลูกค้าสามารถดูรายละเอียด ติดตามสถานะ และอนุมัติแบบได้จากลิงก์นี้ตลอดจนจบงาน\n${trackingUrl}\nกรุณาเก็บลิงก์นี้ไว้จนกว่าจะได้รับสินค้า`;
}
