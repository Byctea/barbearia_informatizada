-- Os produtos que já têm estoque ficam disponíveis na loja por padrão.
UPDATE products SET is_for_sale=1
WHERE is_active=1 AND stock_quantity>0 AND is_for_sale=0;
