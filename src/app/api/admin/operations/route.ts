import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminScope, type AdminScope } from "@/lib/admin-scope";

const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });
const methodSchema = z.enum(["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD"]);
const idSchema = z.string().trim().min(1).max(100);
const moneySchema = z.number().int().min(0).max(100_000_000);
const businessDate = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
function loyaltyEarn(scope: AdminScope, customerId: string | null | undefined, visitId: string | null, saleId: string | null, amountCents: number, isVisit: boolean, now: string) {
  if (!customerId) return null;
  return scope.db.prepare(`INSERT INTO loyalty_ledger (id,barbershop_id,unit_id,customer_id,program_id,visit_id,source_sale_id,points_delta,visits_delta,entry_type,description,occurred_at) SELECT ?,p.barbershop_id,p.unit_id,c.id,p.id,?,?,CASE WHEN p.program_type='POINTS' THEN CAST((? * p.points_per_currency_unit)/100 AS INTEGER) ELSE 0 END,CASE WHEN p.program_type='VISITS' THEN ? ELSE 0 END,'EARNED',?,? FROM loyalty_programs p JOIN customers c ON c.id=? AND c.unit_id=p.unit_id WHERE p.barbershop_id=? AND p.unit_id=? AND p.is_active=1 AND c.is_loyalty_member=1 AND c.deleted_at IS NULL`)
    .bind(crypto.randomUUID(), visitId, saleId, amountCents, isVisit ? 1 : 0, isVisit ? "Atendimento concluído" : "Compra de produtos", now, customerId, scope.barbershopId, scope.unitId);
}
const visitSchema = z.object({
  action: z.literal("complete-appointment"), appointmentId: idSchema,
  method: methodSchema, notes: z.string().trim().max(1000).optional().default(""),
});
const walkInSchema = z.object({
  action: z.literal("walk-in"), customerId: idSchema.nullable().optional(), barberId: idSchema,
  serviceIds: z.array(idSchema).min(1).max(8), method: methodSchema,
  notes: z.string().trim().max(1000).optional().default(""),
});
const saleSchema = z.object({
  action: z.literal("sale"), customerId: idSchema.nullable().optional(), method: methodSchema,
  items: z.array(z.object({ productId: idSchema, quantity: z.number().int().min(1).max(1000) })).min(1).max(30),
  notes: z.string().trim().max(1000).optional().default(""),
});
const purchaseSchema = z.object({
  action: z.literal("purchase"), productId: idSchema, quantity: z.number().int().min(1).max(100000),
  unitCostCents: moneySchema, supplier: z.string().trim().max(120).optional().default(""),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), method: methodSchema,
  notes: z.string().trim().max(1000).optional().default(""),
});
const bodySchema = z.discriminatedUnion("action", [visitSchema, walkInSchema, saleSchema, purchaseSchema]);

type ItemRow = { id: string; name: string; sale_price_cents: number; cost_cents: number; stock_quantity: number };
type ServiceRow = { id: string; name: string; price_cents: number; estimated_cost_cents: number };

export async function GET() {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  try {
    const [products, customers, services, barbers, appointments, visits, sales, movements] = await Promise.all([
      scope.db.prepare(`SELECT id, name, category, sale_price_cents, cost_cents, stock_quantity, minimum_stock FROM products WHERE unit_id=? AND is_active=1 ORDER BY name COLLATE NOCASE`).bind(scope.unitId).all(),
      scope.db.prepare(`SELECT id, full_name FROM customers WHERE unit_id=? AND deleted_at IS NULL ORDER BY full_name COLLATE NOCASE`).bind(scope.unitId).all(),
      scope.db.prepare(`SELECT id, name, price_cents, duration_minutes FROM services WHERE unit_id=? AND is_active=1 ORDER BY name COLLATE NOCASE`).bind(scope.unitId).all(),
      scope.db.prepare(`SELECT id, display_name FROM barbers WHERE unit_id=? AND is_active=1 ORDER BY display_name COLLATE NOCASE`).bind(scope.unitId).all(),
      scope.db.prepare(`SELECT a.id, a.starts_at, a.customer_name_snapshot, a.service_id, a.price_cents, s.name AS service_name, b.display_name AS barber_name FROM appointments a JOIN services s ON s.id=a.service_id AND s.unit_id=a.unit_id JOIN barbers b ON b.id=a.barber_id AND b.unit_id=a.unit_id WHERE a.unit_id=? AND a.barbershop_id=? AND a.status='CONFIRMED' ORDER BY a.starts_at LIMIT 100`).bind(scope.unitId, scope.barbershopId).all(),
      scope.db.prepare(`SELECT v.id, v.occurred_at, COALESCE(c.full_name, 'Cliente avulso') AS customer_name, GROUP_CONCAT(vs.service_name_snapshot, ', ') AS services, SUM(vs.price_cents) AS total_cents FROM visits v LEFT JOIN customers c ON c.id=v.customer_id AND c.unit_id=v.unit_id JOIN visit_services vs ON vs.visit_id=v.id AND vs.unit_id=v.unit_id WHERE v.unit_id=? AND v.occurred_at>=date('now','-30 day') GROUP BY v.id ORDER BY v.occurred_at DESC LIMIT 30`).bind(scope.unitId).all(),
      scope.db.prepare(`SELECT s.id, s.sold_at, s.total_cents, COALESCE(c.full_name, 'Cliente avulso') AS customer_name, GROUP_CONCAT(si.product_name_snapshot || ' × ' || si.quantity, ', ') AS items FROM sales s LEFT JOIN customers c ON c.id=s.customer_id AND c.unit_id=s.unit_id JOIN sale_items si ON si.sale_id=s.id AND si.unit_id=s.unit_id WHERE s.unit_id=? AND s.status='COMPLETED' AND s.sold_at>=datetime('now','-30 day') GROUP BY s.id ORDER BY s.sold_at DESC LIMIT 30`).bind(scope.unitId).all(),
      scope.db.prepare(`SELECT sm.id, sm.occurred_at, sm.movement_type, sm.quantity_delta, sm.unit_cost_cents, sm.supplier_name, p.name AS product_name FROM stock_movements sm JOIN products p ON p.id=sm.product_id AND p.unit_id=sm.unit_id WHERE sm.unit_id=? AND sm.movement_type='PURCHASE' ORDER BY sm.occurred_at DESC LIMIT 30`).bind(scope.unitId).all(),
    ]);
    return NextResponse.json({ products: products.results, customers: customers.results, services: services.results, barbers: barbers.results, appointments: appointments.results, visits: visits.results, sales: sales.results, purchases: movements.results });
  } catch (error) {
    console.error("admin operations list error", error);
    return fail("Não foi possível carregar atendimentos, vendas e estoque.", 500);
  }
}

export async function POST(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  let json: unknown;
  try { json = await request.json(); } catch { return fail("Envie os dados em formato JSON.", 400); }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Revise os campos enviados.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  const input = parsed.data;
  const now = new Date().toISOString();
  try {
    if (input.action === "complete-appointment") {
      const appt = await scope.db.prepare(`SELECT a.id,a.customer_id,a.barber_id,a.service_id,a.price_cents,a.starts_at,a.status,s.name,s.estimated_cost_cents,(SELECT method FROM appointment_payments WHERE appointment_id=a.id AND unit_id=a.unit_id AND status='PAID' ORDER BY paid_at DESC LIMIT 1) AS paid_method FROM appointments a JOIN services s ON s.id=a.service_id AND s.unit_id=a.unit_id WHERE a.id=? AND a.unit_id=? AND a.barbershop_id=?`)
        .bind(input.appointmentId, scope.unitId, scope.barbershopId).first<{ id: string; customer_id: string | null; barber_id: string; service_id: string; price_cents: number; starts_at: string; status: string; name: string; estimated_cost_cents: number; paid_method: string | null }>();
      if (!appt) return fail("Agendamento não encontrado.", 404);
      if (appt.status !== "CONFIRMED") return fail("Somente agendamentos confirmados podem ser concluídos.", 409);
      const existing = await scope.db.prepare(`SELECT id FROM visits WHERE appointment_id=? AND unit_id=?`).bind(appt.id, scope.unitId).first();
      if (existing) return fail("Este agendamento já possui atendimento registrado.", 409);
      const visitId = crypto.randomUUID();
      const entryId = crypto.randomUUID();
      const loyaltyEntry = loyaltyEarn(scope, appt.customer_id, visitId, null, appt.price_cents, true, now);
      const results = await scope.db.batch([
        scope.db.prepare(`UPDATE appointments SET status='COMPLETED' WHERE id=? AND unit_id=? AND status='CONFIRMED'`).bind(appt.id, scope.unitId),
        scope.db.prepare(`INSERT INTO visits (id,barbershop_id,unit_id,appointment_id,customer_id,barber_id,occurred_at,notes) SELECT ?,?,?,a.id,a.customer_id,a.barber_id,?,? FROM appointments a WHERE a.id=? AND a.unit_id=? AND a.status='COMPLETED' AND NOT EXISTS (SELECT 1 FROM visits WHERE appointment_id=a.id AND unit_id=a.unit_id)`).bind(visitId, scope.barbershopId, scope.unitId, now, input.notes || null, appt.id, scope.unitId),
        scope.db.prepare(`INSERT INTO visit_services (id,visit_id,unit_id,service_id,service_name_snapshot,price_cents,cost_cents) SELECT ?,?,?,s.id,s.name,a.price_cents,s.estimated_cost_cents FROM services s JOIN appointments a ON a.service_id=s.id AND a.unit_id=s.unit_id WHERE a.id=? AND a.unit_id=? AND a.status='COMPLETED' AND a.id IN (SELECT appointment_id FROM visits WHERE id=? AND unit_id=?)`).bind(crypto.randomUUID(), visitId, scope.unitId, appt.id, scope.unitId, visitId, scope.unitId),
        ...(appt.price_cents > 0 ? [scope.db.prepare(`INSERT INTO finance_entries (id,barbershop_id,unit_id,entry_type,category,description,amount_cents,occurred_on,payment_method,visit_id,status) SELECT ?,?,?,'INCOME','SERVICE',?,?,?,?,?,'CONFIRMED' WHERE EXISTS (SELECT 1 FROM visits WHERE id=? AND unit_id=?) AND EXISTS (SELECT 1 FROM visit_services WHERE visit_id=? AND unit_id=?)`).bind(entryId, scope.barbershopId, scope.unitId, `Serviço: ${appt.name}`, appt.price_cents, businessDate(new Date(now)), appt.paid_method ?? input.method, visitId, visitId, scope.unitId, visitId, scope.unitId)] : []),
        ...(loyaltyEntry ? [loyaltyEntry] : []),
      ]);
      if (!results[0]?.meta.changes) return fail("O agendamento foi alterado por outra operação. Atualize a lista.", 409);
      return NextResponse.json({ ok: true, visitId });
    }

    if (input.action === "walk-in") {
      const [barber, customer, services] = await Promise.all([
        scope.db.prepare(`SELECT id FROM barbers WHERE id=? AND unit_id=? AND barbershop_id=? AND is_active=1`).bind(input.barberId, scope.unitId, scope.barbershopId).first<{ id: string }>(),
        input.customerId ? scope.db.prepare(`SELECT id FROM customers WHERE id=? AND unit_id=? AND barbershop_id=? AND deleted_at IS NULL`).bind(input.customerId, scope.unitId, scope.barbershopId).first<{ id: string }>() : Promise.resolve({ id: null }),
        scope.db.prepare(`SELECT id,name,price_cents,estimated_cost_cents FROM services WHERE unit_id=? AND barbershop_id=? AND is_active=1 AND id IN (${input.serviceIds.map(() => "?").join(",")})`).bind(scope.unitId, scope.barbershopId, ...input.serviceIds).all<ServiceRow>(),
      ]);
      if (!barber || !customer) return fail("Barbeiro ou cliente não pertence a esta unidade.", 400);
      if (services.results.length !== input.serviceIds.length || new Set(input.serviceIds).size !== input.serviceIds.length) return fail("Selecione serviços ativos desta unidade, sem repetição.", 400);
      const visitId = crypto.randomUUID();
      const total = services.results.reduce((sum, service) => sum + service.price_cents, 0);
      const statements: D1PreparedStatement[] = [scope.db.prepare(`INSERT INTO visits (id,barbershop_id,unit_id,customer_id,barber_id,occurred_at,notes) VALUES (?,?,?,?,?,?,?)`).bind(visitId, scope.barbershopId, scope.unitId, customer.id, barber.id, now, input.notes || null)];
      for (const service of services.results) statements.push(scope.db.prepare(`INSERT INTO visit_services (id,visit_id,unit_id,service_id,service_name_snapshot,price_cents,cost_cents) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), visitId, scope.unitId, service.id, service.name, service.price_cents, service.estimated_cost_cents));
      const loyaltyEntry = loyaltyEarn(scope, customer.id, visitId, null, total, true, now);
      if (loyaltyEntry) statements.push(loyaltyEntry);
      if (total > 0) statements.push(scope.db.prepare(`INSERT INTO finance_entries (id,barbershop_id,unit_id,entry_type,category,description,amount_cents,occurred_on,payment_method,visit_id,status) VALUES (?,?,?,'INCOME','SERVICE',?,?,?,?,?,'CONFIRMED')`).bind(crypto.randomUUID(), scope.barbershopId, scope.unitId, `Atendimento avulso (${services.results.length} serviço(s))`, total, businessDate(new Date(now)), input.method, visitId));
      await scope.db.batch(statements);
      return NextResponse.json({ ok: true, visitId, totalCents: total }, { status: 201 });
    }

    if (input.action === "sale") {
      if (input.customerId) {
        const customer = await scope.db.prepare(`SELECT id FROM customers WHERE id=? AND unit_id=? AND barbershop_id=? AND deleted_at IS NULL`).bind(input.customerId, scope.unitId, scope.barbershopId).first();
        if (!customer) return fail("Cliente não pertence a esta unidade.", 400);
      }
      const quantities = new Map<string, number>();
      for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
      const ids = [...quantities.keys()];
      const products = await scope.db.prepare(`SELECT id,name,sale_price_cents,cost_cents,stock_quantity FROM products WHERE unit_id=? AND barbershop_id=? AND is_active=1 AND id IN (${ids.map(() => "?").join(",")})`).bind(scope.unitId, scope.barbershopId, ...ids).all<ItemRow>();
      if (products.results.length !== ids.length) return fail("Um produto não está disponível nesta unidade.", 400);
      const byId = new Map(products.results.map((product) => [product.id, product]));
      for (const [id, quantity] of quantities) if ((byId.get(id)?.stock_quantity ?? 0) < quantity) return fail(`Estoque insuficiente: ${byId.get(id)?.name ?? "produto"}.`, 409);
      const saleId = crypto.randomUUID();
      const total = [...quantities].reduce((sum, [id, quantity]) => sum + (byId.get(id)!.sale_price_cents * quantity), 0);
      if (!Number.isSafeInteger(total) || total > 2_000_000_000) return fail("O total da venda excede o limite permitido.", 400);
      const statements: D1PreparedStatement[] = [
        scope.db.prepare(`INSERT INTO sales (id,barbershop_id,unit_id,customer_id,sold_at,total_cents,notes) VALUES (?,?,?,?,?,?,?)`).bind(saleId, scope.barbershopId, scope.unitId, input.customerId ?? null, now, total, input.notes || null),
      ];
      for (const [id, quantity] of quantities) {
        const product = byId.get(id)!;
        const saleItemId = crypto.randomUUID();
        const movementId = crypto.randomUUID();
        statements.push(scope.db.prepare(`INSERT INTO sale_items (id,sale_id,unit_id,product_id,product_name_snapshot,quantity,unit_price_cents,unit_cost_cents) VALUES (?,?,?,?,?,?,?,?)`).bind(saleItemId, saleId, scope.unitId, id, product.name, quantity, product.sale_price_cents, product.cost_cents));
        statements.push(scope.db.prepare(`INSERT INTO stock_movements (id,barbershop_id,unit_id,product_id,movement_type,quantity_delta,unit_cost_cents,source_sale_id,notes,occurred_at) VALUES (?,?,?,?,'SALE',?,?,?, ?,?)`).bind(movementId, scope.barbershopId, scope.unitId, id, -quantity, product.cost_cents, saleId, `Venda ${saleId}`, now));
      }
      if (total > 0) statements.push(scope.db.prepare(`INSERT INTO sale_payments (id,sale_id,unit_id,amount_cents,method,status,paid_at,provider) VALUES (?,?,?, ?,?,'PAID',?,'MANUAL')`).bind(crypto.randomUUID(), saleId, scope.unitId, total, input.method, now));
      if (total > 0) statements.push(scope.db.prepare(`INSERT INTO finance_entries (id,barbershop_id,unit_id,entry_type,category,description,amount_cents,occurred_on,payment_method,sale_id,status) VALUES (?,?,?,'INCOME','PRODUCT',?,?,?,?,?,'CONFIRMED')`).bind(crypto.randomUUID(), scope.barbershopId, scope.unitId, `Venda de produtos (${quantities.size} item(ns))`, total, businessDate(new Date(now)), input.method, saleId));
      const loyaltyEntry = loyaltyEarn(scope, input.customerId, null, saleId, total, false, now);
      if (loyaltyEntry) statements.push(loyaltyEntry);
      await scope.db.batch(statements);
      return NextResponse.json({ ok: true, saleId, totalCents: total }, { status: 201 });
    }

    if (input.action === "purchase") {
      const validDate = new Date(`${input.occurredOn}T00:00:00.000Z`);
      if (!Number.isFinite(validDate.getTime()) || validDate.toISOString().slice(0, 10) !== input.occurredOn) return fail("Informe uma data de compra válida.", 400);
      const product = await scope.db.prepare(`SELECT id,name FROM products WHERE id=? AND unit_id=? AND barbershop_id=? AND is_active=1`).bind(input.productId, scope.unitId, scope.barbershopId).first<{ id: string; name: string }>();
      if (!product) return fail("Produto não pertence a esta unidade ou está inativo.", 404);
      const movementId = crypto.randomUUID();
      const amount = input.quantity * input.unitCostCents;
      if (!Number.isSafeInteger(amount) || amount > 2_000_000_000) return fail("O custo total da compra excede o limite permitido.", 400);
      const statements: D1PreparedStatement[] = [
        scope.db.prepare(`UPDATE products SET stock_quantity=stock_quantity+?,cost_cents=?,updated_at=? WHERE id=? AND unit_id=? AND is_active=1 AND stock_quantity<=1000000-?`).bind(input.quantity, input.unitCostCents, now, product.id, scope.unitId, input.quantity),
        scope.db.prepare(`INSERT INTO stock_movements (id,barbershop_id,unit_id,product_id,movement_type,quantity_delta,unit_cost_cents,supplier_name,notes,occurred_at) SELECT ?,?,?,?,'PURCHASE',?,?,?,?,? WHERE changes()=1`).bind(movementId, scope.barbershopId, scope.unitId, product.id, input.quantity, input.unitCostCents, input.supplier || null, input.notes || null, `${input.occurredOn}T12:00:00.000Z`),
      ];
      if (amount > 0) statements.push(scope.db.prepare(`INSERT INTO finance_entries (id,barbershop_id,unit_id,entry_type,category,description,amount_cents,occurred_on,payment_method,stock_movement_id,status) SELECT ?,?,?,'EXPENSE','SUPPLIES',?,?,?, ?,?,'CONFIRMED' WHERE EXISTS (SELECT 1 FROM stock_movements WHERE id=?)`).bind(crypto.randomUUID(), scope.barbershopId, scope.unitId, `Compra: ${product.name}`, amount, input.occurredOn, input.method, movementId, movementId));
      const results = await scope.db.batch(statements);
      if (!results[0]?.meta.changes) return fail("O estoque atingiria o limite permitido. Reduza a quantidade e tente novamente.", 409);
      if (!results[1]?.meta.changes) return fail("A entrada de estoque não foi registrada. Atualize a tela e tente novamente.", 409);
      return NextResponse.json({ ok: true, movementId, totalCostCents: amount }, { status: 201 });
    }
    return fail("Operação inválida.", 400);
  } catch (error) {
    console.error("admin operation error", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("insufficient_stock_or_inactive_product")) return fail("Estoque insuficiente ou produto inativo. Atualize a tela e tente novamente.", 409);
    return fail("Não foi possível concluir a operação; confira o estoque e os dados da unidade.", 409);
  }
}
