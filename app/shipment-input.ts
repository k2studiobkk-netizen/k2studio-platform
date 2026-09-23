// Shared pure parser: no customer address, phone, or payment fields leave the importer.
export const MAX_SHIPMENT_ROWS = 50;
export type ShipmentInput = { orderCode: string; carrier: string; trackingNumber: string; reference: string };
export type ShipmentPreview = ShipmentInput & { index: number; orderId?: number; customer?: string; status: "ready" | "blocked" | "duplicate"; message: string };
export type Shipment = { id: number; order_id: number; carrier: string; tracking_number: string; external_reference: string; created_at: string; created_by_name: string; voided_at: string | null; void_reason: string | null };

export function jobCodes(value: unknown): string[] {
  const text = String(value ?? "").normalize("NFKC").toUpperCase().replace(/[–—]/g, "-");
  return [...new Set([...text.matchAll(/(?:^|[^A-Z0-9-])([A-Z][A-Z0-9]{0,11}\s*-\s*\d{3,20})(?![A-Z0-9-])/g)].map(m => m[1].replace(/\s/g, "")))];
}
export function normalizeCode(value: unknown): string {
  return String(value ?? "").trim().normalize("NFKC").toUpperCase().replace(/[–—]/g, "-").replace(/\s/g, "");
}
export function normalizeShipment(value: unknown): ShipmentInput {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    orderCode: normalizeCode(row.orderCode),
    carrier: String(row.carrier ?? "").trim().replace(/\s+/g, " "),
    trackingNumber: String(row.trackingNumber ?? "").trim().toUpperCase().replace(/\s/g, ""),
    reference: String(row.reference ?? "").trim().toUpperCase(),
  };
}
export function shipmentError(row: ShipmentInput): string {
  if (!/^[A-Z][A-Z0-9]{0,11}-\d{3,20}$/.test(row.orderCode)) return "ต้องมีรหัสใบงานเดียว เช่น K2-1248 (ไม่จับคู่จากชื่อ)";
  if (!row.carrier || row.carrier.length > 60 || /[<>\r\n]/.test(row.carrier)) return "กรุณาระบุชื่อขนส่งให้ถูกต้อง";
  if (!/^[A-Z0-9][A-Z0-9-]{4,49}$/.test(row.trackingNumber)) return "เลขพัสดุต้องเป็นตัวอักษร/ตัวเลข 5–50 ตัว";
  if (row.reference && !/^[A-Z0-9_-]{4,80}$/.test(row.reference)) return "เลขอ้างอิง Order Plus ไม่ถูกต้อง";
  return "";
}
export function orderPlusUrl(reference: string): string {
  return /^[A-Z0-9_-]{4,80}$/.test(reference) ? `https://web.orderplus.me/fill/order?reference=${encodeURIComponent(reference)}` : "";
}
export function parseOrderPlusText(text: string): ShipmentInput {
  const line = (label: string) => text.match(new RegExp(`${label}\\s*[:：]\\s*([^\\r\\n]+)`))?.[1]?.trim() || "";
  const codes = jobCodes(line("ชื่อผู้รับ"));
  const reference = line("คำสั่งซื้อสินค้า") || text.match(/https:\/\/web\.orderplus\.me\/fill\/order\?reference=([A-Za-z0-9_-]+)/)?.[1] || "";
  return normalizeShipment({ orderCode: codes.join(", "), carrier: line("จัดส่งโดย"), trackingNumber: line("เลขพัสดุ"), reference });
}

export function parseOrderPlusSheet(data: unknown[][]): Array<ShipmentInput & { rowNumber: number }> {
  const key = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/[\s_\-]/g, "");
  const columns = {
    tracking: ["เลขพัสดุ", "trackingnumber", "trackingno"],
    carrier: ["ขนส่ง", "จัดส่งโดย", "carrier"],
    recipient: ["ชื่อ-นามสกุล ลูกค้า", "ชื่อผู้รับ", "นามสกุล", "นามสกุลลูกค้า", "lastname"],
    // Order Plus exports two different IDs: only หมายเลขออเดอร์ is its public URL reference.
    reference: ["หมายเลขออเดอร์", "คำสั่งซื้อสินค้า", "reference"],
  };
  const headerIndex = data.slice(0, 10).findIndex(row => row.some(v => columns.tracking.map(key).includes(key(v))));
  if (headerIndex < 0) throw new Error("ไม่พบหัวตาราง ‘เลขพัสดุ’ ในไฟล์ Order Plus");
  const header = data[headerIndex].map(key);
  const find = (names: string[]) => header.findIndex(v => names.map(key).includes(v));
  const t = find(columns.tracking), c = find(columns.carrier), n = find(columns.recipient), r = find(columns.reference);
  if (c < 0 || n < 0) throw new Error("ต้องมีคอลัมน์ขนส่ง และชื่อ–นามสกุลลูกค้า/นามสกุล");
  const result = data.slice(headerIndex + 1).flatMap((row, i) => {
    if (row.every(v => v === null || v === undefined || v === "")) return [];
    // Numeric Excel identifiers may already have lost leading zeroes/precision. Never guess.
    const tracking = typeof row[t] === "number" ? "เลขพัสดุเป็นตัวเลข Excel: กรุณาตั้งคอลัมน์เป็นข้อความ" : row[t];
    return [{ ...normalizeShipment({ orderCode: jobCodes(row[n]).join(", "), carrier: row[c], trackingNumber: tracking, reference: r >= 0 ? row[r] : "" }), rowNumber: headerIndex + i + 2 }];
  });
  if (!result.length) throw new Error("ไฟล์นี้ไม่มีรายการพัสดุ");
  if (result.length > MAX_SHIPMENT_ROWS) throw new Error(`กรุณาแบ่งไฟล์ไม่เกิน ${MAX_SHIPMENT_ROWS} แถวต่อครั้ง`);
  return result;
}
