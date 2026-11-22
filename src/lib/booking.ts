import { getCloudflareContext } from "@opennextjs/cloudflare";

export type BookingSettings = {
  slot_interval_minutes: number;
  cancellation_min_hours: number;
  max_days_ahead: number;
  payment_deadline_hours: number;
  auto_confirm: number;
  payment_provider: string | null;
  payment_integration_enabled: number;
};

export function getBookingDb(): D1Database {
  return (getCloudflareContext().env as CloudflareEnv).DB;
}

export async function getPublicUnit(db: D1Database, slug?: string | null) {
  const query = `SELECT u.id AS unit_id, u.barbershop_id, u.name AS unit_name, u.phone AS unit_phone
     FROM units u JOIN barbershops b ON b.id = u.barbershop_id
     WHERE u.is_active = 1 AND b.is_active = 1 ${slug ? "AND b.slug = ?" : ""}
     ORDER BY u.created_at LIMIT 1`;
  const statement = db.prepare(query);
  return (slug ? statement.bind(slug) : statement).first<{ unit_id: string; barbershop_id: string; unit_name: string; unit_phone: string | null }>();
}

export async function getBookingSettings(db: D1Database, unitId: string) {
  const settings = await db.prepare(`SELECT slot_interval_minutes, cancellation_min_hours, max_days_ahead, payment_deadline_hours, auto_confirm, payment_provider, payment_integration_enabled FROM booking_settings WHERE unit_id = ?`)
    .bind(unitId).first<BookingSettings>();
  return settings ?? { slot_interval_minutes: 15, cancellation_min_hours: 24, max_days_ahead: 60, payment_deadline_hours: 24, auto_confirm: 0, payment_provider: null, payment_integration_enabled: 0 };
}

export function dateTimeBahia(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`);
}

export function bahiaWeekday(date: string) {
  return dateTimeBahia(date, "12:00").getUTCDay();
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function dateTimePattern(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export async function expireStaleRequests(db: D1Database, unitId: string) {
  const settings = await db.prepare(`SELECT payment_deadline_hours FROM booking_settings WHERE unit_id=?`).bind(unitId).first<{ payment_deadline_hours: number }>();
  const now = Date.now();
  const requestCutoff = new Date(now - 2 * 60 * 60_000).toISOString();
  const paymentCutoff = new Date(now - (settings?.payment_deadline_hours ?? 24) * 60 * 60_000).toISOString();
  await db.prepare(
    `UPDATE appointments SET status='DECLINED', reviewed_at=?, cancellation_reason='Solicitação expirada após 2 horas sem análise'
     WHERE unit_id=? AND status='REQUESTED' AND payment_status<>'PAID' AND requested_at<=?`,
  ).bind(new Date(now).toISOString(), unitId, requestCutoff).run();
  await db.prepare(
    `UPDATE appointments SET status='DECLINED', reviewed_at=?, cancellation_reason='Solicitação expirada por falta de pagamento'
     WHERE unit_id=? AND status='AWAITING_PAYMENT' AND payment_status='PENDING' AND reviewed_at<=?`,
  ).bind(new Date(now).toISOString(), unitId, paymentCutoff).run();
}

export type AvailableSlot = { barberId: string; barberName: string; startsAt: string; endsAt: string; time: string };

export async function findAvailableSlots(db: D1Database, unitId: string, date: string, serviceId: string): Promise<AvailableSlot[]> {
  if (!dateTimePattern(date)) return [];
  const [service, settings] = await Promise.all([
    db.prepare(`SELECT duration_minutes FROM services WHERE id = ? AND unit_id = ? AND is_active = 1`).bind(serviceId, unitId).first<{ duration_minutes: number }>(),
    db.prepare(`SELECT slot_interval_minutes, max_days_ahead, payment_deadline_hours FROM booking_settings WHERE unit_id = ?`).bind(unitId).first<{ slot_interval_minutes: number; max_days_ahead: number; payment_deadline_hours: number }>(),
  ]);
  if (!service) return [];
  const interval = settings?.slot_interval_minutes ?? 15;
  const maxDays = settings?.max_days_ahead ?? 60;
  const dayStart = dateTimeBahia(date, "00:00");
  const now = Date.now();
  if (Number.isNaN(dayStart.getTime()) || dayStart.getTime() < now - 24 * 60 * 60_000 || dayStart.getTime() > now + maxDays * 24 * 60 * 60_000) return [];

  const weekday = bahiaWeekday(date);
  const { results: schedules } = await db.prepare(
    `SELECT wh.barber_id, wh.opens_at, wh.closes_at, b.display_name
     FROM working_hours wh INNER JOIN barbers b ON b.id = wh.barber_id AND b.unit_id = wh.unit_id
     WHERE wh.unit_id = ? AND wh.weekday = ? AND wh.is_open = 1 AND b.is_active = 1 ORDER BY wh.opens_at`,
  ).bind(unitId, weekday).all<{ barber_id: string; opens_at: string; closes_at: string; display_name: string }>();

  const dateStart = dateTimeBahia(date, "00:00").toISOString();
  const dateEnd = dateTimeBahia(date, "23:59").toISOString();
  const [appointments, blocks] = await Promise.all([
    db.prepare(`SELECT barber_id, starts_at, ends_at FROM appointments
      WHERE unit_id=? AND starts_at<=? AND ends_at>?
        AND (status='CONFIRMED'
          OR (status='REQUESTED' AND (payment_status='PAID' OR requested_at>?))
          OR (status='AWAITING_PAYMENT' AND payment_status='PENDING' AND reviewed_at>?))`)
      .bind(unitId, dateEnd, dateStart, new Date(Date.now() - 2 * 60 * 60_000).toISOString(), new Date(Date.now() - (settings?.payment_deadline_hours ?? 24) * 60 * 60_000).toISOString())
      .all<{ barber_id: string; starts_at: string; ends_at: string }>(),
    db.prepare(`SELECT barber_id, starts_at, ends_at FROM schedule_blocks WHERE unit_id=? AND starts_at<? AND ends_at>?`)
      .bind(unitId, dateEnd, dateStart).all<{ barber_id: string; starts_at: string; ends_at: string }>(),
  ]);
  const slots: AvailableSlot[] = [];
  const duration = service.duration_minutes;
  for (const schedule of schedules) {
    const [openHour, openMinute] = schedule.opens_at.split(":").map(Number);
    const [closeHour, closeMinute] = schedule.closes_at.split(":").map(Number);
    const openMinutes = openHour * 60 + openMinute;
    const closeMinutes = closeHour * 60 + closeMinute;
    for (let minute = openMinutes; minute + duration <= closeMinutes; minute += interval) {
      const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      const start = dateTimeBahia(date, time);
      const end = addMinutes(start, duration);
      if (start.getTime() <= now) continue;
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      const conflicts = appointments.results.some((item) => item.barber_id === schedule.barber_id && item.starts_at < endIso && item.ends_at > startIso);
      const blocked = blocks.results.some((item) => item.barber_id === schedule.barber_id && item.starts_at < endIso && item.ends_at > startIso);
      if (!conflicts && !blocked) slots.push({ barberId: schedule.barber_id, barberName: schedule.display_name, startsAt: startIso, endsAt: endIso, time });
    }
  }
  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.barberName.localeCompare(b.barberName));
}
