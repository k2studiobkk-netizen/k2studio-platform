export function calculateCommission(sales, salesOwnerId, referenceDate, tiers) {
  const amount = Math.max(0, Number(sales) || 0);
  const ownerId = Number(salesOwnerId) || 0;
  const eligible = tiers.filter((tier) => {
    const tierOwner = Number(tier.salesOwnerId) || 0;
    const minimum = Number(tier.minSales) || 0;
    const maximum = tier.maxSales == null ? null : Number(tier.maxSales);
    return (tierOwner === ownerId || tierOwner === 0) && amount >= minimum && (maximum == null || amount < maximum) && String(tier.effectiveFrom) <= referenceDate && (!tier.effectiveTo || String(tier.effectiveTo) >= referenceDate);
  }).sort((a, b) => {
    const ownerPriority = (Number(b.salesOwnerId) === ownerId ? 1 : 0) - (Number(a.salesOwnerId) === ownerId ? 1 : 0);
    return ownerPriority || String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)) || Number(b.minSales) - Number(a.minSales);
  });
  const tier = eligible[0];
  const rate = tier ? Math.max(0, Number(tier.ratePercent) || 0) : 0;
  return { rate, amount: Math.round(amount * rate) / 100, tierName: tier ? String(tier.tierName) : "" };
}
