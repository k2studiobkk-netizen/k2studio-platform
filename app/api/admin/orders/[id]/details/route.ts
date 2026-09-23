import { env } from "cloudflare:workers";
import { audit, canManageOrderNumber, getStaffUser } from "../../../../../staff-auth";
import { calculateOrderTotals } from "../../../../../order-pricing.mjs";
import { validateOrderNumberChange } from "../../../../../order-number.mjs";
import { calculatePrice, type Thickness } from "../../../../../pricing-config";
import { pricingSpecificationChanged } from "../../../../../order-spec-change.mjs";
import { syncWorkOrderFromOrder } from "../../../../../work-order-sync";
import { VAT_POLICY_MODES, vatCollectionDecision } from "../../../../../vat-collection-policy.mjs";

type ItemInput = {
  id: number;
  productType: string;
  itemName: string;
  description: string;
  thickness: string;
  width: number;
  height: number;
  quantity: number;
  sides: number;
  hardwareCode: string;
  hardwareName: string;
  hardwareColor: string;
  packaging: string;
};

type Payload = {
  orderNumber?: string;
  contactName?: string;
  phone?: string;
  lineId?: string;
  email?: string;
  contactChannel?: string;
  socialContactName?: string;
  salesOwnerId?: number;
  fileDeliveryMethod?: string;
  externalFileUrl?: string;
  fileDeliveryNote?: string;
  address?: string;
  province?: string;
  requestedDate?: string;
  vatApplied?: boolean;
  taxInvoiceRequested?: boolean;
  rushMode?: string;
  requestedSpeedDays?: number;
  deliveryTier?: string;
  rushFee?: number | string;
  rushNote?: string;
  items?: ItemInput[];
};

type StoredOrder = {
  order_number: string;
  contact_channel: string;
  sales_owner_id: number | null;
  sales_owner_name: string;
  vat_applied: number;
  tax_invoice_requested: number | null;
  vat_policy_mode: string;
  discount_amount: string;
  shipping_fee: string;
  rush_mode: string;
  requested_speed_days: number;
  delivery_tier: string;
  rush_fee: string;
  rush_note: string;
};

type StoredItem = {
  id: number;
  product_type: string;
  thickness_mm: string;
  width_cm: string;
  height_cm: string;
  quantity: number;
  print_sides: number;
  hardware_code: string;
  packaging_type: string;
  unit_price: string;
};

const channels = new Set(["facebook_k2sign", "facebook_sweetdesign", "line_k2sign", "line_k2studio", "customer_web", "line", "other"]);
const fileMethods = new Set(["upload", "google_drive", "email"]);
const rushModes = new Set(["normal", "urgent"]);
const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);
const toNumber = (value: unknown, fallback = 0) => {
  const normalized = Number(clean(value));
  return Number.isFinite(normalized) ? normalized : fallback;
};

function isOrderNumberConflict(error: unknown) {
  return error instanceof Error &&
    error.message.toLowerCase().includes("unique") &&
    error.message.toLowerCase().includes("order_number");
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { id } = await params;
  const orderId = Number(id);
  const body = await request.json() as Payload;
  if (!Number.isInteger(orderId) || orderId < 1) {
    return Response.json({ error: "เลขใบงานไม่ถูกต้อง" }, { status: 400 });
  }

  const contactName = clean(body.contactName, 120);
  const phone = clean(body.phone, 30);
  const email = clean(body.email, 160);
  const contactChannel = clean(body.contactChannel, 40);
  const fileDeliveryMethod = clean(body.fileDeliveryMethod, 30);
  const requestedDate = clean(body.requestedDate, 10);
  const salesOwnerId = Number(body.salesOwnerId);
  const items = Array.isArray(body.items) ? body.items : [];
  const rushMode = clean(String((body as Payload).rushMode || (body as { rush_mode?: string }).rush_mode || "normal")).toLowerCase();
  const requestedSpeedDays = toNumber((body as Payload).requestedSpeedDays ?? (body as { requested_speed_days?: unknown }).requested_speed_days, 0);
  const deliveryTier = clean((body as Payload).deliveryTier || (body as { delivery_tier?: string }).delivery_tier, 120);
  const rushFee = Number(clean((body as Payload).rushFee ?? (body as { rush_fee?: unknown }).rush_fee, 20));
  const rushNote = clean((body as Payload).rushNote || (body as { rush_note?: string }).rush_note, 400);
  if (
    contactName.length < 2 ||
    phone.length < 6 ||
    !channels.has(contactChannel) ||
    !fileMethods.has(fileDeliveryMethod) ||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(requestedDate) ||
    !rushModes.has(rushMode) ||
    !Number.isInteger(requestedSpeedDays) ||
    requestedSpeedDays < 0 ||
    requestedSpeedDays > 365 ||
    !Number.isFinite(rushFee) ||
    rushFee < 0 ||
    !Number.isInteger(salesOwnerId) || salesOwnerId < 1 ||
    items.length < 1 ||
    items.length > 20
  ) {
    return Response.json(
      { error: "กรุณาตรวจข้อมูลลูกค้า วันส่งงาน และรายการสินค้า" },
      { status: 400 },
    );
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
  }
  if (items.some((item) =>
    !Number.isInteger(Number(item.id)) ||
    !["acrylic_keychain", "custom"].includes(String(item.productType)) ||
    !clean(item.itemName, 100) ||
    !Number.isInteger(Number(item.quantity)) ||
    Number(item.quantity) < 1 ||
    Number(item.quantity) > 1000000 ||
    (String(item.productType) === "custom"
      ? clean(item.description, 1000).length < 2
      : !["2.5", "3"].includes(String(item.thickness)) ||
        !Number.isFinite(Number(item.width)) ||
        Number(item.width) <= 0 ||
        Number(item.width) > 100 ||
        !Number.isFinite(Number(item.height)) ||
        Number(item.height) <= 0 ||
        Number(item.height) > 100 ||
        ![1, 2].includes(Number(item.sides)) ||
        !clean(item.hardwareCode, 10) ||
        !clean(item.hardwareName, 150) ||
        !clean(item.packaging, 80))
  )) {
    return Response.json({ error: "กรุณาตรวจสเปกของทุกรายการ" }, { status: 400 });
  }

  const db = (env as unknown as { DB: D1Database }).DB;
  const order = await db.prepare(
    "SELECT order_number,contact_channel,sales_owner_id,sales_owner_name,vat_applied,tax_invoice_requested,vat_policy_mode,discount_amount,shipping_fee,rush_mode,requested_speed_days,delivery_tier,rush_fee,rush_note FROM orders WHERE id=?",
  ).bind(orderId).first<StoredOrder>();
  if (!order) return Response.json({ error: "ไม่พบใบงาน" }, { status: 404 });
  const salesOwner = await db.prepare("SELECT u.id,u.display_name FROM staff_users u WHERE u.id=? AND u.active=1 AND (u.role IN ('admin','production_manager','sales') OR EXISTS (SELECT 1 FROM staff_user_teams t WHERE t.user_id=u.id AND t.team_code='sale')) LIMIT 1").bind(salesOwnerId).first<{id:number;display_name:string}>();
  if (!salesOwner) return Response.json({ error: "ไม่พบเซลล์ผู้รับผิดชอบที่ใช้งานอยู่" }, { status: 400 });
  const salesChannel = await db.prepare("SELECT code FROM sales_channels WHERE code=? AND (active=1 OR code=?) LIMIT 1").bind(contactChannel,order.contact_channel).first<{code:string}>();
  if (!salesChannel && !["line","other"].includes(contactChannel)) return Response.json({ error: "ไม่พบช่องทางขายที่ใช้งานอยู่" }, { status: 400 });
  const salesOwnerChanged = Number(order.sales_owner_id || 0) !== salesOwnerId;

  const orderNumberResult = validateOrderNumberChange(
    order.order_number,
    body.orderNumber ?? order.order_number,
  );
  if (!orderNumberResult.ok) {
    return Response.json({ error: orderNumberResult.error }, { status: 400 });
  }
  if (orderNumberResult.changed && !canManageOrderNumber(user.role)) {
    return Response.json(
      { error: "เฉพาะผู้ดูแลระบบและหัวหน้างานเท่านั้นที่แก้เลขใบงานได้" },
      { status: 403 },
    );
  }
  const orderNumber = orderNumberResult.value;
  if (orderNumberResult.changed) {
    const duplicate = await db.prepare(
      "SELECT id FROM orders WHERE order_number=? AND id<>? LIMIT 1",
    ).bind(orderNumber, orderId).first<{ id: number }>();
    if (duplicate) {
      return Response.json(
        { error: "เลขใบงานนี้ถูกใช้งานแล้ว กรุณาเลือกเลขอื่น" },
        { status: 409 },
      );
    }
  }

  const stored = (await db.prepare(
    "SELECT id,product_type,thickness_mm,width_cm,height_cm,quantity,print_sides,hardware_code,packaging_type,unit_price FROM order_items WHERE order_id=? ORDER BY line_no",
  ).bind(orderId).all<StoredItem>()).results;
  if (stored.length !== items.length) {
    return Response.json({ error: "จำนวนรายการสินค้าไม่ตรงกับใบงาน" }, { status: 409 });
  }
  const storedMap = new Map(stored.map((item) => [Number(item.id), item]));
  if (items.some((item) => !storedMap.has(Number(item.id)))) {
    return Response.json({ error: "พบรายการสินค้าที่ไม่อยู่ในใบงาน" }, { status: 409 });
  }

  const adjustments = (await db.prepare(
    "SELECT amount FROM order_adjustments WHERE order_id=?",
  ).bind(orderId).all<{ amount: string }>()).results;
  const hardwarePrices = (await db.prepare(
    "SELECT hardware_code,price FROM hardware_prices",
  ).all<{ hardware_code: string; price: string }>()).results;
  const hardwarePriceMap = new Map(
    hardwarePrices.map((item) => [String(item.hardware_code), Number(item.price)]),
  );
  if ((body.vatApplied !== undefined && typeof body.vatApplied !== "boolean") || (body.taxInvoiceRequested !== undefined && typeof body.taxInvoiceRequested !== "boolean")) return Response.json({ error: "ตัวเลือกภาษีไม่ถูกต้อง" }, { status: 400 });
  const hasVatPolicy = VAT_POLICY_MODES.includes(order.vat_policy_mode);
  const invoiceRequested = user.role === "admin" && typeof body.taxInvoiceRequested === "boolean" ? body.taxInvoiceRequested : Number(order.tax_invoice_requested) === 1;
  // Preserve the order's saved policy; a global change must never reprice old work.
  const vatApplied = hasVatPolicy ? vatCollectionDecision(order.vat_policy_mode,invoiceRequested).addVat
    : user.role === "admin" && typeof body.vatApplied === "boolean" ? body.vatApplied : Number(order.vat_applied) === 1;
  const repricedLines: number[] = [];
  const manualPriceLines: number[] = [];
  const normalized = items.map((item, index) => {
    const storedItem = storedMap.get(Number(item.id))!;
    const next = {
      ...item,
      id: Number(item.id),
      productType: String(item.productType),
      itemName: clean(item.itemName, 100),
      description: clean(item.description, 1000),
      thickness: String(item.productType) === "custom" ? "" : String(item.thickness),
      width: String(item.productType) === "custom" ? 0 : Number(item.width),
      height: String(item.productType) === "custom" ? 0 : Number(item.height),
      quantity: Number(item.quantity),
      sides: String(item.productType) === "custom" ? 0 : Number(item.sides),
      hardwareCode: String(item.productType) === "custom" ? "-" : clean(item.hardwareCode, 10).toUpperCase(),
      hardwareName: String(item.productType) === "custom" ? "ไม่ใช้" : clean(item.hardwareName, 150),
      hardwareColor: String(item.productType) === "custom" ? "" : clean(item.hardwareColor, 80),
      packaging: String(item.productType) === "custom" ? "custom_order" : clean(item.packaging, 80),
      unitPrice: Number(storedItem.unit_price),
    };
    if (next.productType === "acrylic_keychain" && pricingSpecificationChanged(storedItem, next)) {
      const calculated = calculatePrice({
        thickness: (next.thickness === "3" ? "3" : "2.5") as Thickness,
        width: next.width,
        height: next.height,
        quantity: next.quantity,
        sides: next.sides === 2 ? 2 : 1,
        hardwareCode: next.hardwareCode,
        packaging: next.packaging,
        hardwarePrice: hardwarePriceMap.get(next.hardwareCode),
      });
      if (calculated.manual) manualPriceLines.push(index + 1);
      else {
        next.unitPrice = calculated.unit;
        repricedLines.push(index + 1);
      }
    }
    return next;
  });
  const totals = calculateOrderTotals(
    normalized.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice })),
    adjustments.map((item) => Number(item.amount)),
    Number(order.discount_amount || 0),
    vatApplied,
    Number(order.shipping_fee || 0),
  );
  // Keep the existing rush charge when editing document preference or customer details.
  // This matches creation; the VAT base is deliberately unchanged in this increment.
  totals.total = Math.round((totals.total + rushFee) * 100) / 100;
  const totalQuantity = normalized.reduce((sum, item) => sum + item.quantity, 0);
  const first = normalized[0];
  const pricingSize = first.productType === "custom" ? 0 : Math.max(2, Math.ceil(Math.max(first.width, first.height)));
  const statements = normalized.map((item) => db.prepare(
    "UPDATE order_items SET product_type=?,item_name=?,item_description=?,thickness_mm=?,width_cm=?,height_cm=?,pricing_size_cm=?,quantity=?,print_sides=?,hardware_code=?,hardware_name=?,hardware_color=?,packaging_type=?,unit_price=?,line_total=? WHERE id=? AND order_id=?",
  ).bind(
    item.productType,
    item.itemName,
    item.description,
    item.thickness,
    item.width.toFixed(2),
    item.height.toFixed(2),
    item.productType === "custom" ? 0 : Math.max(2, Math.ceil(Math.max(item.width, item.height))),
    item.quantity,
    item.sides,
    item.hardwareCode,
    item.hardwareName,
    item.hardwareColor,
    item.packaging,
    item.unitPrice.toFixed(2),
    (item.quantity * item.unitPrice).toFixed(2),
    item.id,
    orderId,
  ));
  statements.push(db.prepare(
    "UPDATE orders SET order_number=?,contact_name=?,phone=?,line_id=?,email=?,contact_channel=?,social_contact_name=?,sales_owner_id=?,sales_owner_name=?,file_delivery_method=?,external_file_url=?,file_delivery_note=?,address=?,province=?,requested_date=?,thickness_mm=?,width_cm=?,height_cm=?,pricing_size_cm=?,quantity=?,print_sides=?,hardware_code=?,hardware_name=?,hardware_color=?,packaging_type=?,rush_mode=?,requested_speed_days=?,delivery_tier=?,rush_fee=?,rush_note=?,estimated_unit_price=?,estimated_subtotal=?,vat_applied=?,vat_amount=?,estimated_total=? WHERE id=?",
  ).bind(
    orderNumber,
    contactName,
    phone,
    clean(body.lineId, 100),
    email,
    contactChannel,
    clean(body.socialContactName, 160),
    salesOwner.id,
    salesOwner.display_name,
    fileDeliveryMethod,
    clean(body.externalFileUrl, 800),
    clean(body.fileDeliveryNote, 500),
    clean(body.address, 1000),
    clean(body.province, 100),
    requestedDate,
    first.thickness,
    first.width.toFixed(2),
    first.height.toFixed(2),
    pricingSize,
    totalQuantity,
    first.sides,
    first.hardwareCode,
    first.hardwareName,
    first.hardwareColor,
    first.packaging,
    rushMode,
    requestedSpeedDays,
    deliveryTier,
    String(rushFee.toFixed(2)),
    rushNote,
    (totals.itemSubtotal / Math.max(1, totalQuantity)).toFixed(2),
    totals.subtotal.toFixed(2),
    vatApplied ? 1 : 0,
    totals.vatAmount.toFixed(2),
    totals.total.toFixed(2),
    orderId,
  ));
  if (
    rushMode !== order.rush_mode ||
    requestedSpeedDays !== Number(order.requested_speed_days || 0) ||
    deliveryTier !== order.delivery_tier ||
    String(rushFee.toFixed(2)) !== String(Number(order.rush_fee || 0).toFixed(2)) ||
    rushNote !== order.rush_note
  ) {
    await audit(
      user,
      orderId,
      "แก้ไขข้อมูลเร่งคิว",
      `โหมด ${order.rush_mode || "normal"} → ${rushMode}, วันที่เร่ง ${order.requested_speed_days || 0} → ${requestedSpeedDays}, ค่าบริการ ฿${Number(order.rush_fee || 0).toFixed(2)} → ฿${rushFee.toFixed(2)}, แพ็กเกจ "${order.delivery_tier || ""}" → "${deliveryTier}"${rushNote ? `, หมายเหตุ: ${rushNote}` : ""}`,
    );
  }
  if (salesOwnerChanged) statements.push(db.prepare("INSERT INTO order_sales_assignment_history (order_id,old_sales_owner_id,old_sales_owner_name,new_sales_owner_id,new_sales_owner_name,changed_by_id,changed_by_name) VALUES (?,?,?,?,?,?,?)").bind(orderId,order.sales_owner_id,order.sales_owner_name,salesOwner.id,salesOwner.display_name,user.id,user.displayName));
  if (hasVatPolicy) statements.push(db.prepare("UPDATE orders SET tax_invoice_requested=? WHERE id=?").bind(invoiceRequested ? 1 : 0,orderId));

  try {
    await db.batch(statements);
    await syncWorkOrderFromOrder(db, orderId, { actorId: user.id });
  } catch (error) {
    if (isOrderNumberConflict(error)) {
      return Response.json(
        { error: "เลขใบงานนี้ถูกใช้งานแล้ว กรุณาเลือกเลขอื่น" },
        { status: 409 },
      );
    }
    throw error;
  }

  if (orderNumberResult.changed) {
    await audit(
      user,
      orderId,
      "แก้ไขเลขใบงาน",
      `${order.order_number} → ${orderNumber}`,
    );
  }
  if (salesOwnerChanged) await audit(user, orderId, "เปลี่ยนเซลล์ผู้รับผิดชอบ", `${order.sales_owner_name || "ยังไม่ระบุ"} → ${salesOwner.display_name}`);
  if (hasVatPolicy && Number(order.tax_invoice_requested) !== (invoiceRequested ? 1 : 0)) await audit(user,orderId,"เปลี่ยนการขอใบกำกับภาษี",`${invoiceRequested ? "ขอ" : "ไม่ขอ"}ใบกำกับเต็มรูป • ${vatApplied ? "บวก VAT" : "ฝ่ายบัญชีแยกภาษี"} • คงนโยบายเดิมของใบงาน ${order.vat_policy_mode}`);
  await audit(
    user,
    orderId,
    "แก้ไขข้อมูลใบงาน",
    `${contactName} • ${normalized.length} รายการ • ${totalQuantity.toLocaleString()} ชิ้น • รวม ฿${totals.total.toFixed(2)}${repricedLines.length ? ` • คำนวณราคาใหม่รายการ ${repricedLines.join(", ")}` : ""}${manualPriceLines.length ? ` • รายการ ${manualPriceLines.join(", ")} ต้องกำหนดราคาเอง` : ""}`,
  );
  return Response.json({ ok: true, orderNumber, totals, repricedLines, manualPriceLines, productionSynced: true });
}
