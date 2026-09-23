CREATE TABLE IF NOT EXISTS system_update_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  release_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  sent_by INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The graphic-claim announcement was verified in Telegram before this ledger
-- was introduced. Seeding it prevents any retry from posting a duplicate.
INSERT OR IGNORE INTO system_update_notifications (release_key, title, sent_by)
VALUES ('2026-09-14-graphic-claim-v1', 'อัปเดตปุ่มรับงานกราฟิก', 0);
