export const EDITABLE_ORDER_NUMBER_PATTERN = /^[A-Z0-9]{2,6}-\d{4,}$/;

export function normalizeOrderNumber(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function validateOrderNumberChange(currentValue, requestedValue) {
  const current = normalizeOrderNumber(currentValue);
  const requested = normalizeOrderNumber(requestedValue);

  if (!requested) {
    return { ok: false, error: "กรุณากรอกเลขใบงาน" };
  }

  // Older work orders use K2K-YYYYMMDD-XXXXXXXX. They remain valid when the
  // user edits other details without changing the order number.
  if (requested === current) {
    return { ok: true, value: current, changed: false };
  }

  if (!EDITABLE_ORDER_NUMBER_PATTERN.test(requested)) {
    return { ok: false, error: "เลขใบงานต้องใช้อักษรนำหน้าช่องทาง 2–6 ตัว ตามด้วยเลขอย่างน้อย 4 หลัก เช่น K2-1233" };
  }

  return { ok: true, value: requested, changed: true };
}
