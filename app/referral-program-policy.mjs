// Rules for review/simulation. These do not create commissions, reserve funds, or transfer money.
export const referralProgramPolicy = Object.freeze({
  version: "2026-09-21-manual-review",
  name: "โปรแกรมแนะนำลูกค้าและตัวแทนขาย",
  rewardBasis: "completed_product_sale",
  recruitmentRewardSatang: 0,
  joiningFeeSatang: 0,
  investmentAccepted: false,
  mandatoryStockPurchase: false,
  guaranteedIncome: false,
  maxProposedLevels: 3,
  liveAccrualEnabled: false,
  multiLevelReview: "pending_legal_classification",
  payoutMethod: "company_manual_bank_transfer",
  payoutProvider: null,
  minimumGrossWithdrawalSatang: 10_000,
  payoutExecutionEnabled: false,
});

function money(value, name) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) throw new Error(`${name}: จำนวนเงินไม่ถูกต้อง`);
  return value;
}

export function manualPayoutPreview({ grossSatang, withholdingSatang, memberFeeSatang }) {
  money(grossSatang, "ยอดค่าคอม"); money(withholdingSatang, "ภาษีหัก ณ ที่จ่าย"); money(memberFeeSatang, "ค่าธรรมเนียม");
  if (grossSatang < referralProgramPolicy.minimumGrossWithdrawalSatang) throw new Error("ยอดขอถอนก่อนหักต้องไม่น้อยกว่า 100 บาท");
  if (withholdingSatang + memberFeeSatang >= grossSatang) throw new Error("ยอดโอนสุทธิต้องมากกว่าศูนย์");
  return { grossSatang, withholdingSatang, memberFeeSatang, netTransferSatang: grossSatang - withholdingSatang - memberFeeSatang,
    payoutMethod: referralProgramPolicy.payoutMethod, previewOnly: true, transferExecuted: false };
}

// A future accrual service must obtain every input from verified server-side records.
// This review helper never confers a payment entitlement or legal approval.
export function reviewReferralSale(sale, chain, now) {
  const deny = reason => ({ eligible: false, reason, liveAccrualEnabled: false });
  if (!sale || sale.event !== "product_sale") return deny("ไม่จ่ายจากการสมัคร การแนะนำให้สมัคร หรือการลงทุน");
  if (!sale.orderId || !sale.buyerId || !sale.ruleVersion) return deny("ต้องอ้างอิงใบงาน ผู้ซื้อ และเวอร์ชันเรต");
  if (!Array.isArray(chain) || chain.length < 1 || chain.length > referralProgramPolicy.maxProposedLevels || chain.some(person => !person || typeof person !== "object")) return deny("สายแนะนำไม่ถูกต้อง");
  const ids = chain.map(person => person.memberId);
  if (ids.some(id => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length || ids.includes(sale.buyerId)) return deny("ห้ามแนะนำตัวเองหรือมีสมาชิกซ้ำในสายแนะนำ");
  if (chain.some(person => person.verified !== true || person.active !== true)) return deny("ตรวจสมาชิกและสิทธิ์ผู้รับผลตอบแทนก่อน");
  const timestamps = [now, sale.returnWindowEndsAt].map(value => typeof value === "string" && /Z$/.test(value) ? Date.parse(value) : NaN);
  if (timestamps.some(value => !Number.isFinite(value))) return deny("ต้องตรวจวันสิ้นสุดเงื่อนไขคืนเงิน");
  if (sale.paymentVerified !== true || sale.fulfillmentStatus !== "completed" || timestamps[0] < timestamps[1]) return deny("รอรับเงิน ส่งมอบ และสิ้นสุดช่วงพักยอด");
  if (sale.disputeOpen !== false) return deny("ต้องตรวจข้อพิพาทก่อน");
  const amounts = [sale.itemNetSatang, sale.refundedItemNetSatang, sale.payableSatang, sale.receivedSatang];
  if (amounts.some(amount => !Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000)
      || sale.payableSatang <= 0 || sale.itemNetSatang > sale.payableSatang || sale.receivedSatang < sale.payableSatang
      || sale.refundedItemNetSatang >= sale.itemNetSatang) return deny("ยอดขาย รับชำระ หรือคืนเงินไม่เข้าเงื่อนไข");
  return { eligible: true, reason: "ผ่านเฉพาะกติกาจำลอง ยังไม่เกิดสิทธิ์รับเงิน", commissionBaseSatang: sale.itemNetSatang - sale.refundedItemNetSatang,
    rewardLevels: chain.length, ruleVersion: sale.ruleVersion, liveAccrualEnabled: false };
}
