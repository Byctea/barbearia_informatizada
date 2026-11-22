-- Barber Bar: schema inicial para Cloudflare D1 (SQLite)
-- Dinheiro em centavos. Instantes em UTC ISO-8601. Datas de negócio YYYY-MM-DD.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS barbershops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Bahia',
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(id, barbershop_id)
);

-- Identidade do provedor fica aqui apenas como subject; senha não é armazenada no D1.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  auth_subject TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN','CLIENT')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(barbershop_id, user_id, unit_id)
);

CREATE TABLE IF NOT EXISTS barbers (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  UNIQUE(id, unit_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  birth_date TEXT,
  notes TEXT,
  haircut_preference TEXT,
  preferred_return_days INTEGER CHECK (preferred_return_days IS NULL OR preferred_return_days BETWEEN 1 AND 365),
  is_loyalty_member INTEGER NOT NULL DEFAULT 0 CHECK (is_loyalty_member IN (0,1)),
  consent_status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (consent_status IN ('UNKNOWN','GRANTED','REVOKED')),
  consent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT,
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(id, unit_id)
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 5 AND 600),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (estimated_cost_cents >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  UNIQUE(id, unit_id)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  sale_price_cents INTEGER NOT NULL CHECK (sale_price_cents >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  minimum_stock INTEGER NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  UNIQUE(id, unit_id)
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  customer_id TEXT,
  barber_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','AWAITING_PAYMENT','CONFIRMED','COMPLETED','CANCELLED','DECLINED','NO_SHOW')),
  payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID','PENDING','PARTIAL','PAID','REFUNDED','PARTIALLY_REFUNDED','RETAINED')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  customer_name_snapshot TEXT NOT NULL,
  customer_phone_snapshot TEXT NOT NULL,
  cancellation_reason TEXT,
  rescheduled_from_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  FOREIGN KEY(customer_id, unit_id) REFERENCES customers(id, unit_id) ON DELETE RESTRICT,
  FOREIGN KEY(barber_id, unit_id) REFERENCES barbers(id, unit_id) ON DELETE RESTRICT,
  FOREIGN KEY(service_id, unit_id) REFERENCES services(id, unit_id) ON DELETE RESTRICT,
  CHECK (ends_at > starts_at),
  UNIQUE(id, unit_id)
);

CREATE TABLE IF NOT EXISTS appointment_payments (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  method TEXT NOT NULL CHECK (method IN ('CASH','PIX','DEBIT_CARD','CREDIT_CARD','OTHER')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','REFUNDED','RETAINED')),
  paid_at TEXT,
  provider TEXT,
  provider_reference TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(appointment_id, unit_id) REFERENCES appointments(id, unit_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  appointment_id TEXT UNIQUE,
  customer_id TEXT,
  barber_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  FOREIGN KEY(appointment_id, unit_id) REFERENCES appointments(id, unit_id) ON DELETE SET NULL,
  FOREIGN KEY(customer_id, unit_id) REFERENCES customers(id, unit_id) ON DELETE RESTRICT,
  FOREIGN KEY(barber_id, unit_id) REFERENCES barbers(id, unit_id) ON DELETE RESTRICT,
  UNIQUE(id, unit_id)
);

CREATE TABLE IF NOT EXISTS visit_services (
  id TEXT PRIMARY KEY,
  visit_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_name_snapshot TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  FOREIGN KEY(visit_id, unit_id) REFERENCES visits(id, unit_id) ON DELETE CASCADE,
  FOREIGN KEY(service_id, unit_id) REFERENCES services(id, unit_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  customer_id TEXT,
  visit_id TEXT,
  sold_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED','CANCELLED','REFUNDED')),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  FOREIGN KEY(customer_id, unit_id) REFERENCES customers(id, unit_id) ON DELETE RESTRICT,
  FOREIGN KEY(visit_id, unit_id) REFERENCES visits(id, unit_id) ON DELETE SET NULL,
  UNIQUE(id, unit_id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  unit_cost_cents INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
  FOREIGN KEY(sale_id, unit_id) REFERENCES sales(id, unit_id) ON DELETE CASCADE,
  FOREIGN KEY(product_id, unit_id) REFERENCES products(id, unit_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sale_payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  method TEXT NOT NULL CHECK (method IN ('CASH','PIX','DEBIT_CARD','CREDIT_CARD','OTHER')),
  status TEXT NOT NULL DEFAULT 'PAID' CHECK (status IN ('PENDING','PAID','REFUNDED')),
  paid_at TEXT,
  provider TEXT,
  provider_reference TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(sale_id, unit_id) REFERENCES sales(id, unit_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('PURCHASE','SALE','ADJUSTMENT_IN','ADJUSTMENT_OUT','RETURN')),
  quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
  unit_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_cents >= 0),
  source_sale_id TEXT,
  supplier_name TEXT,
  notes TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  FOREIGN KEY(product_id, unit_id) REFERENCES products(id, unit_id) ON DELETE RESTRICT,
  FOREIGN KEY(source_sale_id, unit_id) REFERENCES sales(id, unit_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS finance_entries (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('INCOME','EXPENSE')),
  category TEXT NOT NULL CHECK (category IN ('SERVICE','PRODUCT','SUPPLIES','RENT','ENERGY','WATER','INTERNET','EQUIPMENT','OTHER')),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  occurred_on TEXT NOT NULL,
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('CASH','PIX','DEBIT_CARD','CREDIT_CARD','OTHER')),
  recurrence_group_id TEXT,
  sale_id TEXT,
  visit_id TEXT,
  stock_movement_id TEXT,
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('PENDING','CONFIRMED','CANCELLED')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  FOREIGN KEY(sale_id, unit_id) REFERENCES sales(id, unit_id) ON DELETE SET NULL,
  FOREIGN KEY(visit_id, unit_id) REFERENCES visits(id, unit_id) ON DELETE SET NULL,
  FOREIGN KEY(stock_movement_id) REFERENCES stock_movements(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS loyalty_programs (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  name TEXT NOT NULL,
  program_type TEXT NOT NULL CHECK (program_type IN ('VISITS','POINTS')),
  visits_required INTEGER CHECK (visits_required IS NULL OR visits_required > 0),
  points_per_currency_unit INTEGER CHECK (points_per_currency_unit IS NULL OR points_per_currency_unit > 0),
  reward_description TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  CHECK ((program_type = 'VISITS' AND visits_required IS NOT NULL) OR (program_type = 'POINTS' AND points_per_currency_unit IS NOT NULL)),
  UNIQUE(id, unit_id)
);

CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  visit_id TEXT,
  points_delta INTEGER NOT NULL DEFAULT 0,
  visits_delta INTEGER NOT NULL DEFAULT 0,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('EARNED','REDEEMED','ADJUSTMENT','EXPIRED')),
  description TEXT,
  occurred_at TEXT NOT NULL,
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  FOREIGN KEY(customer_id, unit_id) REFERENCES customers(id, unit_id) ON DELETE CASCADE,
  FOREIGN KEY(program_id, unit_id) REFERENCES loyalty_programs(id, unit_id) ON DELETE RESTRICT,
  FOREIGN KEY(visit_id, unit_id) REFERENCES visits(id, unit_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS working_hours (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  barber_id TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at TEXT NOT NULL,
  closes_at TEXT NOT NULL,
  is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0,1)),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  FOREIGN KEY(barber_id, unit_id) REFERENCES barbers(id, unit_id) ON DELETE CASCADE,
  CHECK (closes_at > opens_at)
);

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  barber_id TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  FOREIGN KEY(barber_id, unit_id) REFERENCES barbers(id, unit_id) ON DELETE CASCADE,
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customers_unit_phone ON customers(unit_id, phone) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_unit_active ON services(unit_id, is_active, name);
CREATE INDEX IF NOT EXISTS idx_products_unit_active ON products(unit_id, is_active, name);
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(unit_id, stock_quantity, minimum_stock) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_appointments_barber_time ON appointments(barber_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_time ON appointments(customer_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_unit_status_time ON appointments(unit_id, status, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointment_payments_appointment ON appointment_payments(appointment_id, status);
CREATE INDEX IF NOT EXISTS idx_visits_customer_time ON visits(customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_unit_time ON visits(unit_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_sales_unit_time ON sales(unit_id, sold_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_product_time ON stock_movements(product_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_unit_date ON finance_entries(unit_id, occurred_on, entry_type, status);
CREATE INDEX IF NOT EXISTS idx_loyalty_customer_time ON loyalty_ledger(customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_working_hours_barber_day ON working_hours(barber_id, weekday);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_barber_time ON schedule_blocks(barber_id, starts_at, ends_at);

-- Impede sobreposição entre horários ativos do mesmo barbeiro.
CREATE TRIGGER IF NOT EXISTS trg_appointment_no_overlap_insert
BEFORE INSERT ON appointments
WHEN NEW.status IN ('REQUESTED','AWAITING_PAYMENT','CONFIRMED')
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.barber_id = NEW.barber_id
      AND a.status IN ('REQUESTED','AWAITING_PAYMENT','CONFIRMED')
      AND NEW.starts_at < a.ends_at AND NEW.ends_at > a.starts_at
  ) THEN RAISE(ABORT, 'appointment_time_conflict') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_appointment_no_overlap_update
BEFORE UPDATE OF barber_id, starts_at, ends_at, status ON appointments
WHEN NEW.status IN ('REQUESTED','AWAITING_PAYMENT','CONFIRMED')
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.id <> NEW.id AND a.barber_id = NEW.barber_id
      AND a.status IN ('REQUESTED','AWAITING_PAYMENT','CONFIRMED')
      AND NEW.starts_at < a.ends_at AND NEW.ends_at > a.starts_at
  ) THEN RAISE(ABORT, 'appointment_time_conflict') END;
END;
