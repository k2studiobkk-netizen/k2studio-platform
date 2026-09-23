import { GRAPHIC_ALERT_START_AT } from "./graphic-alert-policy";

type IntegrationEnv = {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  GOOGLE_CALENDAR_WEBHOOK_URL?: string;
  INTEGRATION_SECRET?: string;
  ADMIN_HOSTNAME?: string;
  PUBLIC_SITE_URL?: string;
};

type OrderNotice = {
  id: number;
  publicToken: string;
  orderNumber: string;
  contactName: string;
  phone: string;
  requestedDate: string;
  quantity: number;
  estimatedTotal: string;
};

const telegramUrl = (token: string) => `https://api.telegram.org/bot${token}/sendMessage`;
const telegramPhotoUrl = (token: string) => `https://api.telegram.org/bot${token}/sendPhoto`;

type TelegramButton={text:string;url:string};

export async function sendTelegram(env: IntegrationEnv, text: string, buttons: TelegramButton[] = []) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const response = await fetch(telegramUrl(env.TELEGRAM_BOT_TOKEN), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true, ...(buttons.length?{reply_markup:{inline_keyboard:buttons.map(button=>[button])}}:{}) }),
  });
  if (!response.ok) throw new Error(`Telegram notification failed: ${response.status}`);
}

export async function sendTelegramPhoto(env: IntegrationEnv, photoUrl: string, caption: string, buttons: TelegramButton[] = []) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) throw new Error("Telegram is not configured");
  const response = await fetch(telegramPhotoUrl(env.TELEGRAM_BOT_TOKEN), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      photo: photoUrl,
      caption,
      ...(buttons.length ? { reply_markup: { inline_keyboard: buttons.map((button) => [button]) } } : {}),
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error(JSON.stringify({ event: "telegram_photo_failed", status: response.status, detail: detail.slice(0, 300) }));
    throw new Error(`Telegram photo notification failed: ${response.status}`);
  }
}

export async function notifyNewOrder(env: IntegrationEnv, order: OrderNotice) {
  const baseUrl=(env.PUBLIC_SITE_URL||"https://order.k2group.site").replace(/\/$/,"");
  const adminUrl = `${baseUrl}/admin/orders/${order.id}`;
  const documentUrl=`${baseUrl}/order/${order.publicToken}`;
  const productionUrl=`${documentUrl}?mode=production`;
  const message = [
    "🆕 ใบสั่งงานใหม่ K2SIGN",
    `เลขที่: ${order.orderNumber}`,
    `ลูกค้า: ${order.contactName}`,
    `โทร: ${order.phone}`,
    `จำนวน: ${order.quantity.toLocaleString("th-TH")} ชิ้น`,
    `วันส่งงาน: ${order.requestedDate}`,
    `ยอดประมาณ: ฿${Number(order.estimatedTotal).toLocaleString("th-TH")}`,
    `ดูใบงาน: ${documentUrl}`,
    `ใบงานฝ่ายผลิต / บันทึก PDF: ${productionUrl}`,
    `เปิดในหลังบ้าน: ${adminUrl}`,
  ].join("\n");

  const tasks: Promise<unknown>[] = [sendTelegram(env, message,[
    {text:"📄 ดูใบงาน",url:documentUrl},
    {text:"⬇️ ใบงานฝ่ายผลิต / PDF",url:productionUrl},
    {text:"⚙️ เปิดในหลังบ้าน",url:adminUrl},
  ])];
  if (env.GOOGLE_CALENDAR_WEBHOOK_URL && env.INTEGRATION_SECRET) {
    tasks.push(fetch(env.GOOGLE_CALENDAR_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: env.INTEGRATION_SECRET, ...order, adminUrl }),
    }).then((response) => {
      if (!response.ok) throw new Error(`Calendar webhook failed: ${response.status}`);
    }));
  }
  const results = await Promise.allSettled(tasks);
  for (const result of results) if (result.status === "rejected") console.error(JSON.stringify({ event: "integration_error", error: String(result.reason) }));
}

export async function notifyPaymentConfirmed(env:IntegrationEnv,order:OrderNotice,amount:number,confirmedBy:string){
  const baseUrl=(env.PUBLIC_SITE_URL||"https://order.k2group.site").replace(/\/$/,"");
  const documentUrl=`${baseUrl}/order/${order.publicToken}`;
  const productionUrl=`${documentUrl}?mode=production`;
  const adminUrl=`${baseUrl}/admin/orders/${order.id}`;
  const message=["✅ ยืนยันชำระเงินแล้ว • เปิดใบงานได้",`เลขที่: ${order.orderNumber}`,`ลูกค้า: ${order.contactName}`,`ยอดรับชำระ: ฿${amount.toLocaleString("th-TH",{minimumFractionDigits:2})}`,`ยืนยันโดย: ${confirmedBy}`,`ดูใบงาน: ${documentUrl}`,`ใบงานฝ่ายผลิต / บันทึก PDF: ${productionUrl}`].join("\n");
  await sendTelegram(env,message,[
    {text:"📄 ดูใบงาน",url:documentUrl},
    {text:"⬇️ ใบงานฝ่ายผลิต / PDF",url:productionUrl},
    {text:"⚙️ เปิดในหลังบ้าน",url:adminUrl},
  ]);
}

export async function sendDueReminders(env: IntegrationEnv, now = new Date()) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const bangkokDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const result = await env.DB.prepare(`
    SELECT id, public_token, order_number, contact_name, phone, requested_date, quantity, estimated_total,
      CAST(julianday(requested_date) - julianday(?) AS INTEGER) AS offset_days
    FROM orders
    WHERE order_status NOT IN ('completed','cancelled')
      AND CAST(julianday(requested_date) - julianday(?) AS INTEGER) IN (0,1,3)
      AND NOT EXISTS (
        SELECT 1 FROM reminder_deliveries r
        WHERE r.order_id = orders.id
          AND r.offset_days = CAST(julianday(orders.requested_date) - julianday(?) AS INTEGER)
      )
  `).bind(bangkokDate, bangkokDate, bangkokDate).all<Record<string, string | number>>();

  for (const order of result.results) {
    const offset = Number(order.offset_days);
    const heading = offset === 0 ? "🚨 ถึงวันส่งงานแล้ว" : `⏰ เหลือ ${offset} วันถึงวันส่งงาน`;
    const baseUrl=(env.PUBLIC_SITE_URL||"https://order.k2group.site").replace(/\/$/,"");
    const documentUrl=`${baseUrl}/order/${order.public_token}`;
    const productionUrl=`${documentUrl}?mode=production`;
    const adminUrl=`${baseUrl}/admin/orders/${order.id}`;
    await sendTelegram(env, [heading, `เลขที่: ${order.order_number}`, `ลูกค้า: ${order.contact_name}`, `โทร: ${order.phone}`, `วันส่งงาน: ${order.requested_date}`, `จำนวน: ${Number(order.quantity).toLocaleString("th-TH")} ชิ้น`, `ดูใบงาน: ${documentUrl}`, `ใบงานฝ่ายผลิต / PDF: ${productionUrl}`].join("\n"),[
      {text:"📄 ดูใบงาน",url:documentUrl},
      {text:"⬇️ ใบงานฝ่ายผลิต / PDF",url:productionUrl},
      {text:"⚙️ เปิดในหลังบ้าน",url:adminUrl},
    ]);
    await env.DB.prepare("INSERT OR IGNORE INTO reminder_deliveries (order_id, offset_days) VALUES (?, ?)").bind(Number(order.id), offset).run();
  }
}

type GraphicAlertRow = Record<string, string | number> & { alert_type: string };

const graphicAlertHeading: Record<string, string> = {
  unclaimed_24h: "🚨 งานกราฟิกยังไม่มีคนรับเกิน 24 ชม.",
  working_24h: "⏰ รับงานกราฟิกแล้วแต่ยังไม่ส่งแบบเกิน 24 ชม.",
  confirmation_24h: "⚠️ แบบรอลูกค้าคอนเฟิร์มเกิน 24 ชม.",
};
const graphicResolvedStatus: Record<string, string> = {
  waiting_for_artwork_review: "รับงานกราฟิกแล้ว",
  waiting_for_graphic: "อยู่ระหว่างทำแบบ",
  artwork_approval_pending: "ส่งแบบแล้ว / รอลูกค้าคอนเฟิร์ม",
  in_production: "อนุมัติและส่งผลิตแล้ว",
  waiting_for_packing: "รอแพ็ก",
  packing: "กำลังแพ็ก",
  ready_to_ship: "พร้อมส่ง",
  shipped: "ส่งแล้ว",
  completed: "เสร็จสมบูรณ์",
  cancelled: "ยกเลิกงาน",
};

/** Runs hourly. Delivery rows make each overdue stage idempotent and allow one resolution notice. */
export async function sendGraphicWorkflowAlerts(env: IntegrationEnv) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  // Retire legacy alerts silently. Otherwise the first run after introducing
  // the cutoff would send a misleading flood of "resolved" notifications.
  await env.DB.prepare(`UPDATE graphic_alert_deliveries
    SET resolved_at=CURRENT_TIMESTAMP,resolved_notified_at=CURRENT_TIMESTAMP
    WHERE resolved_at='' AND order_id IN (SELECT id FROM orders WHERE created_at<?)`)
    .bind(GRAPHIC_ALERT_START_AT).run();
  const active = (await env.DB.prepare(`
    SELECT o.id,o.order_number,o.contact_name,o.sales_owner_name,o.requested_date,o.order_status,
      o.graphic_claimed_by_name,o.graphic_claimed_at,o.created_at,'unclaimed_24h' AS alert_type,o.created_at AS stage_started_at
    FROM orders o
    WHERE o.order_status IN ('waiting_for_artwork_review','waiting_for_graphic')
      AND o.created_at>=?
      AND o.graphic_claimed_at='' AND o.created_at<=datetime('now','-24 hours')
      AND NOT EXISTS (SELECT 1 FROM design_versions d WHERE d.order_id=o.id)
    UNION ALL
    SELECT o.id,o.order_number,o.contact_name,o.sales_owner_name,o.requested_date,o.order_status,
      o.graphic_claimed_by_name,o.graphic_claimed_at,o.created_at,'working_24h',o.graphic_claimed_at
    FROM orders o
    WHERE o.order_status IN ('waiting_for_artwork_review','waiting_for_graphic')
      AND o.created_at>=?
      AND o.graphic_claimed_at<>'' AND o.graphic_claimed_at<=datetime('now','-24 hours')
      AND NOT EXISTS (SELECT 1 FROM design_versions d WHERE d.order_id=o.id)
    UNION ALL
    SELECT o.id,o.order_number,o.contact_name,o.sales_owner_name,o.requested_date,o.order_status,
      o.graphic_claimed_by_name,o.graphic_claimed_at,o.created_at,'confirmation_24h',d.created_at
    FROM orders o JOIN design_versions d ON d.id=(SELECT id FROM design_versions WHERE order_id=o.id ORDER BY version_no DESC,id DESC LIMIT 1)
    WHERE o.order_status='artwork_approval_pending' AND d.status='pending' AND o.created_at>=? AND d.created_at<=datetime('now','-24 hours')
    ORDER BY stage_started_at LIMIT 20
  `).bind(GRAPHIC_ALERT_START_AT, GRAPHIC_ALERT_START_AT, GRAPHIC_ALERT_START_AT).all<GraphicAlertRow>()).results;
  const activeKeys = new Set(active.map((row) => `${Number(row.id)}:${row.alert_type}:${row.stage_started_at}`));
  const baseUrl = (env.PUBLIC_SITE_URL || "https://order.k2group.site").replace(/\/$/, "");

  for (const order of active) {
    const inserted = await env.DB.prepare("INSERT OR IGNORE INTO graphic_alert_deliveries (order_id,alert_type,stage_key) VALUES (?,?,?)")
      .bind(Number(order.id), order.alert_type, String(order.stage_started_at)).run();
    if (!inserted.meta.changes) continue;
    const adminUrl = `${baseUrl}/admin/orders/${order.id}`;
    const parsed = Date.parse(String(order.stage_started_at).replace(" ", "T") + "Z");
    const hours = Number.isFinite(parsed) ? Math.max(24, Math.floor((Date.now() - parsed) / 3_600_000)) : 24;
    try {
      await sendTelegram(env, [
        graphicAlertHeading[order.alert_type],
        `เลขที่: ${order.order_number}`,
        `ลูกค้า: ${order.contact_name}`,
        `เซลล์: ${order.sales_owner_name || "ยังไม่ระบุ"}`,
        ...(order.graphic_claimed_by_name ? [`กราฟิก: ${order.graphic_claimed_by_name}`] : []),
        `ค้างในขั้นตอนนี้: ประมาณ ${hours} ชั่วโมง`,
        `กำหนดส่ง: ${order.requested_date || "ยังไม่กำหนด"}`,
      ].join("\n"), [{ text: "🎨 เปิดใบงาน", url: adminUrl }]);
    } catch (error) {
      await env.DB.prepare("DELETE FROM graphic_alert_deliveries WHERE order_id=? AND alert_type=? AND stage_key=? AND resolved_at='' ").bind(Number(order.id), order.alert_type, String(order.stage_started_at)).run();
      throw error;
    }
  }

  const unresolved = (await env.DB.prepare(`SELECT a.order_id,a.alert_type,a.stage_key,o.order_number,o.order_status,o.graphic_claimed_by_name
    FROM graphic_alert_deliveries a JOIN orders o ON o.id=a.order_id
    WHERE a.resolved_at='' ORDER BY a.id LIMIT 20`).all<Record<string, string | number>>()).results;
  for (const item of unresolved) {
    if (activeKeys.has(`${Number(item.order_id)}:${item.alert_type}:${item.stage_key}`)) continue;
    const updated = await env.DB.prepare("UPDATE graphic_alert_deliveries SET resolved_at=CURRENT_TIMESTAMP WHERE order_id=? AND alert_type=? AND stage_key=? AND resolved_at='' ")
      .bind(Number(item.order_id), String(item.alert_type), String(item.stage_key)).run();
    if (!updated.meta.changes) continue;
    try {
      await sendTelegram(env, [
        "✅ อัปเดตงานกราฟิกแล้ว",
        `เลขที่: ${item.order_number}`,
        `คำเตือนเดิม: ${graphicAlertHeading[String(item.alert_type)]?.replace(/^[^ ]+ /, "") || item.alert_type}`,
        `สถานะปัจจุบัน: ${graphicResolvedStatus[String(item.order_status)] || item.order_status}`,
        ...(item.graphic_claimed_by_name ? [`ผู้รับงาน: ${item.graphic_claimed_by_name}`] : []),
      ].join("\n"), [{ text: "ดูสถานะล่าสุด", url: `${baseUrl}/admin/orders/${item.order_id}` }]);
      await env.DB.prepare("UPDATE graphic_alert_deliveries SET resolved_notified_at=CURRENT_TIMESTAMP WHERE order_id=? AND alert_type=? AND stage_key=?").bind(Number(item.order_id), String(item.alert_type), String(item.stage_key)).run();
    } catch (error) {
      await env.DB.prepare("UPDATE graphic_alert_deliveries SET resolved_at='' WHERE order_id=? AND alert_type=? AND stage_key=? AND resolved_notified_at='' ").bind(Number(item.order_id), String(item.alert_type), String(item.stage_key)).run();
      throw error;
    }
  }
}
