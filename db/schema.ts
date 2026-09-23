import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderNumber: text("order_number").notNull().unique(),
  publicToken: text("public_token").notNull().default("").unique(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  contactName: text("contact_name").notNull(), phone: text("phone").notNull(),
  lineId: text("line_id").notNull().default(""), email: text("email").notNull().default(""),
  contactChannel: text("contact_channel").notNull().default(""), socialContactName: text("social_contact_name").notNull().default(""),
  fileDeliveryMethod: text("file_delivery_method").notNull().default("upload"), externalFileUrl: text("external_file_url").notNull().default(""), fileDeliveryNote: text("file_delivery_note").notNull().default(""),
  address: text("address").notNull().default(""), province: text("province").notNull().default(""),
  requestedDate: text("requested_date").notNull().default(""), thicknessMm: text("thickness_mm").notNull(),
  widthCm: text("width_cm").notNull(), heightCm: text("height_cm").notNull(), pricingSizeCm: integer("pricing_size_cm").notNull(),
  quantity: integer("quantity").notNull(), printSides: integer("print_sides").notNull(),
  hardwareCode: text("hardware_code").notNull(), hardwareName: text("hardware_name").notNull(),
  hardwareColor: text("hardware_color").notNull().default(""), packagingType: text("packaging_type").notNull(),
  rushMode: text("rush_mode").notNull().default("normal"), requestedSpeedDays: integer("requested_speed_days").notNull().default(0),
  deliveryTier: text("delivery_tier").notNull().default(""), rushFee: text("rush_fee").notNull().default("0"),
  rushNote: text("rush_note").notNull().default(""),
  artworkName: text("artwork_name").notNull().default(""), artworkKey: text("artwork_key").notNull().default(""), artworkType: text("artwork_type").notNull().default(""),
  estimatedUnitPrice: text("estimated_unit_price").notNull(), estimatedSubtotal: text("estimated_subtotal").notNull().default("0"),
  vatApplied: integer("vat_applied").notNull().default(0), vatAmount: text("vat_amount").notNull().default("0"), estimatedTotal: text("estimated_total").notNull(),
  taxInvoiceRequested: integer("tax_invoice_requested"),
  vatPolicyMode: text("vat_policy_mode").notNull().default(""), vatPolicyRevision: integer("vat_policy_revision"),
  discountAmount: text("discount_amount").notNull().default("0"),
  shippingFee: text("shipping_fee").notNull().default("0"), depositAmount: text("deposit_amount").notNull().default("0"),
  salesOwnerId: integer("sales_owner_id"), salesOwnerName: text("sales_owner_name").notNull().default(""),
  paymentSlipName: text("payment_slip_name").notNull().default(""), paymentSlipKey: text("payment_slip_key").notNull().default(""),
  paymentSlipType: text("payment_slip_type").notNull().default(""), paymentConfirmedAt: text("payment_confirmed_at").notNull().default(""),
  paymentConfirmedBy: text("payment_confirmed_by").notNull().default(""),
  productionReleasedAt: text("production_released_at").notNull().default(""),
  productionReleasedBy: text("production_released_by").notNull().default(""),
  productionFileUrl: text("production_file_url").notNull().default(""),
  productionFileNote: text("production_file_note").notNull().default(""),
  productionFileUpdatedAt: text("production_file_updated_at").notNull().default(""),
  productionFileUpdatedBy: text("production_file_updated_by").notNull().default(""),
  priceStatus: text("price_status").notNull().default("pending_review"), orderStatus: text("order_status").notNull().default("waiting_for_artwork_review"),
});

export const vatCollectionSettings = sqliteTable("vat_collection_settings", {
  id: integer("id").primaryKey(), mode: text("mode").notNull(), revision: integer("revision").notNull().default(1),
  updatedBy: integer("updated_by"), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  changeId: text("change_id").notNull().default(""),
});

export const orderAdjustments = sqliteTable("order_adjustments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  label: text("label").notNull(),
  amount: text("amount").notNull(),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_order_adjustments_order").on(table.orderId)]);

export const orderPaymentReceipts = sqliteTable("order_payment_receipts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  amount: text("amount").notNull(),
  fileName: text("file_name").notNull(),
  fileKey: text("file_key").notNull(),
  fileType: text("file_type").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_order_payment_receipts_order_created").on(table.orderId, table.createdAt)]);

export const orderSalesAssignmentHistory = sqliteTable("order_sales_assignment_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  oldSalesOwnerId: integer("old_sales_owner_id"),
  oldSalesOwnerName: text("old_sales_owner_name").notNull().default(""),
  newSalesOwnerId: integer("new_sales_owner_id"),
  newSalesOwnerName: text("new_sales_owner_name").notNull().default(""),
  changedById: integer("changed_by_id").notNull(),
  changedByName: text("changed_by_name").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_sales_assignment_order_created").on(table.orderId, table.createdAt)]);

export const salesChannels = sqliteTable("sales_channels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull().unique(),
  platform: text("platform").notNull().default(""),
  active: integer("active").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: text("created_by").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_sales_channels_active_sort").on(table.active, table.sortOrder, table.name)]);

export const salesShareLinks = sqliteTable("sales_share_links", {
  token: text("token").primaryKey(),
  staffUserId: integer("staff_user_id").notNull().references(() => staffUsers.id),
  productId: text("product_id").notNull(),
  campaign: text("campaign").notNull().default(""),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("idx_sales_share_campaign").on(table.staffUserId, table.productId, table.campaign), index("idx_sales_share_owner").on(table.staffUserId, table.createdAt)]);

export const commissionTiers = sqliteTable("commission_tiers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  salesOwnerId: integer("sales_owner_id"),
  tierName: text("tier_name").notNull(),
  minSales: real("min_sales").notNull().default(0),
  maxSales: real("max_sales"),
  ratePercent: real("rate_percent").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to").notNull().default(""),
  active: integer("active").notNull().default(1),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_commission_tiers_owner_effective").on(table.salesOwnerId, table.effectiveFrom, table.effectiveTo, table.minSales)]);

export const paymentSlipAnalyses = sqliteTable("payment_slip_analyses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  receiptId: integer("receipt_id"),
  fileKey: text("file_key").notNull().unique(),
  fileName: text("file_name").notNull().default(""),
  status: text("status").notNull().default("queued"),
  expectedAmount: text("expected_amount").notNull().default("0"),
  detectedAmount: text("detected_amount").notNull().default(""),
  transactionDate: text("transaction_date").notNull().default(""),
  transactionTime: text("transaction_time").notNull().default(""),
  referenceNo: text("reference_no").notNull().default(""),
  senderName: text("sender_name").notNull().default(""),
  receiverName: text("receiver_name").notNull().default(""),
  confidence: text("confidence").notNull().default(""),
  note: text("note").notNull().default(""),
  rawResult: text("raw_result").notNull().default(""),
  errorMessage: text("error_message").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_payment_slip_analyses_order").on(table.orderId, table.createdAt),
  index("idx_payment_slip_analyses_receipt").on(table.receiptId),
]);

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  lineNo: integer("line_no").notNull(),
  productType: text("product_type").notNull().default("acrylic_keychain"),
  itemName: text("item_name").notNull().default(""),
  itemDescription: text("item_description").notNull().default(""),
  thicknessMm: text("thickness_mm").notNull(),
  widthCm: text("width_cm").notNull(),
  heightCm: text("height_cm").notNull(),
  pricingSizeCm: integer("pricing_size_cm").notNull(),
  quantity: integer("quantity").notNull(),
  printSides: integer("print_sides").notNull(),
  hardwareCode: text("hardware_code").notNull(),
  hardwareName: text("hardware_name").notNull(),
  hardwareColor: text("hardware_color").notNull().default(""),
  packagingType: text("packaging_type").notNull(),
  unitPrice: text("unit_price").notNull(),
  lineTotal: text("line_total").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_order_items_order_line").on(table.orderId, table.lineNo),
  index("idx_order_items_order").on(table.orderId),
]);

export const hardwarePrices = sqliteTable("hardware_prices", {
  hardwareCode: text("hardware_code").primaryKey(),
  price: text("price").notNull(),
  updatedBy: text("updated_by").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const designVersions = sqliteTable("design_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }), orderId: integer("order_id").notNull(), versionNo: integer("version_no").notNull(),
  fileName: text("file_name").notNull(), fileKey: text("file_key").notNull(), fileType: text("file_type").notNull(), note: text("note").notNull().default(""),
  scaleFileName: text("scale_file_name").notNull().default(""), scaleFileKey: text("scale_file_key").notNull().default(""), scaleFileType: text("scale_file_type").notNull().default(""),
  mockupFileName: text("mockup_file_name").notNull().default(""), mockupFileKey: text("mockup_file_key").notNull().default(""), mockupFileType: text("mockup_file_type").notNull().default(""),
  status: text("status").notNull().default("pending"), createdBy: text("created_by").notNull().default(""), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  customerNote: text("customer_note").notNull().default(""), respondedBy: text("responded_by").notNull().default(""), respondedAt: text("responded_at").notNull().default(""),
}, (table) => [uniqueIndex("idx_design_order_version").on(table.orderId, table.versionNo), index("idx_design_order_status").on(table.orderId, table.status)]);

export const designAssets = sqliteTable("design_assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  designVersionId: integer("design_version_id").notNull(),
  orderItemId: integer("order_item_id"),
  assetType: text("asset_type").notNull(),
  fileName: text("file_name").notNull(),
  fileKey: text("file_key").notNull(),
  fileType: text("file_type").notNull(),
  caption: text("caption").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_design_assets_version_type").on(table.designVersionId, table.assetType, table.sortOrder),
  index("idx_design_assets_order_item").on(table.orderItemId, table.designVersionId, table.sortOrder),
]);

export const orderStatusHistory = sqliteTable("order_status_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  status: text("status").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_order_history_order_created").on(table.orderId, table.createdAt)]);

export const orderProgressPhotos = sqliteTable("order_progress_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  status: text("status").notNull().default(""),
  fileName: text("file_name").notNull(),
  fileKey: text("file_key").notNull(),
  fileType: text("file_type").notNull(),
  caption: text("caption").notNull().default(""),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_order_progress_order_created").on(table.orderId, table.createdAt),
  index("idx_order_progress_status").on(table.orderId, table.status),
]);

export const reminderDeliveries = sqliteTable("reminder_deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  offsetDays: integer("offset_days").notNull(),
  sentAt: text("sent_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_reminder_order_offset").on(table.orderId, table.offsetDays)]);

export const staffUsers = sqliteTable("staff_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(), displayName: text("display_name").notNull(),
  role: text("role").notNull().default("staff"), passwordHash: text("password_hash").notNull(), passwordSalt: text("password_salt").notNull(),
  mustChangePassword: integer("must_change_password").notNull().default(1), active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), lastLoginAt: text("last_login_at").notNull().default(""),
});

export const staffUserTeams = sqliteTable("staff_user_teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => staffUsers.id, { onDelete: "cascade" }),
  teamCode: text("team_code").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_staff_user_teams_user_team").on(table.userId, table.teamCode),
  index("idx_staff_user_teams_team_user").on(table.teamCode, table.userId),
]);

export const staffUserPermissions = sqliteTable("staff_user_permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => staffUsers.id, { onDelete: "cascade" }),
  permissionCode: text("permission_code").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_staff_user_permissions_user_code").on(table.userId, table.permissionCode),
  index("idx_staff_user_permissions_code_user").on(table.permissionCode, table.userId),
]);

export const staffSessions = sqliteTable("staff_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: integer("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(), expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_staff_sessions_user").on(table.userId), index("idx_staff_sessions_expiry").on(table.expiresAt)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }), orderId: integer("order_id"),
  userId: integer("user_id").notNull(), username: text("username").notNull(), displayName: text("display_name").notNull(),
  action: text("action").notNull(), details: text("details").notNull().default(""),
  entityType: text("entity_type").notNull().default("order"), entityId: integer("entity_id"), fieldName: text("field_name").notNull().default(""),
  oldValue: text("old_value").notNull().default(""), newValue: text("new_value").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_audit_order_created").on(table.orderId, table.createdAt), index("idx_audit_user_created").on(table.userId, table.createdAt)]);

export const backupRuns = sqliteTable("backup_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  backupDate: text("backup_date").notNull().unique(),
  status: text("status").notNull().default("running"),
  r2Key: text("r2_key").notNull().default(""),
  googleDriveUrl: text("google_drive_url").notNull().default(""),
  googleSheetUrl: text("google_sheet_url").notNull().default(""),
  orderCount: integer("order_count").notNull().default(0),
  fileCount: integer("file_count").notNull().default(0),
  errorMessage: text("error_message").notNull().default(""),
  startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at").notNull().default(""),
}, (table) => [uniqueIndex("idx_backup_runs_date").on(table.backupDate), index("idx_backup_runs_started").on(table.startedAt)]);

export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerNumber: text("customer_number").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  lineId: text("line_id").notNull().default(""),
  contactChannel: text("contact_channel").notNull().default(""),
  socialContactName: text("social_contact_name").notNull().default(""),
  address: text("address").notNull().default(""),
  province: text("province").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_customers_phone").on(table.phone), index("idx_customers_email").on(table.email)]);

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_products_category").on(table.category, table.active)]);

export const machines = sqliteTable("machines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  department: text("department").notNull().default(""),
  dailyCapacityMinutes: integer("daily_capacity_minutes").notNull().default(480),
  busyThreshold: integer("busy_threshold").notNull().default(70),
  nearlyFullThreshold: integer("nearly_full_threshold").notNull().default(90),
  fullThreshold: integer("full_threshold").notNull().default(100),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_machines_active").on(table.active, table.name)]);

export const productionProcesses = sqliteTable("production_processes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  sequenceNo: integer("sequence_no").notNull().default(0),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const productionCapacity = sqliteTable("production_capacity", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id"),
  machineId: integer("machine_id").notNull(),
  processId: integer("process_id"),
  unitsPerHour: real("units_per_hour").notNull().default(0),
  setupMinutes: integer("setup_minutes").notNull().default(0),
  capacityUnit: text("capacity_unit").notNull().default("items"),
  notes: text("notes").notNull().default(""),
  active: integer("active").notNull().default(1),
  createdBy: integer("created_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_capacity_machine_product_process").on(table.machineId, table.productId, table.processId, table.active)]);

export const workOrders = sqliteTable("work_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workOrderNumber: text("work_order_number").notNull().unique(),
  orderId: integer("order_id").notNull().unique(),
  customerId: integer("customer_id"),
  salesOwnerId: integer("sales_owner_id"),
  graphicOwnerId: integer("graphic_owner_id"),
  productId: integer("product_id"),
  productName: text("product_name").notNull().default(""),
  productCategory: text("product_category").notNull().default(""),
  quantity: integer("quantity").notNull().default(0),
  size: text("size").notNull().default(""),
  material: text("material").notNull().default(""),
  thickness: text("thickness").notNull().default(""),
  printSpecification: text("print_specification").notNull().default(""),
  customerRequestedDate: text("customer_requested_date").notNull().default(""),
  plannedProductionDate: text("planned_production_date").notNull().default(""),
  confirmedDeliveryDate: text("confirmed_delivery_date").notNull().default(""),
  priority: text("priority").notNull().default("normal"),
  rushStatus: text("rush_status").notNull().default("none"),
  deliveryMethod: text("delivery_method").notNull().default(""),
  notes: text("notes").notNull().default(""),
  dashboardNote: text("dashboard_note").notNull().default(""),
  queueRank: integer("queue_rank").notNull().default(0),
  queueRemoved: integer("queue_removed").notNull().default(0),
  queueUpdatedAt: text("queue_updated_at").notNull().default(""),
  status: text("status").notNull().default("waiting_for_production"),
  createdBy: integer("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_work_orders_status_delivery").on(table.status, table.confirmedDeliveryDate), index("idx_work_orders_planned_date").on(table.plannedProductionDate), index("idx_work_orders_queue").on(table.status, table.queueRemoved, table.queueRank, table.confirmedDeliveryDate)]);

export const productionSchedule = sqliteTable("production_schedule", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workOrderId: integer("work_order_id").notNull(),
  machineId: integer("machine_id").notNull(),
  processId: integer("process_id"),
  productionDate: text("production_date").notNull(),
  quantity: integer("quantity").notNull().default(0),
  estimatedMinutes: integer("estimated_minutes").notNull().default(0),
  sequenceNo: integer("sequence_no").notNull().default(0),
  status: text("status").notNull().default("scheduled"),
  overrideReason: text("override_reason").notNull().default(""),
  createdBy: integer("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_schedule_date_machine").on(table.productionDate, table.machineId, table.status), index("idx_schedule_work_order").on(table.workOrderId, table.productionDate)]);

export const productionQueueEvents = sqliteTable("production_queue_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workOrderId: integer("work_order_id").notNull(),
  department: text("department").notNull(),
  action: text("action").notNull(),
  note: text("note").notNull().default(""),
  fromStatus: text("from_status").notNull().default(""),
  toStatus: text("to_status").notNull().default(""),
  fromRank: integer("from_rank").notNull().default(0),
  toRank: integer("to_rank").notNull().default(0),
  changedBy: integer("changed_by").notNull(),
  changedByName: text("changed_by_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_queue_events_work_order").on(table.workOrderId, table.createdAt), index("idx_queue_events_department").on(table.department, table.createdAt)]);

export const rushRequests = sqliteTable("rush_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workOrderId: integer("work_order_id").notNull(),
  requestedDate: text("requested_date").notNull(),
  reason: text("reason").notNull(),
  importance: text("importance").notNull().default("normal"),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("pending"),
  approvedDate: text("approved_date").notNull().default(""),
  requestedBy: integer("requested_by").notNull(),
  decidedBy: integer("decided_by"),
  decisionNote: text("decision_note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  decidedAt: text("decided_at").notNull().default(""),
}, (table) => [index("idx_rush_status_created").on(table.status, table.createdAt)]);

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  workOrderId: integer("work_order_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  readAt: text("read_at").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_notifications_user_unread").on(table.userId, table.readAt, table.createdAt)]);

export const workOrderStatusHistory = sqliteTable("work_order_status_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workOrderId: integer("work_order_id").notNull(),
  status: text("status").notNull(),
  note: text("note").notNull().default(""),
  changedBy: integer("changed_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_work_order_history").on(table.workOrderId, table.createdAt)]);

export const attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workOrderId: integer("work_order_id").notNull(),
  attachmentType: text("attachment_type").notNull(),
  fileName: text("file_name").notNull(),
  fileKey: text("file_key").notNull(),
  fileType: text("file_type").notNull().default(""),
  caption: text("caption").notNull().default(""),
  createdBy: integer("created_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_attachments_work_order_type").on(table.workOrderId, table.attachmentType, table.createdAt)]);

export const broadcastMessages = sqliteTable("broadcast_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  priority: text("priority").notNull().default("normal"),
  senderId: integer("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  displayMode: text("display_mode").notNull().default("top_banner"),
  targetScope: text("target_scope").notNull().default("all"),
  targetDepartment: text("target_department").notNull().default(""),
  targetScreen: text("target_screen").notNull().default(""),
  durationMinutes: integer("duration_minutes").notNull().default(5),
  expireAt: text("expire_at").notNull().default(""),
  dismissible: integer("dismissible").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  closedAt: text("closed_at").notNull().default(""),
  closedBy: integer("closed_by"),
}, (table) => [
  index("idx_broadcast_active_expire").on(table.status, table.expireAt, table.createdAt),
  index("idx_broadcast_target").on(table.targetScope, table.targetDepartment, table.targetScreen),
]);

export const broadcastAcknowledgements = sqliteTable("broadcast_acknowledgements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: integer("message_id").notNull(),
  userId: integer("user_id").notNull(),
  displayName: text("display_name").notNull(),
  screenId: text("screen_id").notNull().default(""),
  acknowledgedAt: text("acknowledged_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_broadcast_ack_unique").on(table.messageId, table.userId, table.screenId)]);

export const orderShipments = sqliteTable("order_shipments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id),
  carrier: text("carrier").notNull(),
  trackingNumber: text("tracking_number").notNull(),
  externalReference: text("external_reference").notNull().default(""),
  source: text("source").notNull(),
  createdBy: integer("created_by").notNull(),
  createdByName: text("created_by_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  operationKey: text("operation_key").notNull().unique(),
  voidedAt: text("voided_at"),
  voidedBy: text("voided_by"),
  voidReason: text("void_reason"),
}, table => [index("order_shipments_order").on(table.orderId, table.id), uniqueIndex("order_shipments_active_tracking").on(table.trackingNumber).where(sql`${table.voidedAt} IS NULL`)]);

export const broadcastScreens = sqliteTable("broadcast_screens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  screenKey: text("screen_key").notNull().unique(),
  name: text("name").notNull(),
  department: text("department").notNull(),
  active: integer("active").notNull().default(1),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_broadcast_screens_department").on(table.department, table.active)]);

// Additive member checkout tables (0040). Email is normalized before writes;
// the migration additionally uses COLLATE NOCASE for uniqueness in raw SQL.
export const customerMembers = sqliteTable("customer_members", {
  id: integer("id").primaryKey({autoIncrement:true}), email:text("email").notNull().unique(),
  displayName:text("display_name").notNull().default(""), active:integer("active").notNull().default(1),
  verifiedAt:integer("verified_at").notNull(), createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const customerSessions = sqliteTable("customer_sessions", {
  tokenHash:text("token_hash").primaryKey(),memberId:integer("member_id").notNull().references(()=>customerMembers.id),expiresAt:integer("expires_at").notNull(),
},t=>[index("idx_customer_sessions_member").on(t.memberId)]);
export const customerEmailChallenges = sqliteTable("customer_email_challenges", {
  id:text("id").primaryKey(),email:text("email").notNull(),browserHash:text("browser_hash").notNull(),codeHash:text("code_hash").notNull(),attempts:integer("attempts").notNull().default(0),expiresAt:integer("expires_at").notNull(),consumedAt:integer("consumed_at"),createdAt:integer("created_at").notNull(),
});
export const customerRateLimits = sqliteTable("customer_rate_limits", {
  bucket:text("bucket").primaryKey(),count:integer("count").notNull(),expiresAt:integer("expires_at").notNull(),
});
export const customerQuotes = sqliteTable("customer_quotes", {
  id:text("id").primaryKey(),memberId:integer("member_id").notNull().references(()=>customerMembers.id),snapshot:text("snapshot").notNull(),orderToken:text("order_token").notNull().unique(),expiresAt:integer("expires_at").notNull(),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const customerOrderLinks = sqliteTable("customer_order_links", {
  orderId:integer("order_id").primaryKey().references(()=>orders.id),memberId:integer("member_id").notNull().references(()=>customerMembers.id),quoteId:text("quote_id").notNull().unique().references(()=>customerQuotes.id),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[index("idx_customer_order_links_member").on(t.memberId,t.orderId)]);
export const customerOrderUploads = sqliteTable("customer_order_uploads", {
  id:text("id").primaryKey(),orderId:integer("order_id").notNull().references(()=>orders.id),lineNo:integer("line_no").notNull(),kind:text("kind",{enum:["artwork","payment_slip"]}).notNull(),fileName:text("file_name").notNull(),fileKey:text("file_key").notNull().unique(),fileType:text("file_type").notNull(),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[index("idx_customer_uploads_order").on(t.orderId,t.lineNo)]);
export const customerEmailJobs = sqliteTable("customer_email_jobs", {
  id:text("id").primaryKey(),recipient:text("recipient").notNull(),subject:text("subject").notNull(),body:text("body").notNull(),state:text("state").notNull().default("pending"),attempts:integer("attempts").notNull().default(0),availableAt:integer("available_at").notNull().default(0),lockToken:text("lock_token").notNull().default(""),sentAt:integer("sent_at"),
});
