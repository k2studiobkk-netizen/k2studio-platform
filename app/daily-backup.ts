import { sendTelegram } from "./integrations";

export type BackupEnv = {
  DB: D1Database;
  ORDER_FILES: R2Bucket;
  GOOGLE_CALENDAR_WEBHOOK_URL?: string;
  INTEGRATION_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  PUBLIC_SITE_URL?: string;
};

type Row = Record<string, unknown>;

type BackupFile = {
  category: "artwork" | "payment_slip" | "design" | "progress" | "production_attachment";
  fileName: string;
  fileType: string;
  key: string;
  downloadUrl: string;
};

type BackupOrder = Row & {
  items: Row[];
  adjustments: Row[];
  paymentReceipts: Row[];
  paymentSlipAnalyses: Row[];
  shipments: Row[];
  designs: Array<Row & { assets: Row[] }>;
  statusHistory: Row[];
  progressPhotos: Row[];
  auditLogs: Row[];
  files: BackupFile[];
};

const bangkokDate = (date: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);

const rows = async (db: D1Database, sql: string) => (await db.prepare(sql).all<Row>()).results;

function groupRows(source: Row[], key: string) {
  const groups = new Map<number, Row[]>();
  for (const row of source) {
    const id = Number(row[key]);
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  return groups;
}

function addFile(target: BackupFile[], seen: Set<string>, baseUrl: string, category: BackupFile["category"], key: unknown, name: unknown, type: unknown) {
  const fileKey = String(key || "");
  if (!fileKey || seen.has(fileKey)) return;
  seen.add(fileKey);
  target.push({
    category,
    key: fileKey,
    fileName: String(name || fileKey.split("/").pop() || "file"),
    fileType: String(type || "application/octet-stream"),
    downloadUrl: `${baseUrl}/api/internal/backup-file?key=${encodeURIComponent(fileKey)}`,
  });
}

export async function buildDailyBackup(env: BackupEnv, now = new Date()) {
  const [
    orders, items, adjustments, paymentReceipts, paymentSlipAnalyses, designs, designAssets, history, progress, audits, hardwarePrices, staff, salesAssignments, staffTeams, staffPermissions, salesChannels, commissionTiers,
    customers, products, machines, processes, capacityRules, workOrders, schedules, rushRequests,
    notifications, workOrderHistory, productionAttachments,
    broadcastMessages, broadcastAcknowledgements, broadcastScreens, productionQueueEvents, graphicAlertDeliveries, shipments,
  ] = await Promise.all([
    rows(env.DB, "SELECT * FROM orders ORDER BY id"),
    rows(env.DB, "SELECT * FROM order_items ORDER BY order_id,line_no"),
    rows(env.DB, "SELECT * FROM order_adjustments ORDER BY order_id,id"),
    rows(env.DB, "SELECT * FROM order_payment_receipts ORDER BY order_id,created_at,id"),
    rows(env.DB, "SELECT * FROM payment_slip_analyses ORDER BY order_id,created_at,id"),
    rows(env.DB, "SELECT * FROM design_versions ORDER BY order_id,version_no"),
    rows(env.DB, "SELECT da.*,d.order_id FROM design_assets da JOIN design_versions d ON d.id=da.design_version_id ORDER BY d.order_id,da.design_version_id,da.sort_order"),
    rows(env.DB, "SELECT * FROM order_status_history ORDER BY order_id,created_at,id"),
    rows(env.DB, "SELECT * FROM order_progress_photos ORDER BY order_id,created_at,id"),
    rows(env.DB, "SELECT * FROM audit_logs WHERE order_id IS NOT NULL ORDER BY order_id,created_at,id"),
    rows(env.DB, "SELECT * FROM hardware_prices ORDER BY hardware_code"),
    rows(env.DB, "SELECT id,username,display_name,role,active,created_at,last_login_at FROM staff_users ORDER BY id"),
    rows(env.DB, "SELECT order_id,old_sales_owner_id,old_sales_owner_name,new_sales_owner_id,new_sales_owner_name,changed_by_id,changed_by_name,created_at FROM order_sales_assignment_history ORDER BY id"),
    rows(env.DB, "SELECT user_id,team_code,created_at FROM staff_user_teams ORDER BY user_id,team_code"),
    rows(env.DB, "SELECT user_id,permission_code,created_at FROM staff_user_permissions ORDER BY user_id,permission_code"),
    rows(env.DB, "SELECT * FROM sales_channels ORDER BY sort_order,id"),
    rows(env.DB, "SELECT * FROM commission_tiers ORDER BY effective_from,sales_owner_id,min_sales,id"),
    rows(env.DB, "SELECT * FROM customers ORDER BY id"),
    rows(env.DB, "SELECT * FROM products ORDER BY id"),
    rows(env.DB, "SELECT * FROM machines ORDER BY id"),
    rows(env.DB, "SELECT * FROM production_processes ORDER BY id"),
    rows(env.DB, "SELECT * FROM production_capacity ORDER BY machine_id,process_id,product_id,id"),
    rows(env.DB, "SELECT * FROM work_orders ORDER BY id"),
    rows(env.DB, "SELECT * FROM production_schedule ORDER BY production_date,sequence_no,id"),
    rows(env.DB, "SELECT * FROM rush_requests ORDER BY id"),
    rows(env.DB, "SELECT * FROM notifications ORDER BY id"),
    rows(env.DB, "SELECT * FROM work_order_status_history ORDER BY work_order_id,created_at,id"),
    rows(env.DB, "SELECT * FROM attachments ORDER BY work_order_id,created_at,id"),
    rows(env.DB, "SELECT * FROM broadcast_messages ORDER BY id"),
    rows(env.DB, "SELECT * FROM broadcast_acknowledgements ORDER BY id"),
    rows(env.DB, "SELECT * FROM broadcast_screens ORDER BY id"),
    rows(env.DB, "SELECT * FROM production_queue_events ORDER BY id"),
    rows(env.DB, "SELECT * FROM graphic_alert_deliveries ORDER BY id"),
    rows(env.DB, "SELECT * FROM order_shipments ORDER BY order_id,id"),
  ]);
  const baseUrl = (env.PUBLIC_SITE_URL || "https://order.k2group.site").replace(/\/$/, "");
  // Index related rows once. Re-filtering every table for every order was O(n²)
  // and could eventually exceed a Worker's CPU budget as the database grew.
  const itemsByOrder = groupRows(items, "order_id");
  const adjustmentsByOrder = groupRows(adjustments, "order_id");
  const paymentReceiptsByOrder = groupRows(paymentReceipts, "order_id");
  const paymentAnalysesByOrder = groupRows(paymentSlipAnalyses, "order_id");
  const shipmentsByOrder = groupRows(shipments, "order_id");
  const designsByOrder = groupRows(designs, "order_id");
  const assetsByDesign = groupRows(designAssets, "design_version_id");
  const historyByOrder = groupRows(history, "order_id");
  const progressByOrder = groupRows(progress, "order_id");
  const auditsByOrder = groupRows(audits, "order_id");
  const normalized: BackupOrder[] = orders.map((order) => {
    const orderId = Number(order.id);
    const orderDesigns: Array<Row & { assets: Row[] }> = (designsByOrder.get(orderId) || []).map((design) => ({
      ...design,
      assets: assetsByDesign.get(Number(design.id)) || [],
    }));
    const orderProgress = progressByOrder.get(orderId) || [];
    const orderPayments = paymentReceiptsByOrder.get(orderId) || [];
    const files: BackupFile[] = [];
    const seen = new Set<string>();
    addFile(files, seen, baseUrl, "artwork", order.artwork_key, order.artwork_name, order.artwork_type);
    addFile(files, seen, baseUrl, "payment_slip", order.payment_slip_key, order.payment_slip_name, order.payment_slip_type);
    for (const receipt of orderPayments) addFile(files, seen, baseUrl, "payment_slip", receipt.file_key, receipt.file_name, receipt.file_type);
    for (const design of orderDesigns) {
      addFile(files, seen, baseUrl, "design", design.file_key, design.file_name, design.file_type);
      addFile(files, seen, baseUrl, "design", design.scale_file_key, design.scale_file_name, design.scale_file_type);
      addFile(files, seen, baseUrl, "design", design.mockup_file_key, design.mockup_file_name, design.mockup_file_type);
      for (const asset of design.assets) addFile(files, seen, baseUrl, "design", asset.file_key, asset.file_name, asset.file_type);
    }
    for (const photo of orderProgress) addFile(files, seen, baseUrl, "progress", photo.file_key, photo.file_name, photo.file_type);
    return {
      ...order,
      items: itemsByOrder.get(orderId) || [],
      adjustments: adjustmentsByOrder.get(orderId) || [],
      paymentReceipts: orderPayments,
      paymentSlipAnalyses: paymentAnalysesByOrder.get(orderId) || [],
      shipments: shipmentsByOrder.get(orderId) || [],
      designs: orderDesigns,
      statusHistory: historyByOrder.get(orderId) || [],
      progressPhotos: orderProgress,
      auditLogs: auditsByOrder.get(orderId) || [],
      files,
    };
  });
  const productionFiles: BackupFile[] = [];
  const productionFileKeys = new Set<string>();
  for (const attachment of productionAttachments) {
    addFile(
      productionFiles,
      productionFileKeys,
      baseUrl,
      "production_attachment",
      attachment.file_key,
      attachment.file_name,
      attachment.file_type,
    );
  }
  const backupDate = bangkokDate(now);
  return {
  schemaVersion: 10,
    action: "daily_backup_v1",
    backupDate,
    generatedAt: now.toISOString(),
    source: baseUrl,
    orders: normalized,
    hardwarePrices,
    staff,
    salesAssignments,
    staffTeams,
    staffPermissions,
    salesChannels,
    commissionTiers,
    production: {
      customers,
      products,
      machines,
      processes,
      capacityRules,
      workOrders,
      schedules,
      rushRequests,
      notifications,
      statusHistory: workOrderHistory,
      attachments: productionAttachments,
      files: productionFiles,
      broadcasts: {
        messages: broadcastMessages,
        acknowledgements: broadcastAcknowledgements,
        screens: broadcastScreens,
      },
      queueEvents: productionQueueEvents,
      graphicAlertDeliveries,
    },
    summary: {
      orders: normalized.length,
      workOrders: workOrders.length,
      schedules: schedules.length,
      items: items.length,
      paymentSlipAnalyses: paymentSlipAnalyses.length,
      files: normalized.reduce((sum, order) => sum + order.files.length, 0) + productionFiles.length,
    },
  };
}

export async function runDailyBackup(env: BackupEnv, now = new Date()) {
  const backupDate = bangkokDate(now);
  await env.DB.prepare(`INSERT INTO backup_runs (backup_date,status,started_at,completed_at,error_message)
    VALUES (?,'running',CURRENT_TIMESTAMP,'','')
    ON CONFLICT(backup_date) DO UPDATE SET status='running',started_at=CURRENT_TIMESTAMP,completed_at='',error_message=''`)
    .bind(backupDate).run();
  let r2Key = "";
  let payload: Awaited<ReturnType<typeof buildDailyBackup>> | null = null;
  try {
    payload = await buildDailyBackup(env, now);
    const [year, month] = backupDate.split("-");
    r2Key = `backups/${year}/${month}/${backupDate}/k2sign-orders-${backupDate}.json`;
    await env.ORDER_FILES.put(r2Key, JSON.stringify(payload), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: { backupDate, schemaVersion: String(payload.schemaVersion), orderCount: String(payload.summary.orders) },
    });

    if (!env.GOOGLE_CALENDAR_WEBHOOK_URL || !env.INTEGRATION_SECRET) throw new Error("ยังไม่ได้ตั้งค่าการเชื่อม Google Apps Script");
    const response = await fetch(env.GOOGLE_CALENDAR_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-integration-secret": env.INTEGRATION_SECRET },
      body: JSON.stringify({ secret: env.INTEGRATION_SECRET, ...payload }),
    });
    if (!response.ok) throw new Error(`Google backup ตอบกลับ ${response.status}`);
    const google = await response.json() as { ok?: boolean; driveUrl?: string; sheetUrl?: string; error?: string };
    if (!google.ok) throw new Error(google.error || "Google backup ไม่สำเร็จ");
    await env.DB.prepare(`UPDATE backup_runs SET status='success',r2_key=?,google_drive_url=?,google_sheet_url=?,order_count=?,file_count=?,completed_at=CURRENT_TIMESTAMP,error_message='' WHERE backup_date=?`)
      .bind(r2Key, google.driveUrl || "", google.sheetUrl || "", payload.summary.orders, payload.summary.files, backupDate).run();
    await sendTelegram(env, [
      "✅ สำรองข้อมูล K2SIGN สำเร็จ",
      `วันที่: ${backupDate}`,
      `ใบงาน: ${payload.summary.orders.toLocaleString("th-TH")} งาน`,
      `ไฟล์แนบ: ${payload.summary.files.toLocaleString("th-TH")} ไฟล์`,
      "จัดเก็บแล้ว: Cloudflare R2 + Google Drive + Google Sheet",
    ].join("\n"), [
      ...(google.sheetUrl ? [{ text: "📊 เปิด Google Sheet", url: google.sheetUrl }] : []),
      ...(google.driveUrl ? [{ text: "📁 เปิดโฟลเดอร์สำรอง", url: google.driveUrl }] : []),
    ]);
    return { ok: true as const, backupDate, r2Key, ...google, summary: payload.summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await env.DB.prepare(`UPDATE backup_runs SET status=?,r2_key=?,order_count=?,file_count=?,completed_at=CURRENT_TIMESTAMP,error_message=? WHERE backup_date=?`)
      .bind(r2Key ? "partial" : "failed", r2Key, payload?.summary.orders || 0, payload?.summary.files || 0, message.slice(0, 1000), backupDate).run();
    try {
      await sendTelegram(env, [
        "⚠️ สำรองข้อมูล K2SIGN ไม่ครบ",
        `วันที่: ${backupDate}`,
        `Cloudflare R2: ${r2Key ? "สำเร็จ" : "ไม่สำเร็จ"}`,
        `Google Drive/Sheet: ไม่สำเร็จ`,
        `สาเหตุ: ${message}`,
      ].join("\n"));
    } catch (telegramError) {
      console.error(JSON.stringify({ event: "backup_telegram_error", error: String(telegramError) }));
    }
    throw error;
  }
}
