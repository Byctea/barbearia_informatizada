ALTER TABLE barbershops ADD COLUMN city TEXT;
ALTER TABLE barbershops ADD COLUMN state TEXT;
ALTER TABLE units ADD COLUMN city TEXT;
ALTER TABLE units ADD COLUMN state TEXT;

CREATE TABLE IF NOT EXISTS customer_membership_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES users(id),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  UNIQUE(user_id, barbershop_id)
);
CREATE INDEX IF NOT EXISTS idx_customer_membership_requests_shop_status
  ON customer_membership_requests(barbershop_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_membership_requests_user
  ON customer_membership_requests(user_id, created_at DESC);
