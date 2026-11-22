-- Integridade de estoque para vendas concorrentes.
-- O trigger roda na mesma transacao que a venda e aborta a operacao inteira
-- quando o produto nao pertence a unidade ou nao tem quantidade suficiente.
CREATE TRIGGER IF NOT EXISTS sale_items_validate_stock
BEFORE INSERT ON sale_items
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = NEW.product_id
        AND p.unit_id = NEW.unit_id
        AND p.is_active = 1
        AND p.stock_quantity >= NEW.quantity
    ) THEN RAISE(ABORT, 'insufficient_stock_or_inactive_product')
  END;
END;

CREATE TRIGGER IF NOT EXISTS sale_items_decrease_stock
AFTER INSERT ON sale_items
BEGIN
  UPDATE products
     SET stock_quantity = stock_quantity - NEW.quantity,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
   WHERE id = NEW.product_id AND unit_id = NEW.unit_id;
END;

CREATE INDEX IF NOT EXISTS idx_sales_unit_sold_at ON sales(unit_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_unit_product_date ON stock_movements(unit_id, product_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_entries_unit_date ON finance_entries(unit_id, occurred_on DESC, status);
