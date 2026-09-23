import { env, waitUntil } from "cloudflare:workers";
import { audit, can, canManageOrderFinance, canViewOrderSlips, getStaffUser } from "../../../../../staff-auth";
import { analyzePaymentSlip, markPaymentSlipAnalysisQueued, type PaymentSlipAnalysisEnv } from "../../../../../payment-slip-analysis";

const acceptedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser(); if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params; const orderId = Number(id); const form = await request.formData(); const entry = form.get("payment_slip"); const file = entry instanceof File && entry.size ? entry : null; const amount = Number(form.get("amount"));
  if (!file) return Response.json({ error: "กรุณาแนบภาพสลิปของยอดที่รับครั้งนี้" }, { status: 400 });
  if (!acceptedTypes.has(file.type)) return Response.json({ error: "กรุณาเลือกสลิป PNG, JPG หรือ WEBP" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: "ภาพสลิปต้องไม่เกิน 8 MB" }, { status: 400 });
  const runtime = env as unknown as PaymentSlipAnalysisEnv;
  const order = await runtime.DB.prepare("SELECT order_number,estimated_total,shipping_fee,deposit_amount,order_status,payment_slip_key FROM orders WHERE id=?").bind(orderId).first<Record<string, string | number>>();
  if (!order) return Response.json({ error: "Not found" }, { status: 404 });
  const owner = await runtime.DB.prepare("SELECT sales_owner_id FROM orders WHERE id=?").bind(orderId).first<{ sales_owner_id: number | null }>();
  if (!canManageOrderFinance(user, Number(owner?.sales_owner_id || 0))) return Response.json({ error: "บัญชีนี้บันทึกได้เฉพาะใบงานของเซลล์ที่รับผิดชอบ" }, { status: 403 });
  const total = Number(order.estimated_total) + Number(order.shipping_fee || 0); const paid = Number(order.deposit_amount || 0); const outstanding = Math.max(0, total - paid);
  const evidenceOnly = outstanding <= 0.009 && !order.payment_slip_key && amount === 0;
  if (!evidenceOnly && (!Number.isFinite(amount) || amount <= 0 || amount > outstanding + 0.009)) return Response.json({ error: `ยอดรับครั้งนี้ต้องไม่เกินยอดค้าง ฿${outstanding.toLocaleString("th-TH", { minimumFractionDigits: 2 })}` }, { status: 400 });
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-"); const key = `payment-receipts/${order.order_number}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safe}`;
  await runtime.ORDER_FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  const newPaid = evidenceOnly ? paid : Math.min(total, paid + amount); const note = evidenceOnly ? `แนบหลักฐานประกอบยอดรับชำระเดิม ฿${paid.toLocaleString("th-TH", { minimumFractionDigits: 2 })}` : `รับชำระเพิ่ม ฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} • รับชำระสะสม ฿${newPaid.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`;
  const receipt = await runtime.DB.prepare("INSERT INTO order_payment_receipts (order_id,amount,file_name,file_key,file_type,created_by_id,created_by_name) VALUES (?,?,?,?,?,?,?) RETURNING id").bind(orderId, amount.toFixed(2), file.name, key, file.type, user.id, user.displayName).first<{ id: number }>();
  if (!receipt) return Response.json({ error: "ไม่สามารถบันทึกรายการสลิปได้" }, { status: 500 });
  const statements = [runtime.DB.prepare("UPDATE orders SET deposit_amount=?,payment_confirmed_at=CURRENT_TIMESTAMP,payment_confirmed_by=? WHERE id=?").bind(newPaid.toFixed(2), user.displayName, orderId), runtime.DB.prepare("INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)").bind(orderId, String(order.order_status), note)];
  if (!order.payment_slip_key) statements.push(runtime.DB.prepare("UPDATE orders SET payment_slip_name=?,payment_slip_key=?,payment_slip_type=? WHERE id=?").bind(file.name, key, file.type, orderId));
  await runtime.DB.batch(statements); await audit(user, orderId, "บันทึกรับชำระ", `${note} • ${file.name}`);
  const analysisInput = { orderId, receiptId: receipt.id, fileKey: key, fileName: file.name, expectedAmount: evidenceOnly ? paid : amount };
  await markPaymentSlipAnalysisQueued(runtime, analysisInput);
  waitUntil(analyzePaymentSlip(runtime, analysisInput));
  return Response.json({
    ok: true,
    paidAmount: newPaid,
    outstanding: Math.max(0, total - newPaid),
    revenueRecordedToday: evidenceOnly ? 0 : amount,
    analysisQueued: true,
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user=await getStaffUser(); if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params; const orderId = Number(id); const runtime = env as unknown as { DB: D1Database; ORDER_FILES: R2Bucket }; const owner = await runtime.DB.prepare("SELECT sales_owner_id FROM orders WHERE id=?").bind(orderId).first<{ sales_owner_id: number | null }>(); if (!canViewOrderSlips(user, Number(owner?.sales_owner_id || 0))) return new Response("Forbidden", { status: 403 }); const receiptId = Number(new URL(request.url).searchParams.get("receipt"));
  const file = receiptId > 0 ? await runtime.DB.prepare("SELECT file_key,file_type FROM order_payment_receipts WHERE id=? AND order_id=?").bind(receiptId, orderId).first<Record<string, string>>() : await runtime.DB.prepare("SELECT payment_slip_key AS file_key,payment_slip_type AS file_type FROM orders WHERE id=?").bind(orderId).first<Record<string, string>>();
  if (!file?.file_key) return new Response("Not found", { status: 404 }); const object = await runtime.ORDER_FILES.get(file.file_key); if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "content-type": file.file_type, "cache-control": "private, max-age=60", "x-content-type-options": "nosniff" } });
}
