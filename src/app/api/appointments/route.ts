import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { dateTimeBahia, dateTimePattern, expireStaleRequests, findAvailableSlots, getBookingDb, getBookingSettings, getPublicUnit } from "@/lib/booking";

const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });
const paymentMethods = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD"] as const;
const orderIdSchema = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 100;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

async function customerIdentity(db: D1Database, subject: string) {
  return db.prepare(`SELECT id, display_name, email FROM users WHERE auth_subject = ? AND deleted_at IS NULL`).bind(subject)
    .first<{ id: string; display_name: string; email: string | null }>();
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const view = params.get("view");
  if (view === "store") return getStoreProducts(request);
  const db = getBookingDb();
  const unit = await getPublicUnit(db, params.get("shop"));
  if (!unit) return fail("Nenhuma unidade está disponível para agendamento.", 404);

  try {
    if (view === "services") {
      const [services, barbers] = await Promise.all([
        db.prepare(`SELECT id, name, description, duration_minutes, price_cents FROM services WHERE unit_id = ? AND is_active = 1 ORDER BY name COLLATE NOCASE`).bind(unit.unit_id).all(),
        db.prepare(`SELECT id, display_name AS name FROM barbers WHERE unit_id = ? AND is_active = 1 ORDER BY display_name COLLATE NOCASE`).bind(unit.unit_id).all(),
      ]);
      return NextResponse.json({ data: services.results, barbers: barbers.results, unit: { name: unit.unit_name, phone: unit.unit_phone } });
    }
    if (view === "availability") {
      const date = params.get("date") ?? "";
      const serviceId = params.get("serviceId") ?? "";
      if (!dateTimePattern(date) || !serviceId) return fail("Informe serviço e data válidos.", 400);
      return NextResponse.json({ data: await findAvailableSlots(db, unit.unit_id, date, serviceId) });
    }
    if (view === "mine") {
      const auth = await getAuth();
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return fail("Entre na sua conta para consultar agendamentos.", 401);
      const settings = await db.prepare(`SELECT payment_deadline_hours FROM booking_settings WHERE unit_id=?`).bind(unit.unit_id).first<{ payment_deadline_hours: number }>();
      const now = Date.now();
      const requestCutoff = new Date(now - 2 * 60 * 60_000).toISOString();
      const paymentCutoff = new Date(now - (settings?.payment_deadline_hours ?? 24) * 60 * 60_000).toISOString();
      const { results } = await db.prepare(
        `SELECT a.id, a.starts_at, a.ends_at,
                CASE WHEN a.status='REQUESTED' AND a.payment_status<>'PAID' AND a.requested_at<=? THEN 'EXPIRED'
                     WHEN a.status='AWAITING_PAYMENT' AND a.payment_status='PENDING' AND a.reviewed_at<=? THEN 'EXPIRED'
                     ELSE a.status END AS status,
                a.payment_status, a.price_cents, a.service_id, a.barber_id,
                a.customer_name_snapshot, a.customer_phone_snapshot, s.name AS service_name, b.display_name AS barber_name
         FROM appointments a JOIN customers c ON c.id = a.customer_id AND c.unit_id = a.unit_id
         JOIN services s ON s.id = a.service_id AND s.unit_id = a.unit_id
         JOIN barbers b ON b.id = a.barber_id AND b.unit_id = a.unit_id
         WHERE c.user_id = (SELECT id FROM users WHERE auth_subject = ? AND deleted_at IS NULL) AND a.unit_id = ?
         ORDER BY a.starts_at DESC LIMIT 100`,
      ).bind(requestCutoff, paymentCutoff, session.user.id, unit.unit_id).all();
      return NextResponse.json({ data: results });
    }
    return fail("Consulta não encontrada.", 404);
  } catch (error) {
    console.error("appointment query error", error);
    return fail("Não foi possível consultar os agendamentos.", 500);
  }
}

export async function POST(request: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return fail("Entre na sua conta para solicitar um horário.", 401);
  if (session.user.role !== "CLIENT") return fail("Esta operação está disponível para contas de cliente.", 403);

  let body: Record<string, unknown>;
  try { const parsed: unknown = await request.json(); if (!isRecord(parsed)) return fail("Envie um objeto JSON válido.", 400); body = parsed; } catch { return fail("Envie os dados em formato JSON.", 400); }
  const action = body.action;
  if (action === "store-order") return createStoreOrder(request, session.user.id, body);
  const db = getBookingDb();
  const shopSlug = typeof body.barbershopSlug === "string" ? body.barbershopSlug : null;
  const unit = await getPublicUnit(db, shopSlug);
  if (!unit) return fail("Nenhuma unidade está disponível para agendamento.", 404);
  const settings = await getBookingSettings(db, unit.unit_id);
  if (!settings) return fail("As regras da agenda ainda não estão configuradas.", 500);

  try {
    await expireStaleRequests(db, unit.unit_id);
    if (action === "request") {
      const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
      const barberId = typeof body.barberId === "string" ? body.barberId : "";
      const startsAt = typeof body.startsAt === "string" ? body.startsAt : "";
      const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 120) : session.user.name.trim().slice(0, 120);
      const phone = typeof body.phone === "string" ? body.phone.trim() : "";
      if (!serviceId || !barberId || !startsAt || fullName.length < 2 || phone.length > 24 || phone.replace(/\D/g, "").length < 8 || body.consent !== true) return fail("Preencha nome, telefone válido (até 24 caracteres), horário e aceite o uso dos dados para agendar.", 400);
      const start = new Date(startsAt);
      if (Number.isNaN(start.getTime())) return fail("Horário inválido.", 400);
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit" }).format(start);
      const slot = (await findAvailableSlots(db, unit.unit_id, date, serviceId)).find((item) => item.barberId === barberId && item.startsAt === start.toISOString());
      if (!slot) return fail("Esse horário acabou de ficar indisponível. Escolha outro horário.", 409);
      const service = await db.prepare(`SELECT id, name, duration_minutes, price_cents, estimated_cost_cents FROM services WHERE id = ? AND unit_id = ? AND is_active = 1`).bind(serviceId, unit.unit_id).first<{ id: string; name: string; duration_minutes: number; price_cents: number; estimated_cost_cents: number }>();
      const identity = await customerIdentity(db, session.user.id);
      if (!service || !identity) return fail("Não foi possível localizar o cadastro da conta.", 400);
      let customer = await db.prepare(`SELECT id FROM customers WHERE user_id = ? AND unit_id = ? AND deleted_at IS NULL ORDER BY created_at LIMIT 1`).bind(identity.id, unit.unit_id).first<{ id: string }>();
      const now = new Date().toISOString();
      if (!customer) {
        customer = { id: crypto.randomUUID() };
        await db.prepare(
          `INSERT INTO customers (id, barbershop_id, unit_id, user_id, full_name, phone, email, consent_status, consent_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'GRANTED', ?, ?, ?)`,
        ).bind(customer.id, unit.barbershop_id, unit.unit_id, identity.id, fullName, phone, identity.email, now, now, now).run();
      } else {
        await db.prepare(`UPDATE customers SET full_name = ?, phone = ?, consent_status = 'GRANTED', consent_at = ?, updated_at = ? WHERE id = ? AND unit_id = ?`)
          .bind(fullName, phone, now, now, customer.id, unit.unit_id).run();
      }
      const id = crypto.randomUUID();
      const inserted = await db.prepare(
        `INSERT INTO appointments (id, barbershop_id, unit_id, customer_id, barber_id, service_id, starts_at, ends_at, status, payment_status, price_cents, duration_minutes, customer_name_snapshot, customer_phone_snapshot)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', 'UNPAID', ?, ?, ?, ?
         WHERE (SELECT COUNT(*) FROM appointments a JOIN customers c ON c.id=a.customer_id AND c.unit_id=a.unit_id
                WHERE c.user_id=? AND a.unit_id=? AND a.status IN ('REQUESTED','AWAITING_PAYMENT','CONFIRMED')) < 3`,
      ).bind(id, unit.barbershop_id, unit.unit_id, customer.id, barberId, serviceId, slot.startsAt, slot.endsAt, service.price_cents, service.duration_minutes, fullName, phone, identity.id, unit.unit_id).run();
      if (!inserted.meta.changes) return fail("Você já possui três agendamentos ativos. Cancele ou conclua um antes de solicitar outro.", 429);
      await db.prepare(`INSERT INTO notifications (id,barbershop_id,unit_id,user_id,type,title,message,link)
        SELECT lower(hex(randomblob(16))),m.barbershop_id,m.unit_id,m.user_id,'NEW_APPOINTMENT','Novo agendamento solicitado',?, '/dashboard/agenda'
        FROM memberships m WHERE m.barbershop_id=? AND m.unit_id=? AND m.role='ADMIN' AND m.is_active=1`)
        .bind(`${fullName} solicitou ${service.name} para ${new Date(slot.startsAt).toLocaleString("pt-BR", { timeZone: "America/Bahia" })}.`, unit.barbershop_id, unit.unit_id).run();
      return NextResponse.json({ ok: true, id, status: "REQUESTED", message: "Solicitação enviada. Aguarde a análise do proprietário; o horário só será confirmado após a validação do pagamento." }, { status: 201 });
    }

    if (action === "cancel" || action === "reschedule") {
      const authUser = await customerIdentity(db, session.user.id);
      const oldId = typeof body.appointmentId === "string" ? body.appointmentId : "";
      if (!authUser || !oldId) return fail("Agendamento não encontrado.", 404);
      const old = await db.prepare(
        `SELECT a.* FROM appointments a JOIN customers c ON c.id = a.customer_id AND c.unit_id = a.unit_id
         WHERE a.id = ? AND a.unit_id = ? AND c.user_id = ?`,
      ).bind(oldId, unit.unit_id, authUser.id).first<Record<string, unknown> & { starts_at: string; status: string; payment_status: string; price_cents: number; duration_minutes: number; customer_id: string; barber_id: string; service_id: string; customer_name_snapshot: string; customer_phone_snapshot: string }>();
      if (!old || !["REQUESTED", "AWAITING_PAYMENT", "CONFIRMED"].includes(old.status)) return fail("Esse agendamento não pode mais ser alterado.", 409);
      const deadline = new Date(old.starts_at).getTime() - settings.cancellation_min_hours * 60 * 60_000;
      if (Date.now() > deadline) return fail(`Cancelamentos e remarcações precisam ser solicitados com pelo menos ${settings.cancellation_min_hours} hora(s) de antecedência.`, 409);
      if (action === "cancel") {
        if (old.payment_status === "PAID") return fail("Este agendamento está pago. Use a opção remarcar para transferir o pagamento para outra data.", 409);
        const result = await db.prepare(`UPDATE appointments SET status = 'CANCELLED', cancelled_at = ?, cancellation_reason = 'Cancelado pelo cliente' WHERE id = ? AND unit_id = ? AND status IN ('REQUESTED','AWAITING_PAYMENT') AND payment_status <> 'PAID'`)
          .bind(new Date().toISOString(), oldId, unit.unit_id).run();
        if (!result.meta.changes) return fail("O agendamento já foi alterado. Atualize a página e tente novamente.", 409);
        return NextResponse.json({ ok: true });
      }
      const startsAt = typeof body.startsAt === "string" ? body.startsAt : "";
      const start = new Date(startsAt);
      if (Number.isNaN(start.getTime())) return fail("Escolha um novo horário.", 400);
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit" }).format(start);
      const slot = (await findAvailableSlots(db, unit.unit_id, date, old.service_id)).find((item) => item.barberId === old.barber_id && item.startsAt === start.toISOString());
      if (!slot) return fail("O novo horário não está disponível para esse serviço.", 409);
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const newPaymentStatus = old.payment_status === "PAID" ? "PAID" : "UNPAID";
      const cancellationReason = `Remarcado pelo cliente (${newId})`;
      const batchResult = await db.batch([
        db.prepare(`UPDATE appointments SET status='CANCELLED', payment_status=?, cancelled_at=?, cancellation_reason=? WHERE id=? AND unit_id=? AND status IN ('REQUESTED','AWAITING_PAYMENT','CONFIRMED')`).bind(old.payment_status === "PAID" ? "RETAINED" : old.payment_status, now, cancellationReason, oldId, unit.unit_id),
        db.prepare(`INSERT INTO appointments (id, barbershop_id, unit_id, customer_id, barber_id, service_id, starts_at, ends_at, status, payment_status, price_cents, duration_minutes, customer_name_snapshot, customer_phone_snapshot, rescheduled_from_id)
                    SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?, ?, ?, ?, ?, ?
                    WHERE EXISTS (SELECT 1 FROM appointments WHERE id=? AND unit_id=? AND status='CANCELLED' AND cancelled_at=? AND cancellation_reason=?)`)
          .bind(newId, unit.barbershop_id, unit.unit_id, old.customer_id, old.barber_id, old.service_id, slot.startsAt, slot.endsAt, newPaymentStatus, old.price_cents, old.duration_minutes, old.customer_name_snapshot, old.customer_phone_snapshot, oldId, oldId, unit.unit_id, now, cancellationReason),
        db.prepare(`UPDATE appointment_payments SET appointment_id = ? WHERE appointment_id = ? AND status IN ('PAID','PENDING')
                    AND EXISTS (SELECT 1 FROM appointments WHERE id=? AND unit_id=? AND rescheduled_from_id=?)`)
          .bind(newId, oldId, newId, unit.unit_id, oldId),
      ]);
      if (!batchResult[0]?.meta.changes || !batchResult[1]?.meta.changes) return fail("O agendamento já foi alterado. Atualize a página e tente novamente.", 409);
      return NextResponse.json({ ok: true, id: newId, message: "Pedido de remarcação enviado ao proprietário." }, { status: 201 });
    }
    return fail("Ação não reconhecida.", 400);
  } catch (error) {
    console.error("appointment action error", error);
    return fail("Não foi possível concluir a solicitação. O horário pode ter sido reservado por outra pessoa.", 409);
  }
}

async function getStoreProducts(request: Request) {
  const params = new URL(request.url).searchParams;
  const shopSlug = params.get("shop");
  const db = getBookingDb();
  const unit = await getPublicUnit(db, shopSlug);
  if (!unit) return fail("Nenhuma loja ativa foi encontrada.", 404);
  try {
    const products = await db.prepare(`SELECT id,name,category,image_url,sale_price_cents,stock_quantity FROM products WHERE barbershop_id=? AND unit_id=? AND is_active=1 AND is_for_sale=1 AND stock_quantity>0 ORDER BY category COLLATE NOCASE,name COLLATE NOCASE`)
      .bind(unit.barbershop_id, unit.unit_id).all();
    return NextResponse.json({ data: products.results, unit: { name: unit.unit_name, phone: unit.unit_phone, barbershopName: (await db.prepare("SELECT name FROM barbershops WHERE id=?").bind(unit.barbershop_id).first<{name:string}>())?.name ?? unit.unit_name } });
  } catch (error) { console.error("public store query error", error); return fail("Não foi possível carregar a loja.", 500); }
}

async function createStoreOrder(request: Request, subject: string, body: Record<string, unknown>) {
  const shopSlug = typeof body.barbershopSlug === "string" ? body.barbershopSlug : null;
  const db = getBookingDb();
  const unit = await getPublicUnit(db, shopSlug);
  if (!unit) return fail("Nenhuma loja ativa foi encontrada.", 404);
  const identity = await customerIdentity(db, subject);
  if (!identity) return fail("Não foi possível localizar a conta do cliente.", 400);
  const rawItems = body.items;
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 30) return fail("Adicione ao menos um produto ao carrinho.", 400);
  const quantities = new Map<string, number>();
  for (const raw of rawItems) {
    if (!isRecord(raw) || !orderIdSchema(raw.productId) || !Number.isInteger(raw.quantity) || Number(raw.quantity) < 1 || Number(raw.quantity) > 100) return fail("Confira os produtos e quantidades do pedido.", 400);
    const productId = raw.productId as string;
    quantities.set(productId, (quantities.get(productId) ?? 0) + Number(raw.quantity));
  }
  if ([...quantities.values()].some((quantity) => quantity > 100)) return fail("A quantidade solicitada excede o limite por produto.", 400);
  const name = typeof body.customerName === "string" ? body.customerName.trim().slice(0, 120) : identity.display_name;
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 24) : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : "";
  if (name.length < 2 || phone.replace(/\D/g, "").length < 8) return fail("Informe nome e telefone/WhatsApp válidos.", 400);
  const ids = [...quantities.keys()];
  try {
    const products = await db.prepare(`SELECT id,name,sale_price_cents,stock_quantity FROM products WHERE barbershop_id=? AND unit_id=? AND is_active=1 AND is_for_sale=1 AND stock_quantity>0 AND id IN (${ids.map(() => "?").join(",")})`).bind(unit.barbershop_id, unit.unit_id, ...ids).all<{ id: string; name: string; sale_price_cents: number; stock_quantity: number }>();
    if (products.results.length !== ids.length) return fail("Um produto não está mais disponível. Atualize a loja.", 409);
    const byId = new Map(products.results.map((product) => [product.id, product]));
    for (const [id, quantity] of quantities) if ((byId.get(id)?.stock_quantity ?? 0) < quantity) return fail(`Estoque insuficiente: ${byId.get(id)?.name ?? "produto"}.`, 409);
    const total = [...quantities].reduce((sum, [id, quantity]) => sum + byId.get(id)!.sale_price_cents * quantity, 0);
    if (!Number.isSafeInteger(total) || total > 2_000_000_000) return fail("O total do pedido excede o limite.", 400);
    const customer = await db.prepare(`SELECT id FROM customers WHERE user_id=? AND unit_id=? AND deleted_at IS NULL ORDER BY created_at LIMIT 1`).bind(identity.id, unit.unit_id).first<{ id: string }>();
    const customerId = customer?.id ?? crypto.randomUUID();
    const orderId = crypto.randomUUID();
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];
    if (!customer) statements.push(db.prepare(`INSERT INTO customers (id,barbershop_id,unit_id,user_id,full_name,phone,email,consent_status,consent_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'GRANTED',?,?,?)`).bind(customerId, unit.barbershop_id, unit.unit_id, identity.id, name, phone, identity.email, now, now, now));
    else statements.push(db.prepare(`UPDATE customers SET full_name=?,phone=?,updated_at=? WHERE id=? AND unit_id=? AND user_id=?`).bind(name, phone, now, customerId, unit.unit_id, identity.id));
    statements.push(db.prepare(`INSERT INTO store_orders (id,barbershop_id,unit_id,customer_id,customer_name_snapshot,customer_phone_snapshot,status,fulfillment_type,total_cents,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,'PENDING','PICKUP',?,?,?,?)`).bind(orderId, unit.barbershop_id, unit.unit_id, customerId, name, phone, total, notes || null, now, now));
    for (const [id, quantity] of quantities) {
      const product = byId.get(id)!;
      statements.push(db.prepare(`INSERT INTO store_order_items (id,order_id,unit_id,product_id,product_name_snapshot,quantity,unit_price_cents) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), orderId, unit.unit_id, id, product.name, quantity, product.sale_price_cents));
    }
    await db.batch(statements);
    await db.prepare(`INSERT INTO notifications (id,barbershop_id,unit_id,user_id,type,title,message,link)
      SELECT lower(hex(randomblob(16))),m.barbershop_id,m.unit_id,m.user_id,'NEW_STORE_ORDER','Novo pedido na loja',?, '/dashboard/pedidos'
      FROM memberships m WHERE m.barbershop_id=? AND m.unit_id=? AND m.role='ADMIN' AND m.is_active=1`)
      .bind(`${name} enviou um pedido de compra no valor de R$ ${(total / 100).toFixed(2).replace(".", ",")}.`, unit.barbershop_id, unit.unit_id).run();
    return NextResponse.json({ ok: true, orderId, totalCents: total, message: "Pedido enviado. A barbearia vai confirmar disponibilidade, retirada e pagamento." }, { status: 201 });
  } catch (error) { console.error("store order creation error", error); return fail("Não foi possível registrar o pedido. Confira o estoque e tente novamente.", 409); }
}
