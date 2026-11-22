import { NextResponse } from "next/server";
import { getAdminScope } from "@/lib/admin-scope";
import { dateTimeBahia, dateTimePattern, expireStaleRequests, getBookingSettings } from "@/lib/booking";

const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });
const methods = ["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD"] as const;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export async function GET(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  const params = new URL(request.url).searchParams;
  const pendingOnly = params.get("pending") === "1";
  const day = params.get("date") ?? "";
  if (!pendingOnly && !dateTimePattern(day)) return fail("Informe a data da agenda.", 400);
  try {
    const settings = await getBookingSettings(scope.db, scope.unitId);
    const now = Date.now();
    const requestCutoff = new Date(now - 2 * 60 * 60_000).toISOString();
    const paymentCutoff = new Date(now - settings.payment_deadline_hours * 60 * 60_000).toISOString();
    if (pendingOnly) {
      const pending = await scope.db.prepare(
        `SELECT a.id, a.starts_at, a.ends_at, a.status, a.payment_status, a.price_cents,
                a.customer_name_snapshot, a.customer_phone_snapshot, s.name AS service_name,
                b.display_name AS barber_name
         FROM appointments a JOIN services s ON s.id=a.service_id AND s.unit_id=a.unit_id
         JOIN barbers b ON b.id=a.barber_id AND b.unit_id=a.unit_id
         WHERE a.barbershop_id=? AND a.unit_id=?
           AND ((a.status='REQUESTED' AND (a.payment_status='PAID' OR a.requested_at>?))
             OR (a.status='AWAITING_PAYMENT' AND a.payment_status='PENDING' AND a.reviewed_at>?))
         ORDER BY a.starts_at LIMIT 100`,
      ).bind(scope.barbershopId, scope.unitId, requestCutoff, paymentCutoff).all();
      return NextResponse.json({ appointments: pending.results });
    }
    const start = dateTimeBahia(day, "00:00").toISOString();
    const end = new Date(dateTimeBahia(day, "00:00").getTime() + 24 * 60 * 60_000).toISOString();
    const [appointments, blocks] = await Promise.all([
      scope.db.prepare(
        `SELECT a.id, a.starts_at, a.ends_at,
                CASE WHEN a.status='REQUESTED' AND a.payment_status<>'PAID' AND a.requested_at<=? THEN 'EXPIRED'
                     WHEN a.status='AWAITING_PAYMENT' AND a.payment_status='PENDING' AND a.reviewed_at<=? THEN 'EXPIRED'
                     ELSE a.status END AS status,
                a.payment_status, a.price_cents, a.customer_name_snapshot, a.customer_phone_snapshot,
                s.name AS service_name, b.display_name AS barber_name
         FROM appointments a JOIN services s ON s.id=a.service_id AND s.unit_id=a.unit_id
         JOIN barbers b ON b.id=a.barber_id AND b.unit_id=a.unit_id
        WHERE a.barbershop_id=? AND a.unit_id=? AND a.starts_at>=? AND a.starts_at<?
         ORDER BY a.starts_at`,
      ).bind(requestCutoff, paymentCutoff, scope.barbershopId, scope.unitId, start, end).all(),
      scope.db.prepare(`SELECT id, barber_id, starts_at, ends_at, reason FROM schedule_blocks WHERE unit_id=? AND starts_at<? AND ends_at>? ORDER BY starts_at`)
        .bind(scope.unitId, end, start).all(),
    ]);
    return NextResponse.json({ appointments: appointments.results, blocks: blocks.results });
  } catch (error) {
    console.error("admin appointment list error", error);
    return fail("Não foi possível carregar a agenda.", 500);
  }
}

export async function PATCH(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  let body: Record<string, unknown>;
  try { const parsed: unknown = await request.json(); if (!isRecord(parsed)) return fail("Envie um objeto JSON válido.", 400); body = parsed; } catch { return fail("Envie os dados em formato JSON.", 400); }
  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action;
  if (!id || !["approve", "decline", "confirm-payment", "cancel"].includes(String(action))) return fail("Ação inválida.", 400);
  const now = new Date().toISOString();
  try {
    await expireStaleRequests(scope.db, scope.unitId);
    const appointment = await scope.db.prepare(`SELECT id, status, payment_status, price_cents FROM appointments WHERE id=? AND unit_id=? AND barbershop_id=?`)
      .bind(id, scope.unitId, scope.barbershopId).first<{ id: string; status: string; payment_status: string; price_cents: number }>();
    if (!appointment) return fail("Agendamento não encontrado.", 404);
    if (action === "approve") {
      if (appointment.status !== "REQUESTED") return fail("A solicitação já foi analisada.", 409);
      const checks = await scope.db.prepare(
        `SELECT a.starts_at, a.ends_at, a.barber_id,
           EXISTS(SELECT 1 FROM working_hours wh WHERE wh.unit_id=a.unit_id AND wh.barber_id=a.barber_id
             AND wh.weekday=CAST(strftime('%w',a.starts_at,'-3 hours') AS INTEGER) AND wh.is_open=1
             AND wh.opens_at<=strftime('%H:%M',a.starts_at,'-3 hours')
             AND wh.closes_at>=strftime('%H:%M',a.ends_at,'-3 hours')) AS within_hours,
           EXISTS(SELECT 1 FROM schedule_blocks sb WHERE sb.unit_id=a.unit_id AND sb.barber_id=a.barber_id
             AND sb.starts_at<a.ends_at AND sb.ends_at>a.starts_at) AS blocked,
           EXISTS(SELECT 1 FROM appointments other WHERE other.unit_id=a.unit_id AND other.barber_id=a.barber_id
             AND other.id<>a.id AND other.status IN ('REQUESTED','AWAITING_PAYMENT','CONFIRMED')
             AND other.starts_at<a.ends_at AND other.ends_at>a.starts_at) AS conflict
         FROM appointments a WHERE a.id=? AND a.unit_id=? AND a.barbershop_id=?`,
      ).bind(id, scope.unitId, scope.barbershopId).first<{ within_hours: number; blocked: number; conflict: number }>();
      if (!checks?.within_hours) return fail("Esse horário não está mais dentro do expediente configurado. Ajuste a agenda antes de aprovar.", 409);
      if (checks.blocked) return fail("Esse horário foi bloqueado depois da solicitação. Recuse ou combine outra data com o cliente.", 409);
      if (checks.conflict) return fail("Já existe outro agendamento nesse horário. Atualize a agenda e resolva o conflito antes de aprovar.", 409);
      const paid = appointment.payment_status === "PAID" || appointment.price_cents === 0;
      const result = await scope.db.prepare(`UPDATE appointments SET status=?, payment_status=?, reviewed_at=? WHERE id=? AND unit_id=? AND status='REQUESTED'`)
        .bind(paid ? "CONFIRMED" : "AWAITING_PAYMENT", paid ? "PAID" : "PENDING", now, id, scope.unitId).run();
      if (!result.meta.changes) return fail("A solicitação já foi alterada. Atualize a agenda.", 409);
      return NextResponse.json({ ok: true, status: paid ? "CONFIRMED" : "AWAITING_PAYMENT" });
    }
    if (action === "decline") {
      if (appointment.status !== "REQUESTED" || appointment.payment_status === "PAID") return fail("Esse agendamento não pode ser recusado; confira o pagamento e converse com o cliente.", 409);
      const result = await scope.db.prepare(`UPDATE appointments SET status='DECLINED', reviewed_at=?, cancellation_reason='Recusado pelo proprietário' WHERE id=? AND unit_id=? AND status='REQUESTED'`)
        .bind(now, id, scope.unitId).run();
      if (!result.meta.changes) return fail("A solicitação já foi alterada. Atualize a agenda.", 409);
      return NextResponse.json({ ok: true });
    }
    if (action === "confirm-payment") {
      if (appointment.status !== "AWAITING_PAYMENT" || appointment.payment_status !== "PENDING") return fail("O agendamento não está aguardando pagamento.", 409);
      const method = body.method;
      if (!(methods as readonly unknown[]).includes(method)) return fail("Escolha a forma de pagamento conferida.", 400);
      if (appointment.price_cents > 0) {
        const results = await scope.db.batch([
          scope.db.prepare(`UPDATE appointments SET status='CONFIRMED', payment_status='PAID', reviewed_at=? WHERE id=? AND unit_id=? AND status='AWAITING_PAYMENT' AND payment_status='PENDING'`)
            .bind(now, id, scope.unitId),
          scope.db.prepare(`INSERT OR IGNORE INTO appointment_payments (id, appointment_id, unit_id, amount_cents, method, status, paid_at, provider, notes)
             SELECT ?, id, unit_id, price_cents, ?, 'PAID', ?, 'MANUAL', 'Pagamento conferido pelo proprietário'
             FROM appointments WHERE id=? AND unit_id=? AND status='CONFIRMED' AND payment_status='PAID'`)
            .bind(`payment_manual_${id}`, method, now, id, scope.unitId),
        ]);
        if (!results[0]?.meta.changes) return fail("O agendamento já foi alterado. Atualize a agenda.", 409);
      } else {
        const result = await scope.db.prepare(`UPDATE appointments SET status='CONFIRMED', payment_status='PAID', reviewed_at=? WHERE id=? AND unit_id=? AND status='AWAITING_PAYMENT' AND payment_status='PENDING'`)
          .bind(now, id, scope.unitId).run();
        if (!result.meta.changes) return fail("O agendamento já foi alterado. Atualize a agenda.", 409);
      }
      return NextResponse.json({ ok: true, status: "CONFIRMED" });
    }
    if (action === "cancel") {
      if (!["REQUESTED", "AWAITING_PAYMENT", "CONFIRMED"].includes(appointment.status)) return fail("Agendamento já encerrado.", 409);
      if (appointment.payment_status === "PAID") return fail("Esse agendamento está pago. Oriente o cliente a solicitar uma remarcação para transferir o pagamento.", 409);
      const result = await scope.db.prepare(`UPDATE appointments SET status='CANCELLED', payment_status=CASE WHEN payment_status='PAID' THEN 'RETAINED' ELSE payment_status END, cancelled_at=?, cancellation_reason='Cancelado pelo proprietário' WHERE id=? AND unit_id=? AND status IN ('REQUESTED','AWAITING_PAYMENT','CONFIRMED')`)
        .bind(now, id, scope.unitId).run();
      if (!result.meta.changes) return fail("O agendamento já foi alterado. Atualize a agenda.", 409);
      return NextResponse.json({ ok: true });
    }
    return fail("Ação inválida.", 400);
  } catch (error) {
    console.error("admin appointment action error", error);
    if (error instanceof Error && error.message.includes("appointment_time_conflict")) return fail("Houve um conflito de horário. Atualize a agenda e escolha aprovar ou recusar após revisar o conflito.", 409);
    return fail("Não foi possível atualizar o agendamento.", 409);
  }
}
