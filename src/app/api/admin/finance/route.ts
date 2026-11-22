import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminScope } from "@/lib/admin-scope";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => { const date = new Date(`${value}T00:00:00Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; });
const expenseSchema = z.object({
  category: z.enum(["RENT", "ENERGY", "WATER", "INTERNET", "EQUIPMENT", "OTHER"]),
  description: z.string().trim().min(2).max(120),
  amountCents: z.number().int().min(1).max(100_000_000),
  occurredOn: dateSchema,
  paymentMethod: z.enum(["CASH", "PIX", "DEBIT_CARD", "CREDIT_CARD", "OTHER"]),
  notes: z.string().trim().max(1000).optional().default(""),
  monthly: z.boolean().default(false),
});
const statusSchema = z.enum(["PENDING", "CONFIRMED", "CANCELLED"]);

export async function GET(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if ((from && !dateSchema.safeParse(from).success) || (to && !dateSchema.safeParse(to).success)) return fail("Período inválido.", 400);
  const start = from ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia" }).format(new Date()).slice(0, 7) + "-01";
  const end = to ?? `${start.slice(0, 7)}-31`;
  if (start > end) return fail("A data inicial deve ser anterior ou igual à data final.", 400);
  try {
    const [rows, totals, count] = await Promise.all([
      scope.db.prepare(`SELECT id,entry_type,category,description,amount_cents,occurred_on,payment_method,recurrence_group_id,status,notes,sale_id,visit_id,stock_movement_id FROM finance_entries WHERE barbershop_id=? AND unit_id=? AND occurred_on>=? AND occurred_on<=? ORDER BY occurred_on DESC,created_at DESC LIMIT 500`).bind(scope.barbershopId, scope.unitId, start, end).all<Record<string, unknown>>(),
      scope.db.prepare(`SELECT COALESCE(SUM(CASE WHEN entry_type='INCOME' AND status='CONFIRMED' THEN amount_cents ELSE 0 END),0) AS income_cents, COALESCE(SUM(CASE WHEN entry_type='EXPENSE' AND status='CONFIRMED' THEN amount_cents ELSE 0 END),0) AS expense_cents, SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) AS pending_count FROM finance_entries WHERE barbershop_id=? AND unit_id=? AND occurred_on>=? AND occurred_on<=?`).bind(scope.barbershopId, scope.unitId, start, end).first<{ income_cents: number; expense_cents: number; pending_count: number }>(),
      scope.db.prepare(`SELECT COUNT(*) AS count FROM finance_entries WHERE barbershop_id=? AND unit_id=? AND occurred_on>=? AND occurred_on<=?`).bind(scope.barbershopId, scope.unitId, start, end).first<{ count: number }>(),
    ]);
    return NextResponse.json({ entries: rows.results, hasMore: (count?.count ?? 0) > rows.results.length, totals: totals ?? { income_cents: 0, expense_cents: 0, pending_count: 0 }, from: start, to: end });
  } catch (error) {
    console.error("admin finance list error", error);
    return fail("Não foi possível carregar o fluxo financeiro.", 500);
  }
}

export async function POST(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("Envie os dados em formato JSON.", 400); }
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Revise os campos da despesa.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  const input = parsed.data;
  const groupId = input.monthly ? crypto.randomUUID() : null;
  const [year, month, day] = input.occurredOn.split("-").map(Number);
  const periods = input.monthly ? 12 : 1;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia" }).format(new Date());
  const statements = Array.from({ length: periods }, (_, offset) => {
    const target = new Date(Date.UTC(year, month - 1 + offset, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    const occurredOn = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
    return scope.db.prepare(`INSERT INTO finance_entries (id,barbershop_id,unit_id,entry_type,category,description,amount_cents,occurred_on,payment_method,recurrence_group_id,status,notes) VALUES (?,?,?,'EXPENSE',?,?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(), scope.barbershopId, scope.unitId, input.category, input.description, input.amountCents, occurredOn, input.paymentMethod, groupId, offset === 0 && occurredOn <= today ? "CONFIRMED" : "PENDING", input.notes || null);
  });
  try {
    await scope.db.batch(statements);
    return NextResponse.json({ ok: true, created: periods }, { status: 201 });
  } catch (error) {
    console.error("admin finance create error", error);
    return fail("Não foi possível registrar a despesa.", 500);
  }
}

export async function PATCH(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("Envie os dados em formato JSON.", 400); }
  const schema = z.object({ id: z.string().min(1).max(100), status: statusSchema });
  const parsed = schema.safeParse(body);
  if (!parsed.success || parsed.data.status === "PENDING") return fail("Ação financeira inválida.", 400);
  try {
    const result = await scope.db.prepare(`UPDATE finance_entries SET status=? WHERE id=? AND unit_id=? AND barbershop_id=? AND entry_type='EXPENSE' AND sale_id IS NULL AND visit_id IS NULL AND stock_movement_id IS NULL AND status='PENDING'`)
      .bind(parsed.data.status, parsed.data.id, scope.unitId, scope.barbershopId).run();
    if (!result.meta.changes) return fail("Despesa não encontrada ou já processada.", 409);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("admin finance update error", error);
    return fail("Não foi possível atualizar a despesa.", 500);
  }
}
