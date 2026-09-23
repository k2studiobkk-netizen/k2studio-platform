export const ORDER_CHANNEL_PREFIXES = Object.freeze({
  facebook_k2sign: "K2",
  facebook_sweetdesign: "SW",
  line_k2sign: "LK",
  line_k2studio: "LS",
});

export function orderPrefixForChannel(channel) {
  return ORDER_CHANNEL_PREFIXES[String(channel ?? "").trim()] ?? "";
}

export function formatSequentialOrderNumber(prefix, sequence) {
  const normalizedPrefix = String(prefix ?? "").trim().toUpperCase();
  const normalizedSequence = Number(sequence);
  if (!Object.values(ORDER_CHANNEL_PREFIXES).includes(normalizedPrefix)) {
    throw new Error("Invalid order prefix");
  }
  if (!Number.isInteger(normalizedSequence) || normalizedSequence < 1) {
    throw new Error("Invalid order sequence");
  }
  return `${normalizedPrefix}-${String(normalizedSequence).padStart(4, "0")}`;
}
