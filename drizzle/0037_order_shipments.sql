CREATE TABLE IF NOT EXISTS order_shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  carrier TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  external_reference TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  operation_key TEXT NOT NULL UNIQUE,
  voided_at TEXT,
  voided_by TEXT,
  void_reason TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS order_shipments_active_tracking ON order_shipments(tracking_number) WHERE voided_at IS NULL;
CREATE INDEX IF NOT EXISTS order_shipments_order ON order_shipments(order_id,id);
CREATE INDEX IF NOT EXISTS orders_shipping_code ON orders(UPPER(order_number));
