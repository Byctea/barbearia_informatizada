-- Liga cada crédito de fidelidade ao evento que o originou e evita duplicidade.
ALTER TABLE loyalty_ledger ADD COLUMN source_sale_id TEXT REFERENCES sales(id) ON DELETE SET NULL;
ALTER TABLE loyalty_programs ADD COLUMN points_required INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_one_active_program_per_unit
  ON loyalty_programs(unit_id) WHERE is_active = 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_earned_visit_once
  ON loyalty_ledger(program_id, visit_id)
  WHERE entry_type = 'EARNED' AND visit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_earned_sale_once
  ON loyalty_ledger(program_id, source_sale_id)
  WHERE entry_type = 'EARNED' AND source_sale_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loyalty_program_customer_time
  ON loyalty_ledger(program_id, customer_id, occurred_at DESC);
