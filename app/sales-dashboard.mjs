export function salesScope({ id, all, team, self }) {
  if (all || team) return null;
  if (self && Number.isSafeInteger(id) && id > 0) return id;
  throw new Error("ไม่มีสิทธิ์ดูข้อมูลการขาย");
}
export function salesDateRange(from, to, now = new Date()) {
  const today = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const end = to || today, start = from || `${today.slice(0, 7)}-01`;
  const valid = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!valid(start) || !valid(end) || start > end || end > today || (Date.parse(end) - Date.parse(start)) / 86400000 > 365) throw new Error("เลือกช่วงวันที่ไม่เกินหนึ่งปีและไม่เกินวันนี้");
  return { start, end, today };
}
// Aggregate receipts before joining: otherwise multi-line / multi-installment orders multiply sales.
const base = `WITH receipts AS (SELECT order_id,SUM(CAST(amount AS REAL)) received FROM order_payment_receipts GROUP BY order_id),
 scoped AS (SELECT o.*,MAX(COALESCE(r.received,0),CAST(COALESCE(o.deposit_amount,'0') AS REAL)) received,
   MAX(0,CAST(o.estimated_total AS REAL)-CAST(COALESCE(o.vat_amount,'0') AS REAL)) net_sales,
   CAST(o.estimated_total AS REAL)+CAST(COALESCE(o.shipping_fee,'0') AS REAL) payable,
   COALESCE(NULLIF(u.display_name,''),NULLIF(o.sales_owner_name,''),'ยังไม่ระบุเซลล์') owner_label,
   COALESCE(sc.name,NULLIF(o.contact_channel,''),'ยังไม่ระบุช่องทาง') channel_label
 FROM orders o LEFT JOIN receipts r ON r.order_id=o.id LEFT JOIN staff_users u ON u.id=o.sales_owner_id
 LEFT JOIN sales_channels sc ON sc.code=o.contact_channel WHERE (?1 IS NULL OR o.sales_owner_id=?1)),
 period_orders AS (SELECT * FROM scoped WHERE order_status<>'cancelled' AND date(created_at,'+7 hours') BETWEEN ?2 AND ?3)`;
export const salesQueries = Object.freeze({
  summary: `${base} SELECT COUNT(*) orders,COALESCE(SUM(net_sales),0) sales,COALESCE(SUM(MAX(0,payable-received)),0) outstanding,
    COALESCE(AVG(net_sales),0) average_order FROM period_orders`,
  daily: `${base} SELECT date(created_at,'+7 hours') day,COUNT(*) orders,SUM(net_sales) sales FROM period_orders GROUP BY day ORDER BY day`,
  sellers: `${base} SELECT COALESCE(sales_owner_id,0) id,MAX(owner_label) label,COUNT(*) orders,SUM(net_sales) sales,SUM(MAX(0,payable-received)) outstanding FROM period_orders GROUP BY sales_owner_id ORDER BY sales DESC`,
  channels: `${base} SELECT COALESCE(contact_channel,'') id,MAX(channel_label) label,COUNT(*) orders,SUM(net_sales) sales,SUM(MAX(0,payable-received)) outstanding FROM period_orders GROUP BY contact_channel ORDER BY sales DESC`,
  products: `${base} SELECT oi.product_type id,CASE WHEN oi.product_type='acrylic_keychain' THEN 'พวงกุญแจอะคริลิก' ELSE 'สินค้า / งานสั่งทำอื่น' END label,
    SUM(oi.quantity) quantity,SUM(CAST(oi.line_total AS REAL)) sales FROM order_items oi JOIN period_orders o ON o.id=oi.order_id GROUP BY oi.product_type ORDER BY sales DESC`,
  cash: `${base}, payment_events AS (
    SELECT CAST(r.amount AS REAL) amount,r.created_at payment_at FROM order_payment_receipts r JOIN scoped o ON o.id=r.order_id
    UNION ALL SELECT MAX(0,CAST(o.deposit_amount AS REAL)-COALESCE(r.received,0)),o.created_at FROM scoped o LEFT JOIN receipts r ON r.order_id=o.id
  ) SELECT COALESCE(SUM(amount),0) received FROM payment_events WHERE date(payment_at,'+7 hours') BETWEEN ?2 AND ?3`,
  followups: `${base} SELECT id,order_number,requested_date,owner_label,MAX(0,payable-received) outstanding FROM scoped
    WHERE order_status<>'cancelled' AND requested_date<>'' AND date(requested_date)<=?3 AND payable-received>0.009 ORDER BY requested_date,id LIMIT 12`,
});
