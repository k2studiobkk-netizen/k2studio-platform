import { env, waitUntil } from "cloudflare:workers";
import { can, getStaffUser } from "../../../../../../staff-auth";
import { analyzePaymentSlip, markPaymentSlipAnalysisQueued, type PaymentSlipAnalysisEnv } from "../../../../../../payment-slip-analysis";

type AnalysisRow = Record<string, string | number | null>;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user=await getStaffUser(); if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 }); if (!can(user,"finance:slips")) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId < 1) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { receiptId?: number | null };
  const receiptId = Number(body.receiptId || 0);
  const runtime = env as unknown as PaymentSlipAnalysisEnv;
  const file = receiptId > 0
    ? await runtime.DB.prepare("SELECT r.id AS receipt_id,r.file_key,r.file_name,r.amount AS expected_amount FROM order_payment_receipts r WHERE r.id=? AND r.order_id=?").bind(receiptId, orderId).first<AnalysisRow>()
    : await runtime.DB.prepare("SELECT NULL AS receipt_id,payment_slip_key AS file_key,payment_slip_name AS file_name,deposit_amount AS expected_amount FROM orders WHERE id=?").bind(orderId).first<AnalysisRow>();
  if (!file?.file_key) return Response.json({ error: "ไม่พบสลิปที่ต้องการอ่าน" }, { status: 404 });
  const analysisInput = { orderId, receiptId: receiptId > 0 ? receiptId : null, fileKey: String(file.file_key), fileName: String(file.file_name || "payment-slip"), expectedAmount: Number(file.expected_amount || 0) };
  await markPaymentSlipAnalysisQueued(runtime, analysisInput);
  waitUntil(analyzePaymentSlip(runtime, analysisInput));
  return Response.json({ ok: true, status: "queued" }, { status: 202 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user=await getStaffUser(); if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 }); if (!can(user,"finance:slips")) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const orderId = Number(id);
  const receiptId = Number(new URL(request.url).searchParams.get("receipt") || 0);
  const runtime = env as unknown as PaymentSlipAnalysisEnv;
  const analysis = receiptId > 0
    ? await runtime.DB.prepare("SELECT * FROM payment_slip_analyses WHERE order_id=? AND receipt_id=? ORDER BY id DESC LIMIT 1").bind(orderId, receiptId).first<AnalysisRow>()
    : await runtime.DB.prepare("SELECT * FROM payment_slip_analyses WHERE order_id=? AND receipt_id IS NULL ORDER BY id DESC LIMIT 1").bind(orderId).first<AnalysisRow>();
  return analysis ? Response.json({ analysis }) : Response.json({ analysis: null }, { status: 404 });
}
