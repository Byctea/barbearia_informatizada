-- Demonstração local. Execute somente em banco vazio/local.
INSERT INTO barbershops (id, name) VALUES ('shop_demo', 'Barber Bar — Demonstração');
INSERT INTO units (id, barbershop_id, name, phone, address)
VALUES ('unit_demo', 'shop_demo', 'Unidade Principal', '71999990000', 'Salvador - BA');
INSERT INTO users (id, auth_subject, email, display_name)
VALUES ('user_admin_demo', 'demo-auth-admin', 'admin@example.test', 'Administrador Demo');
INSERT INTO memberships (id, barbershop_id, unit_id, user_id, role)
VALUES ('membership_admin_demo', 'shop_demo', 'unit_demo', 'user_admin_demo', 'ADMIN');
INSERT INTO barbers (id, barbershop_id, unit_id, user_id, display_name, phone)
VALUES ('barber_demo', 'shop_demo', 'unit_demo', 'user_admin_demo', 'Barbeiro Demo', '71999990000');
INSERT INTO customers (id, barbershop_id, unit_id, full_name, phone, is_loyalty_member, consent_status)
VALUES ('customer_walkin_demo', 'shop_demo', 'unit_demo', 'Cliente Avulso Demo', '71988880000', 0, 'UNKNOWN');
INSERT INTO customers (id, barbershop_id, unit_id, full_name, phone, email, preferred_return_days, is_loyalty_member, consent_status, consent_at)
VALUES ('customer_loyal_demo', 'shop_demo', 'unit_demo', 'Cliente Fidelizado Demo', '71977770000', 'cliente@example.test', 15, 1, 'GRANTED', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
INSERT INTO services (id, barbershop_id, unit_id, name, description, duration_minutes, price_cents, estimated_cost_cents)
VALUES ('service_fade_demo', 'shop_demo', 'unit_demo', 'Corte degradê', 'Serviço de demonstração', 45, 4500, 500);
INSERT INTO products (id, barbershop_id, unit_id, name, category, cost_cents, sale_price_cents, stock_quantity, minimum_stock)
VALUES ('product_pomade_demo', 'shop_demo', 'unit_demo', 'Pomada modeladora', 'Finalizadores', 1800, 3500, 8, 2);
INSERT INTO loyalty_programs (id, barbershop_id, unit_id, name, program_type, visits_required, reward_description)
VALUES ('loyalty_visits_demo', 'shop_demo', 'unit_demo', '10 cortes', 'VISITS', 10, '1 corte grátis');
INSERT INTO working_hours (id, barbershop_id, unit_id, barber_id, weekday, opens_at, closes_at)
VALUES ('hours_demo_mon', 'shop_demo', 'unit_demo', 'barber_demo', 1, '09:00', '18:00');

