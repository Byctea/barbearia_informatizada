ALTER TABLE store_orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'PENDING'
  CHECK (payment_status IN ('PENDING','PAID'));
ALTER TABLE store_orders ADD COLUMN payment_received_at TEXT;

-- Pedidos já concluídos eram registrados como receita; preserva essa baixa histórica.
UPDATE store_orders
SET payment_status='PAID', payment_received_at=updated_at
WHERE status='COMPLETED';
