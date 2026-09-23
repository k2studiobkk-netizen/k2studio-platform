// Transcribed from the user-supplied DBD certificate and PP20, reviewed 2026-09-21.
// Keep the original certificates (including signatures) out of public assets.
// This profile does not change tax treatment or totals of historical orders.
export const companyProfile = Object.freeze({
  legalName: "บริษัท เคทู ไซน์ มีเดีย จำกัด",
  brandName: "K2STUDIO",
  taxId: "0565567000869",
  branchCode: "00000",
  branchName: "สำนักงานใหญ่",
  address: "38 ซอยศูนย์วิจัย 8 แขวงบางกะปิ เขตห้วยขวาง กรุงเทพมหานคร 10310",
  vatRegistered: true,
  vatRegisteredSince: "2025-08-13",
  documentReviewedAt: "2026-09-21",
  // Owner confirmed: show VAT as an addition at order summary, not inside list prices.
  // Customer surcharge only. Accounting separates tax externally during transition.
  priceVatMode: "exclusive",
  priceVatModeConfirmedAt: "2026-09-21",
  transitionalVatChoices: "requested_adds_vat_otherwise_manual_accounting",
  universalVatActivation: "admin_manual_only",
});
