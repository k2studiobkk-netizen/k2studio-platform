const MODEL = "@cf/moondream/moondream3.1-9B-A2B";

export type PaymentSlipAnalysisInput = {
  orderId: number;
  receiptId?: number | null;
  fileKey: string;
  fileName: string;
  expectedAmount: number;
};

export type PaymentSlipAnalysisEnv = Pick<Cloudflare.Env, "AI" | "DB" | "IMAGES" | "ORDER_FILES">;

type SlipFields = {
  amount: number | null;
  transactionDate: string;
  transactionTime: string;
  referenceNo: string;
  senderName: string;
  receiverName: string;
  confidence: string;
  note: string;
};

function text(value: unknown, max = 250) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function amount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[฿,\s]/g, "").replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseSlipAnswer(answer: string): SlipFields {
  const withoutFence = answer.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) return { amount: null, transactionDate: "", transactionTime: "", referenceNo: "", senderName: "", receiverName: "", confidence: "low", note: "AI ไม่ได้ส่งข้อมูลในรูปแบบที่อ่านได้" };
  const objectText = withoutFence.slice(start, end + 1);
  let value: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(objectText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid result");
    value = parsed as Record<string, unknown>;
  } catch {
    // Vision models occasionally return JSON-like output such as `"time": 22:45`.
    // Recover each known field independently instead of discarding a correctly read amount.
    value = {};
    for (const key of ["amount", "date", "time", "reference", "sender", "receiver", "confidence", "note"] as const) {
      const match = objectText.match(new RegExp(`(?:"${key}"|${key})\\s*:\\s*([^\\r\\n,}]+)`, "i"));
      if (!match) continue;
      const raw = match[1].trim().replace(/^['"]|['"]$/g, "").trim();
      value[key] = /^(?:null|undefined)$/i.test(raw) ? "" : raw;
    }
    if (Object.keys(value).length === 0) return { amount: null, transactionDate: "", transactionTime: "", referenceNo: "", senderName: "", receiverName: "", confidence: "low", note: "AI ส่งข้อมูลกลับมาไม่ครบ กรุณาตรวจสลิปด้วยตนเอง" };
  }
  const confidence = text(value.confidence).toLowerCase();
  return {
    amount: amount(value.amount),
    transactionDate: text(value.date, 40),
    transactionTime: text(value.time, 40),
    referenceNo: text(value.reference, 120),
    senderName: text(value.sender, 180),
    receiverName: text(value.receiver, 180),
    confidence: ["high", "medium", "low"].includes(confidence) ? confidence : "low",
    note: text(value.note, 500),
  };
}

export function slipAmountStatus(detected: number | null, expected: number) {
  if (detected === null) return "unreadable" as const;
  return Math.abs(detected - expected) <= 0.01 ? "matched" as const : "mismatch" as const;
}

function answerFromResult(result: Record<string, unknown>) {
  if (typeof result.answer === "string") return result.answer;
  const nested = result.result;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const answer = (nested as Record<string, unknown>).answer;
    if (typeof answer === "string") return answer;
  }
  return JSON.stringify(result);
}

export async function markPaymentSlipAnalysisQueued(runtime: PaymentSlipAnalysisEnv, input: PaymentSlipAnalysisInput) {
  await runtime.DB.prepare(`INSERT INTO payment_slip_analyses
    (order_id,receipt_id,file_key,file_name,status,expected_amount,updated_at)
    VALUES (?,?,?,?, 'queued', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(file_key) DO UPDATE SET receipt_id=excluded.receipt_id,file_name=excluded.file_name,status='queued',expected_amount=excluded.expected_amount,
      detected_amount='',transaction_date='',transaction_time='',reference_no='',sender_name='',receiver_name='',confidence='',note='',raw_result='',error_message='',updated_at=CURRENT_TIMESTAMP`)
    .bind(input.orderId, input.receiptId ?? null, input.fileKey, input.fileName, input.expectedAmount.toFixed(2)).run();
}

export async function analyzePaymentSlip(runtime: PaymentSlipAnalysisEnv, input: PaymentSlipAnalysisInput) {
  try {
    await runtime.DB.prepare("UPDATE payment_slip_analyses SET status='processing',updated_at=CURRENT_TIMESTAMP WHERE file_key=?").bind(input.fileKey).run();
    const object = await runtime.ORDER_FILES.get(input.fileKey);
    if (!object) throw new Error("ไม่พบไฟล์สลิปในพื้นที่จัดเก็บ");
    const transformed = await runtime.IMAGES.input(object.body)
      .transform({ width: 1400, height: 1400, fit: "scale-down" })
      .output({ format: "image/jpeg", quality: 88, anim: false });
    const encoded = await new Response(transformed.image({ encoding: "base64" })).text();
    if (!encoded || encoded.length > 7_000_000) throw new Error("ภาพสลิปมีขนาดใหญ่เกินกว่าจะอ่านอัตโนมัติ");
    const result = await runtime.AI.run(MODEL, {
      task: "query",
      image: `data:image/jpeg;base64,${encoded}`,
      question: "Read this Thai bank transfer receipt carefully. Return only one valid JSON object. Keys: amount (the transferred amount as a number, never the account balance), date, time, reference, sender, receiver, confidence (high, medium, or low), and note. Use null or an empty string when a field is not visible. Never guess.",
      reasoning: false,
      temperature: 0,
      max_tokens: 500,
      stream: false,
    }, { tags: ["k2sign", "payment-slip-ocr"] });
    const rawAnswer = answerFromResult(result);
    const fields = parseSlipAnswer(rawAnswer);
    const status = fields.confidence === "low" ? "unreadable" : slipAmountStatus(fields.amount, input.expectedAmount);
    await runtime.DB.prepare(`UPDATE payment_slip_analyses SET status=?,detected_amount=?,transaction_date=?,transaction_time=?,reference_no=?,sender_name=?,receiver_name=?,confidence=?,note=?,raw_result=?,error_message='',updated_at=CURRENT_TIMESTAMP WHERE file_key=?`)
      .bind(status, fields.amount === null ? "" : fields.amount.toFixed(2), fields.transactionDate, fields.transactionTime, fields.referenceNo, fields.senderName, fields.receiverName, fields.confidence, fields.note, rawAnswer.slice(0, 8000), input.fileKey).run();
    console.log(JSON.stringify({ event: "payment_slip_analysis_complete", orderId: input.orderId, receiptId: input.receiptId ?? null, status }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ event: "payment_slip_analysis_error", orderId: input.orderId, receiptId: input.receiptId ?? null, error: message }));
    try {
      await runtime.DB.prepare("UPDATE payment_slip_analyses SET status='error',error_message=?,updated_at=CURRENT_TIMESTAMP WHERE file_key=?").bind(message.slice(0, 500), input.fileKey).run();
    } catch (updateError) {
      console.error(JSON.stringify({ event: "payment_slip_analysis_status_error", orderId: input.orderId, error: String(updateError) }));
    }
  }
}
