import { env, waitUntil } from "cloudflare:workers";
import { audit, getStaffUser } from "../../../../../staff-auth";
import { publishBroadcastEvent } from "../../../../../broadcast-server";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

function getImages(form: FormData, name: string) {
  return form.getAll(name).filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function validateImages(files: File[], label: string) {
  if (files.length > 10) return `${label}อัปโหลดได้ไม่เกิน 10 ภาพต่อครั้ง`;
  if (files.some((file) => !file.type.startsWith("image/"))) return `กรุณาเลือก${label}เป็นไฟล์ PNG, JPG หรือ WEBP`;
  if (files.some((file) => file.size > MAX_FILE_SIZE)) return `${label}แต่ละภาพต้องมีขนาดไม่เกิน 15 MB`;
  return "";
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const orderId = Number(id);
  const form = await request.formData();
  const requestedOrderItemId = Number(form.get("order_item_id"));
  const scaleFiles = getImages(form, "scale_design");
  const mockupFiles = getImages(form, "mockup_design");
  if (!scaleFiles.length && !mockupFiles.length) return Response.json({ error: "กรุณาเลือกภาพแบบมีสเกลหรือภาพม็อกอัปอย่างน้อย 1 ภาพ" }, { status: 400 });
  const validationError = validateImages(scaleFiles, "ภาพแบบมีสเกล") || validateImages(mockupFiles, "ภาพม็อกอัป");
  if (validationError) return Response.json({ error: validationError }, { status: 400 });

  const runtime = env as unknown as { DB: D1Database; ORDER_FILES: R2Bucket };
  const order = await runtime.DB.prepare("SELECT order_number,graphic_claimed_at FROM orders WHERE id = ?").bind(orderId).first<{ order_number: string; graphic_claimed_at: string }>();
  if (!order) return Response.json({ error: "Not found" }, { status: 404 });
  const orderItems = (await runtime.DB.prepare("SELECT id,line_no,item_name FROM order_items WHERE order_id=? ORDER BY line_no").bind(orderId).all<{ id: number; line_no: number; item_name: string }>()).results;
  const selectedItem = orderItems.find((item) => item.id === requestedOrderItemId) || (orderItems.length === 1 ? orderItems[0] : undefined);
  if (!selectedItem) return Response.json({ error: "กรุณาเลือกรายการสินค้าที่ตรงกับภาพ" }, { status: 400 });
  const workOrder = await runtime.DB.prepare("SELECT id,status FROM work_orders WHERE order_id=? LIMIT 1").bind(orderId).first<{ id: number; status: string }>();
  if (workOrder && ["in_production", "waiting_for_packing", "packing", "ready_to_ship", "shipped", "completed"].includes(workOrder.status)) {
    return Response.json({ error: "งานเริ่มผลิตแล้ว หากต้องเปลี่ยนแบบ กรุณาให้ผู้จัดการนำงานออกจากคิวก่อน" }, { status: 409 });
  }
  const latest = await runtime.DB.prepare("SELECT COALESCE(MAX(version_no),0) AS version_no FROM design_versions WHERE order_id = ?").bind(orderId).first<{ version_no: number }>();
  const version = Number(latest?.version_no || 0) + 1;
  const previousAssets = (await runtime.DB.prepare(`SELECT order_item_id,asset_type,file_name,file_key,file_type,caption,sort_order
    FROM design_assets WHERE design_version_id=(SELECT id FROM design_versions WHERE order_id=? ORDER BY version_no DESC LIMIT 1)`)
    .bind(orderId).all<{ order_item_id: number | null; asset_type: string; file_name: string; file_key: string; file_type: string; caption: string; sort_order: number }>()).results;
  const caption = (type: "scale" | "mockup", index: number) => String(form.get(`${type}_caption_${index}`) || "").trim().slice(0, 300);
  const assets = [
    ...scaleFiles.map((file, index) => ({ type: "scale" as const, file, caption: caption("scale", index), key: `designs/${order.order_number}/v${version}-scale-${index + 1}-${safeName(file.name)}`, sort: index + 1 })),
    ...mockupFiles.map((file, index) => ({ type: "mockup" as const, file, caption: caption("mockup", index), key: `designs/${order.order_number}/v${version}-mockup-${index + 1}-${safeName(file.name)}`, sort: index + 1 })),
  ];
  await Promise.all(assets.map(async (asset) => runtime.ORDER_FILES.put(asset.key, await asset.file.arrayBuffer(), { httpMetadata: { contentType: asset.file.type } })));

  const firstScale = assets.find((asset) => asset.type === "scale");
  const firstMockup = assets.find((asset) => asset.type === "mockup");
  const primary = firstMockup || firstScale!;

  const note = String(form.get("note") || "").trim().slice(0, 500);
  const saved = await runtime.DB.prepare("INSERT INTO design_versions (order_id,version_no,file_name,file_key,file_type,scale_file_name,scale_file_key,scale_file_type,mockup_file_name,mockup_file_key,mockup_file_type,note,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id")
    .bind(orderId, version, primary.file.name, primary.key, primary.file.type, firstScale?.file.name || "", firstScale?.key || "", firstScale?.file.type || "", firstMockup?.file.name || "", firstMockup?.key || "", firstMockup?.file.type || "", note, "pending", user.displayName)
    .first<{ id: number }>();
  if (!saved) return Response.json({ error: "ไม่สามารถบันทึกเวอร์ชันแบบได้" }, { status: 500 });
  await runtime.DB.batch([
    runtime.DB.prepare("UPDATE design_versions SET status = 'superseded' WHERE order_id = ? AND status IN ('pending','approved') AND id <> ?").bind(orderId, saved.id),
    ...previousAssets.filter((asset) => Number(asset.order_item_id) !== selectedItem.id).map((asset) => runtime.DB.prepare("INSERT INTO design_assets (design_version_id,order_item_id,asset_type,file_name,file_key,file_type,caption,sort_order) VALUES (?,?,?,?,?,?,?,?)").bind(saved.id, asset.order_item_id, asset.asset_type, asset.file_name, asset.file_key, asset.file_type, asset.caption, asset.sort_order)),
    ...assets.map((asset) => runtime.DB.prepare("INSERT INTO design_assets (design_version_id,order_item_id,asset_type,file_name,file_key,file_type,caption,sort_order) VALUES (?,?,?,?,?,?,?,?)").bind(saved.id, selectedItem.id, asset.type, asset.file.name, asset.key, asset.file.type, asset.caption, asset.sort)),
    runtime.DB.prepare("UPDATE orders SET order_status = 'artwork_approval_pending', production_released_at = '', production_released_by = '', graphic_claimed_by_id=CASE WHEN graphic_claimed_at='' THEN ? ELSE graphic_claimed_by_id END, graphic_claimed_by_name=CASE WHEN graphic_claimed_at='' THEN ? ELSE graphic_claimed_by_name END, graphic_claimed_at=CASE WHEN graphic_claimed_at='' THEN CURRENT_TIMESTAMP ELSE graphic_claimed_at END WHERE id = ?").bind(user.id, user.displayName, orderId),
    runtime.DB.prepare("INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)").bind(orderId, "artwork_approval_pending", `ส่งแบบ V${version} รายการ ${selectedItem.line_no} จำนวน ${assets.length} ภาพให้ลูกค้าอนุมัติ`),
    ...(workOrder ? [
      runtime.DB.prepare("UPDATE work_orders SET status='draft',graphic_owner_id=?,planned_production_date='',confirmed_delivery_date='',queue_removed=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(user.id, workOrder.id),
      runtime.DB.prepare("UPDATE production_schedule SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE work_order_id=? AND status NOT IN ('completed','cancelled')").bind(workOrder.id),
      runtime.DB.prepare("INSERT INTO work_order_status_history (work_order_id,status,note,changed_by) VALUES (?,?,?,?)").bind(workOrder.id, "draft", `ส่งแบบ V${version} ให้ลูกค้าอนุมัติ • นำออกจากคิวจนกว่าจะอนุมัติ`, user.id),
    ] : []),
  ]);
  await audit(user, orderId, "อัปโหลดแบบให้ลูกค้าอนุมัติ", `แบบ V${version} • รายการ ${selectedItem.line_no} ${selectedItem.item_name || ""} • ภาพสเกล ${scaleFiles.length} ภาพ • ภาพม็อกอัป ${mockupFiles.length} ภาพ`);
  if (workOrder) waitUntil(publishBroadcastEvent({
    type: "production.queue_updated",
    departments: ["print_cut", "pack", "sale"],
    workOrderId: workOrder.id,
    action: "design_sent",
  }).catch((error) => console.error("design realtime publish failed", { orderId, error: String(error) })));
  return Response.json({ ok: true, version, imageCount: assets.length, orderStatus: "artwork_approval_pending" });
}
