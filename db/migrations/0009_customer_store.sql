-- Public product catalog and customer orders, scoped to each unit.
ALTER TABLE products ADD COLUMN image_url TEXT;

CREATE TABLE IF NOT EXISTS store_orders (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name_snapshot TEXT NOT NULL,
  customer_phone_snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','READY','COMPLETED','CANCELLED')),
  fulfillment_type TEXT NOT NULL DEFAULT 'PICKUP' CHECK (fulfillment_type IN ('PICKUP','DELIVERY')),
  delivery_address TEXT,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(unit_id, barbershop_id) REFERENCES units(id, barbershop_id) ON DELETE CASCADE,
  FOREIGN KEY(customer_id, unit_id) REFERENCES customers(id, unit_id) ON DELETE RESTRICT,
  UNIQUE(id, unit_id)
);

CREATE TABLE IF NOT EXISTS store_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  FOREIGN KEY(order_id, unit_id) REFERENCES store_orders(id, unit_id) ON DELETE CASCADE,
  FOREIGN KEY(product_id, unit_id) REFERENCES products(id, unit_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_store_orders_unit_created ON store_orders(unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_orders_customer ON store_orders(customer_id, created_at DESC);
CREATE TRIGGER IF NOT EXISTS store_order_items_validate_stock
BEFORE INSERT ON store_order_items
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM products p WHERE p.id=NEW.product_id AND p.unit_id=NEW.unit_id
      AND p.is_active=1 AND p.stock_quantity>=NEW.quantity
  ) THEN RAISE(ABORT, 'insufficient_store_stock') END;
END;

CREATE TRIGGER IF NOT EXISTS store_order_cancel_restore_stock
AFTER UPDATE OF status ON store_orders
WHEN NEW.status='CANCELLED' AND OLD.status<>'CANCELLED'
BEGIN
  UPDATE products SET stock_quantity=stock_quantity+(
    SELECT SUM(i.quantity) FROM store_order_items i WHERE i.order_id=NEW.id AND i.unit_id=NEW.unit_id AND i.product_id=products.id
  ), updated_at=NEW.updated_at
  WHERE unit_id=NEW.unit_id AND id IN (SELECT product_id FROM store_order_items WHERE order_id=NEW.id AND unit_id=NEW.unit_id);
  INSERT INTO stock_movements (id,barbershop_id,unit_id,product_id,movement_type,quantity_delta,unit_cost_cents,source_sale_id,notes,occurred_at)
  SELECT lower(hex(randomblob(16))), NEW.barbershop_id,NEW.unit_id,i.product_id,'RETURN',i.quantity,0,NULL,'Cancelamento pedido loja ' || NEW.id,NEW.updated_at
  FROM store_order_items i WHERE i.order_id=NEW.id AND i.unit_id=NEW.unit_id;
END;
CREATE TRIGGER IF NOT EXISTS store_order_items_decrease_stock
AFTER INSERT ON store_order_items
BEGIN
  UPDATE products SET stock_quantity=stock_quantity-NEW.quantity,
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id=NEW.product_id AND unit_id=NEW.unit_id;
  INSERT INTO stock_movements (id,barbershop_id,unit_id,product_id,movement_type,quantity_delta,unit_cost_cents,source_sale_id,notes,occurred_at)
    SELECT lower(hex(randomblob(16))), o.barbershop_id,o.unit_id,NEW.product_id,'SALE',-NEW.quantity,0,NULL,'Pedido loja ' || o.id,o.created_at
    FROM store_orders o WHERE o.id=NEW.order_id AND o.unit_id=NEW.unit_id;
END;
ALTER TABLE finance_entries ADD COLUMN store_order_id TEXT REFERENCES store_orders(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_store_order ON finance_entries(store_order_id) WHERE store_order_id IS NOT NULL;
