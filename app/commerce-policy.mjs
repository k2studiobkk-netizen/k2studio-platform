// Pure, integer-satang calculations. These are planning tools, not a payout engine.
export const proposedKeychainShipping = Object.freeze([
  { max: 100, feeSatang: 5000 }, { max: 300, feeSatang: 7000 },
  { max: 500, feeSatang: 10000 }, { max: 1000, feeSatang: 15000 },
]);
function integer(value, name, max = 1_000_000_000) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`${name}: invalid non-negative integer`);
  return value;
}
function bps(value, name) { return integer(value, name, 10000); }
const portion = (amount, rate) => Math.round(amount * rate / 10000);

export function quoteProposedShipping(lines) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 50) throw new Error("ไม่มีรายการสินค้า");
  let quantity = 0;
  for (const line of lines) {
    integer(line.quantity, "quantity", 1_000_000);
    if (!line.quantity) throw new Error("จำนวนต้องมากกว่าศูนย์");
    if (line.productType !== "acrylic_keychain") return { status: "needs_rate", feeSatang: null, reason: "สินค้าผสมหรือสินค้าอื่นยังไม่กำหนดเรต" };
    quantity += line.quantity;
  }
  const tier = proposedKeychainShipping.find(t => quantity <= t.max);
  return tier ? { status: "draft", feeSatang: tier.feeSatang, reason: "เรตเสนอสำหรับส่งพร้อมกันหนึ่งที่อยู่ ยังไม่ใช้กับใบงานจริง" }
    : { status: "needs_rate", feeSatang: null, reason: "เกิน 1,000 ชิ้น ต้องกำหนดเรตเพิ่มเติม" };
}

export function calculateVatSnapshot(amountSatang, mode, rateBps) {
  integer(amountSatang, "amount"); bps(rateBps, "VAT rate");
  if (!["inclusive", "exclusive"].includes(mode)) throw new Error("ต้องยืนยันว่าราคารวมหรือไม่รวม VAT ก่อน");
  const tax = mode === "inclusive" ? Math.round(amountSatang * rateBps / (10000 + rateBps)) : portion(amountSatang, rateBps);
  return { netSatang: mode === "inclusive" ? amountSatang - tax : amountSatang, taxSatang: tax,
    totalSatang: mode === "inclusive" ? amountSatang : amountSatang + tax, mode, rateBps };
}

export function simulatePartnerEconomics(input) {
  const { revenueSatang, productionCostSatang, shippingSubsidySatang, paymentFeeSatang,
    pointsReserveSatang, bonusReserveSatang, employeeRateBps, partnerRateBps,
    upstreamRatesBps, minMarginBps, route } = input;
  for (const [name, value] of Object.entries({ revenueSatang, productionCostSatang, shippingSubsidySatang,
    paymentFeeSatang, pointsReserveSatang, bonusReserveSatang })) integer(value, name);
  if (!revenueSatang) throw new Error("ยอดสินค้าต้องมากกว่าศูนย์");
  if (!["self_order", "referral_order"].includes(route)) throw new Error("รูปแบบการขายไม่ถูกต้อง");
  bps(employeeRateBps, "employee"); bps(partnerRateBps, "partner"); bps(minMarginBps, "margin");
  if (!Array.isArray(upstreamRatesBps) || upstreamRatesBps.length !== 2) throw new Error("จำลองได้สองชั้นเหนือผู้ขายเท่านั้น");
  upstreamRatesBps.forEach(rate => bps(rate, "upstream"));
  if (employeeRateBps + partnerRateBps + upstreamRatesBps.reduce((a, b) => a + b, 0) > 10000) throw new Error("ผลตอบแทนรวมเกิน 100%");
  const partnerBenefitSatang = portion(revenueSatang, partnerRateBps);
  const employeeSatang = portion(revenueSatang, employeeRateBps);
  const upstreamSatang = upstreamRatesBps.map(rate => portion(revenueSatang, rate));
  const benefitSatang = partnerBenefitSatang + employeeSatang + upstreamSatang.reduce((a, b) => a + b, 0) + pointsReserveSatang + bonusReserveSatang;
  const contributionSatang = revenueSatang - productionCostSatang - shippingSubsidySatang - paymentFeeSatang - benefitSatang;
  return { mode: "simulation_only", payoutsEnabled: false, revenueSatang, partnerBenefitSatang,
    partnerDiscountSatang: route === "self_order" ? partnerBenefitSatang : 0,
    partnerCommissionSatang: route === "referral_order" ? partnerBenefitSatang : 0,
    employeeSatang, upstreamSatang, benefitSatang, contributionSatang,
    marginBps: Math.round(contributionSatang / revenueSatang * 10000),
    passesMargin: contributionSatang >= portion(revenueSatang, minMarginBps),
  };
}
