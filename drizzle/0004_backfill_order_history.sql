INSERT INTO order_status_history (order_id, status, note, created_at)
SELECT id, order_status, 'นำใบสั่งงานเดิมเข้าสู่ระบบติดตามสถานะ', created_at
FROM orders
WHERE NOT EXISTS (
  SELECT 1 FROM order_status_history history WHERE history.order_id = orders.id
);
