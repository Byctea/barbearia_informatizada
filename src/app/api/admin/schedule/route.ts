import { NextResponse } from "next/server";
import { getAdminScope } from "@/lib/admin-scope";
import { expireStaleRequests, getBookingSettings } from "@/lib/booking";

const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function GET() {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  try {
    const settings = await getBookingSettings(scope.db, scope.unitId);
    const [barbers, hours, blocks] = await Promise.all([
      scope.db.prepare(`SELECT id, display_name, phone FROM barbers WHERE unit_id = ? AND is_active = 1 ORDER BY display_name`).bind(scope.unitId).all(),
      scope.db.prepare(`SELECT id, barber_id, weekday, opens_at, closes_at, is_open FROM working_hours WHERE unit_id = ? ORDER BY barber_id, weekday`).bind(scope.unitId).all(),
      scope.db.prepare(`SELECT id, barber_id, starts_at, ends_at, reason FROM schedule_blocks WHERE unit_id = ? AND ends_at > ? ORDER BY starts_at LIMIT 100`).bind(scope.unitId, new Date().toISOString()).all(),
    ]);
    return NextResponse.json({ settings, barbers: barbers.results, hours: hours.results, blocks: blocks.results });
  } catch (error) {
    console.error("schedule read error", error);
    return fail("Não foi possível carregar as configurações da agenda.", 500);
  }
}

export async function PUT(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  let body: Record<string, unknown>;
  try { const parsed: unknown = await request.json(); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail("Envie um objeto JSON válido.", 400); body = parsed as Record<string, unknown>; } catch { return fail("Envie os dados em formato JSON.", 400); }
  const settings = body.settings as Record<string, unknown> | undefined;
  const hours = body.hours;
  if (!settings || !Array.isArray(hours) || hours.length > 100) return fail("Configuração de horários inválida.", 400);
  const slot = Number(settings.slot_interval_minutes);
  const cancelHours = Number(settings.cancellation_min_hours);
  const maxDays = Number(settings.max_days_ahead);
  const paymentDeadline = Number(settings.payment_deadline_hours);
  if (!Number.isInteger(slot) || slot < 5 || slot > 120 || !Number.isInteger(cancelHours) || cancelHours < 0 || cancelHours > 720 || !Number.isInteger(maxDays) || maxDays < 1 || maxDays > 365 || !Number.isInteger(paymentDeadline) || paymentDeadline < 1 || paymentDeadline > 168) return fail("Revise intervalo, prazos e limite de dias.", 400);

  try {
    const barberRows = await scope.db.prepare(`SELECT id FROM barbers WHERE unit_id = ? AND is_active = 1`).bind(scope.unitId).all<{ id: string }>();
    const validBarbers = new Set(barberRows.results.map((barber) => barber.id));
    if (!(hours as unknown[]).every((value) => value !== null && typeof value === "object" && !Array.isArray(value))) return fail("Cada horário precisa ser um objeto válido.", 400);
    const normalized = (hours as unknown[]).map((value) => value as Record<string, unknown>);
    const uniqueDays = new Set<string>();
    for (const item of normalized) {
      const weekday = Number(item.weekday);
      const isOpen = item.isOpen === true;
      if (typeof item.barberId !== "string" || !validBarbers.has(item.barberId) || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) return fail("Há um dia ou barbeiro inválido.", 400);
      const dayKey = `${item.barberId}:${weekday}`;
      if (uniqueDays.has(dayKey)) return fail("Há dias repetidos na configuração semanal.", 400);
      uniqueDays.add(dayKey);
      if (isOpen && (typeof item.opensAt !== "string" || typeof item.closesAt !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.opensAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.closesAt) || item.closesAt <= item.opensAt)) return fail("Horário de abertura ou fechamento inválido.", 400);
    }
    if (normalized.length !== validBarbers.size * 7) return fail("Informe os sete dias da semana para cada barbeiro ativo.", 400);
    const now = new Date().toISOString();
    const commands = [
      scope.db.prepare(`INSERT OR IGNORE INTO booking_settings (id, barbershop_id, unit_id) VALUES (?, ?, ?)`)
        .bind(`booking_settings_${scope.unitId}`, scope.barbershopId, scope.unitId),
      scope.db.prepare(`UPDATE booking_settings SET slot_interval_minutes = ?, cancellation_min_hours = ?, max_days_ahead = ?, payment_deadline_hours = ?, auto_confirm = 0, updated_at = ? WHERE unit_id = ?`)
        .bind(slot, cancelHours, maxDays, paymentDeadline, now, scope.unitId),
      scope.db.prepare(`DELETE FROM working_hours WHERE unit_id = ?`).bind(scope.unitId),
      ...normalized.filter((item) => item.isOpen === true).map((item) => scope.db.prepare(
        `INSERT INTO working_hours (id, barbershop_id, unit_id, barber_id, weekday, opens_at, closes_at, is_open) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      ).bind(crypto.randomUUID(), scope.barbershopId, scope.unitId, item.barberId, Number(item.weekday), item.opensAt, item.closesAt)),
    ];
    await scope.db.batch(commands);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("schedule save error", error);
    return fail("Não foi possível salvar a agenda.", 500);
  }
}

export async function POST(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  let body: Record<string, unknown>;
  try { const parsed: unknown = await request.json(); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail("Envie um objeto JSON válido.", 400); body = parsed as Record<string, unknown>; } catch { return fail("Envie os dados em formato JSON.", 400); }
  const barberId = typeof body.barberId === "string" ? body.barberId : "";
  const start = typeof body.startsAt === "string" ? new Date(body.startsAt) : new Date(NaN);
  const end = typeof body.endsAt === "string" ? new Date(body.endsAt) : new Date(NaN);
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "Bloqueio de agenda";
  if (!barberId || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || start <= new Date() || end.getTime() - start.getTime() > 31 * 24 * 60 * 60_000) return fail("Informe um barbeiro e um período futuro de até 31 dias.", 400);
  try {
    await expireStaleRequests(scope.db, scope.unitId);
    const conflict = await scope.db.prepare(
      `SELECT 1 AS found FROM appointments WHERE barber_id=? AND unit_id=? AND status IN ('REQUESTED','AWAITING_PAYMENT','CONFIRMED') AND starts_at<? AND ends_at>? LIMIT 1`,
    ).bind(barberId, scope.unitId, end.toISOString(), start.toISOString()).first();
    if (conflict) return fail("Este bloqueio coincide com um agendamento ativo. Remarque ou cancele o agendamento antes de bloquear o horário.", 409);
    const result = await scope.db.prepare(
      `INSERT INTO schedule_blocks (id, barbershop_id, unit_id, barber_id, starts_at, ends_at, reason)
       SELECT ?, ?, ?, b.id, ?, ?, ? FROM barbers b WHERE b.id = ? AND b.unit_id = ? AND b.is_active = 1`,
    ).bind(crypto.randomUUID(), scope.barbershopId, scope.unitId, start.toISOString(), end.toISOString(), reason || null, barberId, scope.unitId).run();
    if (!result.meta.changes) return fail("Barbeiro não encontrado.", 404);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("schedule block create error", error);
    return fail("Não foi possível criar o bloqueio.", 400);
  }
}

export async function DELETE(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("Informe o bloqueio.", 400);
  const result = await scope.db.prepare(`DELETE FROM schedule_blocks WHERE id = ? AND unit_id = ? AND barbershop_id = ?`).bind(id, scope.unitId, scope.barbershopId).run();
  if (!result.meta.changes) return fail("Bloqueio não encontrado.", 404);
  return NextResponse.json({ ok: true });
}
