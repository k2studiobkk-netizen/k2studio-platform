// Customer collection policy, NOT a tax return or an exemption decision.
export const VAT_TRANSITION = "manual_accounting_transition";
export const VAT_ALL_ORDERS = "all_orders";
export const VAT_POLICY_MODES = Object.freeze([VAT_TRANSITION, VAT_ALL_ORDERS]);
export const vatPolicyModeLabel = mode => mode === VAT_ALL_ORDERS ? "บวก VAT ทุกใบงานใหม่" : "ชั่วคราว — บวกเมื่อขอใบกำกับ";

export function vatCollectionDecision(mode, invoiceRequested) {
  if (!VAT_POLICY_MODES.includes(mode) || typeof invoiceRequested !== "boolean") throw new Error("กรุณาเลือกการขอใบกำกับภาษีให้ชัดเจน");
  const addVat = mode === VAT_ALL_ORDERS || invoiceRequested;
  return { addVat, invoiceRequested, accountingTreatment: addVat ? "collected_at_summary" : "manual_accounting_pending" };
}

export function orderTaxCollectionLabel(order) {
  if (!VAT_POLICY_MODES.includes(order.vat_policy_mode)) return "ข้อมูลเดิม — ยังไม่ได้จัดประเภทการแยกภาษี";
  return Number(order.vat_applied) === 1 ? "บวก VAT ในยอดเรียกเก็บแล้ว" : "ไม่บวก VAT เพิ่มกับลูกค้า — รอฝ่ายบัญชีแยกภาษี";
}

export async function getVatCollectionPolicy(db) {
  const row = await db.prepare("SELECT mode,revision,updated_at FROM vat_collection_settings WHERE id=1").first();
  if (!row || !VAT_POLICY_MODES.includes(row.mode) || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error("ยังไม่พร้อมโหลดนโยบาย VAT กรุณาตรวจ migration");
  return { mode: row.mode, revision: row.revision, updatedAt: row.updated_at };
}
