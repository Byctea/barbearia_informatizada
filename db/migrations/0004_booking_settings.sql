-- Regras de agenda por unidade. Integração de pagamento fica sem credenciais
-- nesta fase; o dono registra manualmente o pagamento recebido.
CREATE TABLE IF NOT EXISTS booking_settings (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL UNIQUE REFERENCES units(id) ON DELETE CASCADE,
  slot_interval_minutes INTEGER NOT NULL DEFAULT 15 CHECK (slot_interval_minutes BETWEEN 5 AND 120),
  cancellation_min_hours INTEGER NOT NULL DEFAULT 24 CHECK (cancellation_min_hours BETWEEN 0 AND 720),
  max_days_ahead INTEGER NOT NULL DEFAULT 60 CHECK (max_days_ahead BETWEEN 1 AND 365),
  payment_deadline_hours INTEGER NOT NULL DEFAULT 24 CHECK (payment_deadline_hours BETWEEN 1 AND 168),
  auto_confirm INTEGER NOT NULL DEFAULT 0 CHECK (auto_confirm IN (0,1)),
  payment_provider TEXT,
  payment_integration_enabled INTEGER NOT NULL DEFAULT 0 CHECK (payment_integration_enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO booking_settings (id, barbershop_id, unit_id)
SELECT 'booking_settings_' || u.id, u.barbershop_id, u.id
FROM units u WHERE u.is_active = 1;

CREATE INDEX IF NOT EXISTS idx_working_hours_unit_day ON working_hours(unit_id, weekday, is_open);
CREATE UNIQUE INDEX IF NOT EXISTS idx_working_hours_barber_weekday ON working_hours(barber_id, weekday);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_unit ON customers(user_id, unit_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;
