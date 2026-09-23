-- Additive customer checkout. Existing staff sessions and orders are untouched.
INSERT INTO sales_channels(code,name,prefix,platform,sort_order,created_by)
VALUES ('customer_web','สมาชิกสั่งผ่านเว็บไซต์','WEB','Website',50,'system')
ON CONFLICT(code) DO NOTHING;
CREATE TABLE customer_members (
  id integer PRIMARY KEY AUTOINCREMENT,
  email text NOT NULL COLLATE NOCASE UNIQUE,
  display_name text NOT NULL DEFAULT '',
  active integer NOT NULL DEFAULT 1,
  verified_at integer NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE customer_sessions (
  token_hash text PRIMARY KEY,
  member_id integer NOT NULL REFERENCES customer_members(id),
  expires_at integer NOT NULL
);
CREATE INDEX idx_customer_sessions_member ON customer_sessions(member_id);
CREATE TABLE customer_email_challenges (
  id text PRIMARY KEY,
  email text NOT NULL,
  browser_hash text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at integer NOT NULL,
  consumed_at integer,
  created_at integer NOT NULL
);
CREATE TABLE customer_rate_limits (
  bucket text PRIMARY KEY,
  count integer NOT NULL,
  expires_at integer NOT NULL
);
CREATE TABLE customer_quotes (
  id text PRIMARY KEY,
  member_id integer NOT NULL REFERENCES customer_members(id),
  snapshot text NOT NULL,
  order_token text NOT NULL UNIQUE,
  expires_at integer NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE customer_order_links (
  order_id integer PRIMARY KEY REFERENCES orders(id),
  member_id integer NOT NULL REFERENCES customer_members(id),
  quote_id text NOT NULL UNIQUE REFERENCES customer_quotes(id),
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_customer_order_links_member ON customer_order_links(member_id,order_id);
CREATE TABLE customer_order_uploads (
  id text PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id),
  line_no integer NOT NULL,
  kind text NOT NULL CHECK(kind IN ('artwork','payment_slip')),
  file_name text NOT NULL,
  file_key text NOT NULL UNIQUE,
  file_type text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_customer_uploads_order ON customer_order_uploads(order_id,line_no);
CREATE TABLE customer_email_jobs (
  id text PRIMARY KEY,
  recipient text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  available_at integer NOT NULL DEFAULT 0,
  lock_token text NOT NULL DEFAULT '',
  sent_at integer
);
