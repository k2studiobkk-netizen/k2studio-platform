-- Additive only. No edits to orders, customers, financial receipts or staff permissions.
CREATE TABLE IF NOT EXISTS sales_share_links (
  token TEXT PRIMARY KEY NOT NULL,
  staff_user_id INTEGER NOT NULL REFERENCES staff_users(id),
  product_id TEXT NOT NULL,
  campaign TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(staff_user_id,product_id,campaign)
);
CREATE INDEX IF NOT EXISTS idx_sales_share_owner ON sales_share_links(staff_user_id,created_at);
