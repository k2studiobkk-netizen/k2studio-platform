import { env } from "cloudflare:workers";
import { audit, can, canViewOrderFinance, getStaffUser, type StaffUser } from "../../../staff-auth";
import { GRAPHIC_ALERT_START_AT } from "../../../graphic-alert-policy";
import { statusLabels } from "../../../order-status";

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const ORDER_NUMBER = /\b(?:K2K|K2|SW|LK|LS)-[A-Z0-9-]+\b/i;

type AssistantAction = { type: "add_note"; orderId: number; orderNumber: string; note: string };
type AssistantEnv = { DB: D1Database; AI: Ai };
type OrderRow = Record<string, string | number | null>;

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function aiResponseText(result: unknown) {
  if (!result || typeof result !== "object") return "";
  const record = result as Record<string, unknown>;
  if (typeof record.response === "string") return record.response.trim();
  if (typeof record.answer === "string") return record.answer.trim();
  return "";
}

function maySeeAllFinance(user: StaffUser) {
  return can(user, "finance:view") || can(user, "sales:view_all") || can(user, "sales:view_team");
}

function orderSummary(row: OrderRow, financeVisible: boolean) {
  const total = Number(row.estimated_total || 0) + Number(row.shipping_fee || 0);
  const paid = Number(row.deposit_amount || 0);
  return {
    id: Number(row.id),
    orderNumber: String(row.order_number),
    customer: String(row.contact_name || "-"),
    status: statusLabels[String(row.order_status)] || String(row.order_status),
    dueDate: String(row.confirmed_delivery_date || row.requested_date || "ยังไม่กำหนด"),
    graphicOwner: String(row.graphic_claimed_by_name || "ยังไม่มีกราฟิกรับ"),
    productionStatus: String(row.work_status || "ยังไม่มีคิวผลิต"),
    productionDate: String(row.planned_production_date || "ยังไม่กำหนด"),
    queueNote: String(row.dashboard_note || ""),
    ...(financeVisible ? { total: money(total), paid: money(paid), outstanding: money(Math.max(0, total - paid)) } : {}),
  };
}

function fallbackAnswer(kind: string, data: Array<Record<string, unknown>>) {
  if (!data.length) return kind === "order" ? "ไม่พบใบงานตามรหัสที่ระบุ กรุณาตรวจเลขใบงานอีกครั้งครับ" : "ตอนนี้ไม่พบรายการที่ตรงกับคำถามครับ";
  if (kind === "order") {
    const item = data[0];
    const finance = item.outstanding ? ` • ยอดค้าง ฿${item.outstanding}` : "";
    return `${item.orderNumber} • ${item.customer}\nสถานะ: ${item.status}\nกำหนดส่ง: ${item.dueDate}\nกราฟิก: ${item.graphicOwner}\nคิวผลิต: ${item.productionStatus}${finance}`;
  }
  return data.slice(0, 8).map((item, index) => `${index + 1}. ${item.orderNumber} • ${item.status || item.productionStatus || ""} • ส่ง ${item.dueDate || "ยังไม่กำหนด"}`).join("\n");
}

async function exactOrder(database: D1Database, orderNumber: string) {
  return database.prepare(`SELECT o.id,o.order_number,o.contact_name,o.order_status,o.requested_date,o.estimated_total,o.shipping_fee,o.deposit_amount,o.sales_owner_id,o.graphic_claimed_by_name,
    wo.status AS work_status,wo.planned_production_date,wo.confirmed_delivery_date,wo.dashboard_note
    FROM orders o LEFT JOIN work_orders wo ON wo.order_id=o.id WHERE UPPER(o.order_number)=UPPER(?) LIMIT 1`).bind(orderNumber).first<OrderRow>();
}

async function answerWithAi(runtime: AssistantEnv, question: string, kind: string, data: Array<Record<string, unknown>>, financeVisible: boolean) {
  const fallback = fallbackAnswer(kind, data);
  try {
    const result = await runtime.AI.run(MODEL, {
      messages: [
        { role: "system", content: "คุณคือ K2 Assistant สำหรับทีมงานหลังบ้าน ตอบภาษาไทยให้สั้น ชัดเจน และเป็นมิตร ใช้เฉพาะข้อมูลใน CONTEXT เท่านั้น ห้ามเดาข้อมูล ห้ามสร้างยอดเงินหรือสถานะขึ้นเอง หากไม่มีข้อมูลให้บอกว่าไม่พบ หาก financeVisible=false ห้ามกล่าวถึงยอดเงิน" },
        { role: "user", content: `คำถาม: ${question}\nประเภทข้อมูล: ${kind}\nfinanceVisible: ${financeVisible}\nCONTEXT: ${JSON.stringify(data).slice(0, 10000)}` },
      ],
      max_tokens: 420,
      temperature: 0.1,
      stream: false,
    });
    return aiResponseText(result) || fallback;
  } catch (error) {
    console.error(JSON.stringify({ event: "staff_ai_answer_failed", message: error instanceof Error ? error.message : String(error) }));
    return fallback;
  }
}

export async function POST(request: Request) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const runtime = env as unknown as AssistantEnv;
  const body = await request.json().catch(() => ({})) as { message?: string; confirmAction?: AssistantAction };

  if (body.confirmAction?.type === "add_note") {
    const action = body.confirmAction;
    const note = clean(action.note, 500);
    if (!note) return Response.json({ error: "กรุณาระบุข้อความโน้ต" }, { status: 400 });
    const order = await runtime.DB.prepare("SELECT id,order_number,order_status FROM orders WHERE id=? AND UPPER(order_number)=UPPER(?) LIMIT 1").bind(Number(action.orderId), clean(action.orderNumber, 80)).first<OrderRow>();
    if (!order) return Response.json({ error: "ไม่พบใบงานที่ต้องการเพิ่มโน้ต" }, { status: 404 });
    await runtime.DB.prepare("INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)").bind(Number(order.id), String(order.order_status), `โน้ตจาก ${user.displayName}: ${note}`).run();
    await audit(user, Number(order.id), "เพิ่มโน้ตผ่าน K2 Assistant", note);
    return Response.json({ answer: `เพิ่มโน้ตในใบงาน ${order.order_number} เรียบร้อยแล้วครับ`, links: [{ label: `เปิด ${order.order_number}`, href: `/admin/orders/${order.id}` }] }, { headers: { "cache-control": "no-store" } });
  }

  const message = clean(body.message, 500);
  if (!message) return Response.json({ error: "กรุณาพิมพ์คำถาม" }, { status: 400 });
  const orderNumber = message.match(ORDER_NUMBER)?.[0]?.toUpperCase() || "";
  const wantsNote = /(?:เพิ่ม|ใส่|บันทึก)\s*(?:โน้ต|โนต|หมายเหตุ)/i.test(message);

  if (wantsNote) {
    if (!orderNumber) return Response.json({ answer: "กรุณาระบุเลขใบงานและข้อความ เช่น “เพิ่มโน้ต K2-1248 ว่า ลูกค้าขอรับก่อน 16:00 น.”" });
    const order = await exactOrder(runtime.DB, orderNumber);
    if (!order) return Response.json({ answer: `ไม่พบใบงาน ${orderNumber} กรุณาตรวจรหัสอีกครั้งครับ` });
    const note = clean(message.split(/(?:ว่า|:)/).slice(1).join(":") || message.replace(/(?:เพิ่ม|ใส่|บันทึก)\s*(?:โน้ต|โนต|หมายเหตุ)/i, "").replace(ORDER_NUMBER, ""), 500);
    if (!note) return Response.json({ answer: `ต้องการเพิ่มข้อความอะไรใน ${orderNumber} ครับ ลองพิมพ์ “เพิ่มโน้ต ${orderNumber} ว่า …”` });
    const action: AssistantAction = { type: "add_note", orderId: Number(order.id), orderNumber: String(order.order_number), note };
    return Response.json({ answer: `กำลังจะเพิ่มโน้ตใน ${order.order_number}:\n“${note}”\nกรุณาตรวจข้อความแล้วกดยืนยัน`, pendingAction: action, links: [{ label: `เปิด ${order.order_number}`, href: `/admin/orders/${order.id}` }] });
  }

  let kind = "help";
  let rows: OrderRow[] = [];
  if (orderNumber) {
    kind = "order";
    const row = await exactOrder(runtime.DB, orderNumber);
    if (row) rows = [row];
  } else if (/กราฟิก|กราฟฟิก|รอรับ|รอคอนเฟิร์ม|รอแบบ/i.test(message)) {
    kind = "graphic";
    rows = (await runtime.DB.prepare(`SELECT o.id,o.order_number,o.contact_name,o.order_status,o.requested_date,o.estimated_total,o.shipping_fee,o.deposit_amount,o.sales_owner_id,o.graphic_claimed_by_name,
      wo.status AS work_status,wo.planned_production_date,wo.confirmed_delivery_date,wo.dashboard_note
      FROM orders o LEFT JOIN work_orders wo ON wo.order_id=o.id
      WHERE o.created_at>=? AND o.order_status IN ('waiting_for_artwork_review','waiting_for_graphic','artwork_approval_pending','artwork_changes_requested')
      ORDER BY o.created_at ASC LIMIT 12`).bind(GRAPHIC_ALERT_START_AT).all<OrderRow>()).results;
  } else if (/ส่งวันนี้|วันนี้.*ส่ง|กำหนดส่งวันนี้/i.test(message)) {
    kind = "due_today";
    rows = (await runtime.DB.prepare(`SELECT o.id,o.order_number,o.contact_name,o.order_status,o.requested_date,o.estimated_total,o.shipping_fee,o.deposit_amount,o.sales_owner_id,o.graphic_claimed_by_name,
      wo.status AS work_status,wo.planned_production_date,wo.confirmed_delivery_date,wo.dashboard_note
      FROM orders o LEFT JOIN work_orders wo ON wo.order_id=o.id
      WHERE date(COALESCE(NULLIF(wo.confirmed_delivery_date,''),o.requested_date))=date('now','+7 hours') AND o.order_status NOT IN ('cancelled','completed')
      ORDER BY o.requested_date,o.id LIMIT 12`).all<OrderRow>()).results;
  } else if (/ยอดค้าง|ค้างชำระ|ยังไม่จ่าย/i.test(message)) {
    kind = "outstanding";
    if (!can(user, "finance:view") && !can(user, "sales:view_all") && !can(user, "sales:view_team") && !can(user, "sales:view_self")) return Response.json({ answer: "บัญชีนี้ไม่มีสิทธิ์ดูข้อมูลยอดค้างชำระครับ" }, { status: 403 });
    const sql = `SELECT o.id,o.order_number,o.contact_name,o.order_status,o.requested_date,o.estimated_total,o.shipping_fee,o.deposit_amount,o.sales_owner_id,o.graphic_claimed_by_name,
      wo.status AS work_status,wo.planned_production_date,wo.confirmed_delivery_date,wo.dashboard_note FROM orders o LEFT JOIN work_orders wo ON wo.order_id=o.id
      WHERE o.order_status<>'cancelled' AND CAST(o.estimated_total AS REAL)+CAST(COALESCE(o.shipping_fee,0) AS REAL)-CAST(COALESCE(o.deposit_amount,0) AS REAL)>0.009 ${maySeeAllFinance(user) ? "" : "AND o.sales_owner_id=?"}
      ORDER BY COALESCE(NULLIF(wo.confirmed_delivery_date,''),o.requested_date),o.id LIMIT 12`;
    const statement = runtime.DB.prepare(sql);
    rows = (maySeeAllFinance(user) ? await statement.all<OrderRow>() : await statement.bind(user.id).all<OrderRow>()).results;
  } else if (/คิว|ผลิต|ปฏิทิน/i.test(message)) {
    kind = "production_queue";
    rows = (await runtime.DB.prepare(`SELECT o.id,o.order_number,o.contact_name,o.order_status,o.requested_date,o.estimated_total,o.shipping_fee,o.deposit_amount,o.sales_owner_id,o.graphic_claimed_by_name,
      wo.status AS work_status,wo.planned_production_date,wo.confirmed_delivery_date,wo.dashboard_note
      FROM work_orders wo JOIN orders o ON o.id=wo.order_id WHERE wo.status NOT IN ('completed','cancelled') AND wo.queue_removed=0
      ORDER BY CASE WHEN wo.queue_rank>0 THEN 0 ELSE 1 END,wo.queue_rank,COALESCE(NULLIF(wo.confirmed_delivery_date,''),o.requested_date),wo.id LIMIT 12`).all<OrderRow>()).results;
  }

  if (kind === "help") return Response.json({ answer: "ถามข้อมูลล่าสุดได้เลยครับ เช่น “K2-1248 อยู่ขั้นตอนไหน”, “วันนี้มีงานส่งอะไรบ้าง”, “มีงานกราฟิกรอรับไหม”, “ขอดูคิวผลิต” หรือ “เพิ่มโน้ต K2-1248 ว่า …”" });

  const data = rows.map(row => orderSummary(row, canViewOrderFinance(user, Number(row.sales_owner_id || 0))));
  const financeVisible = data.some(item => "outstanding" in item);
  const answer = await answerWithAi(runtime, message, kind, data, financeVisible);
  const links = rows.slice(0, 8).map(row => ({ label: String(row.order_number), href: `/admin/orders/${row.id}` }));
  return Response.json({ answer, links }, { headers: { "cache-control": "no-store" } });
}
