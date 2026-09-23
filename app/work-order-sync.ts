type SyncOptions = {
  actorId: number;
  createIfMissing?: boolean;
};

type OrderRow = Record<string, string | number>;
type ItemRow = Record<string, string | number>;

function summarize(items: ItemRow[]) {
  const categories = new Set(items.map((item) => String(item.product_type || "acrylic_keychain")));
  const productCategory = categories.size > 1 ? "mixed" : categories.has("custom") ? "custom" : "acrylic_keychain";
  const fallback = productCategory === "custom" ? "งานสั่งทำอื่น ๆ" : productCategory === "mixed" ? "สินค้าหลายประเภท" : "พวงกุญแจอะคริลิก";
  const names = items.map((item) => String(item.item_name || "").trim()).filter(Boolean);
  const productName = items.length === 1 ? names[0] || fallback : `${fallback} ${items.length} รายการ`;
  const quantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const size = [...new Set(items.map((item) => {
    const width = String(item.width_cm || "").trim();
    const height = String(item.height_cm || "").trim();
    return width && height && Number(width) > 0 && Number(height) > 0 ? `${width}×${height} ซม.` : "";
  }).filter(Boolean))].join(", ");
  const thickness = [...new Set(items.map((item) => String(item.thickness_mm || "").trim()).filter(Boolean))].join(", ");
  const printSpecification = [...new Set(items.map((item) => Number(item.print_sides || 0)).filter(Boolean).map((sides) => `${sides} ด้าน`))].join(", ");
  const productCode = productCategory === "mixed" ? "MIXED" : productCategory === "custom" ? "CUSTOM" : "ACRYLIC-KEYCHAIN";
  return { productCategory, productName, quantity, size, thickness, printSpecification, productCode, fallback };
}

function initialWorkOrderStatus(orderStatus: string) {
  if (["work_order_created", "waiting_for_production", "scheduled", "in_production", "quality_check", "packing", "ready_to_ship", "shipped", "completed", "cancelled"].includes(orderStatus)) return orderStatus;
  return "draft";
}

/**
 * Mirrors editable order/customer data into a production draft.
 * Queue, schedule, priority, notes and production status are deliberately preserved.
 */
export async function syncWorkOrderFromOrder(database: D1Database, orderId: number, options: SyncOptions) {
  const order = await database.prepare(`SELECT id,order_number,order_status,contact_name,phone,email,line_id,contact_channel,social_contact_name,address,province,requested_date,packaging_type,sales_owner_id,rush_mode,requested_speed_days,delivery_tier,rush_fee,rush_note
    FROM orders WHERE id=? LIMIT 1`).bind(orderId).first<OrderRow>();
  if (!order) throw new Error("Order not found while syncing production draft");
  const items = (await database.prepare(`SELECT product_type,item_name,item_description,quantity,width_cm,height_cm,thickness_mm,print_sides
    FROM order_items WHERE order_id=? ORDER BY line_no`).bind(orderId).all<ItemRow>()).results;
  if (!items.length) throw new Error("Order has no items to sync");

  const phone = String(order.phone || "");
  const email = String(order.email || "");
  let customer = await database.prepare("SELECT id FROM customers WHERE (phone<>'' AND phone=?) OR (email<>'' AND lower(email)=lower(?)) ORDER BY id LIMIT 1")
    .bind(phone, email).first<{ id: number }>();
  if (!customer) {
    customer = await database.prepare(`INSERT INTO customers (customer_number,name,phone,email,line_id,contact_channel,social_contact_name,address,province)
      VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`).bind(`CUS-${String(order.order_number)}`, String(order.contact_name), phone, email, String(order.line_id || ""), String(order.contact_channel || ""), String(order.social_contact_name || ""), String(order.address || ""), String(order.province || "")).first<{ id: number }>();
  } else {
    await database.prepare(`UPDATE customers SET name=?,phone=?,email=?,line_id=?,contact_channel=?,social_contact_name=?,address=?,province=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(String(order.contact_name), phone, email, String(order.line_id || ""), String(order.contact_channel || ""), String(order.social_contact_name || ""), String(order.address || ""), String(order.province || ""), customer.id).run();
  }
  if (!customer) throw new Error("Customer could not be synced");

  const summary = summarize(items);
  const rushMode = String(order.rush_mode || "normal").toLowerCase();
  const requestedSpeedDays = Math.max(0, Number(order.requested_speed_days) || 0);
  const deliveryTier = String(order.delivery_tier || "").trim();
  const rushFee = String(order.rush_fee || "0").trim();
  const rushNote = String(order.rush_note || "").trim();
  const priority = rushMode === "urgent" ? "urgent" : requestedSpeedDays > 0 ? "high" : "normal";
  const rushStatus = rushMode === "urgent" ? "pending" : "none";
  const workNoteParts = [
    rushMode === "urgent" ? "เร่งงาน" : "",
    requestedSpeedDays > 0 ? `กำหนดส่งภายใน ${requestedSpeedDays} วัน` : "",
    deliveryTier ? `ระดับ: ${deliveryTier}` : "",
    rushFee && Number(rushFee) > 0 ? `เพิ่มค่าส่งด่วน ฿${rushFee}` : "",
    rushNote,
  ].filter(Boolean);
  const workOrderNotes = workNoteParts.join(" • ");
  await database.prepare("INSERT OR IGNORE INTO products (code,name,category) VALUES (?,?,?)")
    .bind(summary.productCode, summary.fallback, summary.productCategory).run();
  const product = await database.prepare("SELECT id FROM products WHERE code=? LIMIT 1").bind(summary.productCode).first<{ id: number }>();
  const existing = await database.prepare("SELECT id,status FROM work_orders WHERE order_id=? LIMIT 1").bind(orderId).first<{ id: number; status: string }>();

  if (existing) {
    await database.prepare(`UPDATE work_orders SET work_order_number=?,customer_id=?,sales_owner_id=?,product_id=?,product_name=?,product_category=?,quantity=?,size=?,material=?,thickness=?,print_specification=?,customer_requested_date=?,delivery_method=?,priority=?,rush_status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(String(order.order_number), customer.id, Number(order.sales_owner_id) || options.actorId, product?.id || null, summary.productName, summary.productCategory, summary.quantity, summary.size, summary.productCategory === "acrylic_keychain" ? "อะคริลิก" : "ตามรายละเอียดงาน", summary.thickness, summary.printSpecification, String(order.requested_date || ""), String(order.packaging_type || ""), priority, rushStatus, workOrderNotes, existing.id).run();
    return { id: existing.id, status: existing.status, created: false };
  }
  if (options.createIfMissing === false) return null;

  const initialStatus = initialWorkOrderStatus(String(order.order_status || ""));
  const created = await database.prepare(`INSERT INTO work_orders (work_order_number,order_id,customer_id,sales_owner_id,product_id,product_name,product_category,quantity,size,material,thickness,print_specification,customer_requested_date,delivery_method,priority,rush_status,notes,status,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id,status`).bind(String(order.order_number), orderId, customer.id, Number(order.sales_owner_id) || options.actorId, product?.id || null, summary.productName, summary.productCategory, summary.quantity, summary.size, summary.productCategory === "acrylic_keychain" ? "อะคริลิก" : "ตามรายละเอียดงาน", summary.thickness, summary.printSpecification, String(order.requested_date || ""), String(order.packaging_type || ""), priority, rushStatus, workOrderNotes, initialStatus, options.actorId).first<{ id: number; status: string }>();
  if (!created) throw new Error("Production draft could not be created");
  if (initialStatus !== "draft") {
    const queueRemoved = ["shipped", "completed", "cancelled"].includes(initialStatus) ? 1 : 0;
    await database.prepare(`UPDATE work_orders SET
      planned_production_date=COALESCE(NULLIF(planned_production_date,''),date('now','+7 hours')),
      confirmed_delivery_date=COALESCE(NULLIF(confirmed_delivery_date,''),NULLIF(customer_requested_date,''),date('now','+7 hours')),
      queue_removed=?,queue_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(queueRemoved, created.id).run();
  }
  await database.prepare("INSERT INTO work_order_status_history (work_order_id,status,note,changed_by) VALUES (?,?,?,?)")
    .bind(created.id, initialStatus, initialStatus === "draft" ? "ดึงข้อมูลจากใบสั่งงานเข้าสู่ระบบการผลิตอัตโนมัติ" : `เชื่อมใบงานเก่าเข้าระบบการผลิตที่สถานะ ${initialStatus}`, options.actorId).run();
  return { id: created.id, status: created.status, created: true };
}
