import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminScope } from "@/lib/admin-scope";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const configureSchema = z.object({
  action: z.literal("configure"),
  programType: z.enum(["VISITS", "POINTS"]),
  visitsRequired: z.number().int().min(2).max(100).nullable(),
  pointsPerCurrencyUnit: z.number().int().min(1).max(1000).nullable(),
  pointsRequired: z.number().int().min(1).max(1_000_000).nullable(),
  rewardDescription: z.string().trim().min(2).max(160),
}).superRefine((value, ctx) => {
  if (value.programType === "VISITS" && value.visitsRequired === null) ctx.addIssue({ code: "custom", path: ["visitsRequired"], message: "Informe a quantidade de atendimentos." });
  if (value.programType === "POINTS" && (value.pointsPerCurrencyUnit === null || value.pointsRequired === null)) ctx.addIssue({ code: "custom", path: ["pointsRequired"], message: "Informe a regra de pontos." });
});
const redeemSchema = z.object({ action: z.literal("redeem"), customerId: z.string().min(1).max(100) });
const bodySchema = z.discriminatedUnion("action", [configureSchema, redeemSchema]);
const membershipSchema = z.object({ customerId: z.string().min(1).max(100), isMember: z.boolean(), preferredReturnDays: z.number().int().min(1).max(365).nullable() });
const businessDate = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);

export async function GET() {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  try {
    const [program, customers] = await Promise.all([
      scope.db.prepare(`SELECT id,name,program_type,visits_required,points_per_currency_unit,points_required,reward_description FROM loyalty_programs WHERE unit_id=? AND barbershop_id=? AND is_active=1 LIMIT 1`).bind(scope.unitId, scope.barbershopId).first<Record<string, unknown>>(),
      scope.db.prepare(`SELECT c.id,c.full_name,c.phone,c.preferred_return_days,c.is_loyalty_member,MAX(substr(v.occurred_at,1,10)) AS last_visit,COUNT(DISTINCT v.id) AS total_visits,COALESCE((SELECT SUM(l.visits_delta) FROM loyalty_ledger l WHERE l.customer_id=c.id AND l.unit_id=c.unit_id AND l.program_id=(SELECT id FROM loyalty_programs WHERE unit_id=c.unit_id AND is_active=1 LIMIT 1)),0) AS visits_balance,COALESCE((SELECT SUM(l.points_delta) FROM loyalty_ledger l WHERE l.customer_id=c.id AND l.unit_id=c.unit_id AND l.program_id=(SELECT id FROM loyalty_programs WHERE unit_id=c.unit_id AND is_active=1 LIMIT 1)),0) AS points_balance FROM customers c LEFT JOIN visits v ON v.customer_id=c.id AND v.unit_id=c.unit_id WHERE c.unit_id=? AND c.barbershop_id=? AND c.deleted_at IS NULL GROUP BY c.id ORDER BY c.full_name COLLATE NOCASE`).bind(scope.unitId, scope.barbershopId).all<Record<string, unknown>>(),
    ]);
    const today = businessDate(new Date());
    const rows = customers.results.map((row) => {
      const lastVisit = typeof row.last_visit === "string" ? row.last_visit : null;
      const daysSinceLastVisit = lastVisit ? Math.max(0, Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${lastVisit}T12:00:00Z`)) / 86_400_000)) : null;
      const idealDays = Number(row.preferred_return_days || 30);
      const status = daysSinceLastVisit === null || daysSinceLastVisit >= 90 ? "INACTIVE" : daysSinceLastVisit <= idealDays ? "ON_TIME" : "LATE";
      return { ...row, days_since_last_visit: daysSinceLastVisit, ideal_return_days: idealDays, status };
    });
    return NextResponse.json({ program, customers: rows });
  } catch (error) {
    console.error("admin loyalty list error", error);
    return fail("Não foi possível carregar a fidelidade.", 500);
  }
}

export async function PATCH(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  let json: unknown;
  try { json = await request.json(); } catch { return fail("Envie os dados em formato JSON.", 400); }
  const parsed = membershipSchema.safeParse(json);
  if (!parsed.success) return fail("Revise a participação e o intervalo de retorno.", 400);
  try {
    const result = await scope.db.prepare(`UPDATE customers SET is_loyalty_member=?,preferred_return_days=?,updated_at=? WHERE id=? AND unit_id=? AND barbershop_id=? AND deleted_at IS NULL`)
      .bind(parsed.data.isMember ? 1 : 0, parsed.data.preferredReturnDays, new Date().toISOString(), parsed.data.customerId, scope.unitId, scope.barbershopId).run();
    if (!result.meta.changes) return fail("Cliente não encontrado nesta unidade.", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("admin loyalty membership update error", error);
    return fail("Não foi possível atualizar o cliente.", 500);
  }
}

export async function POST(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  let json: unknown;
  try { json = await request.json(); } catch { return fail("Envie os dados em formato JSON.", 400); }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Revise os campos enviados.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    if (parsed.data.action === "configure") {
      const input = parsed.data;
      const existing = await scope.db.prepare(`SELECT id,program_type FROM loyalty_programs WHERE unit_id=? AND barbershop_id=? AND is_active=1 LIMIT 1`).bind(scope.unitId, scope.barbershopId).first<{ id: string; program_type: string }>();
      if (existing && existing.program_type !== input.programType) {
        const usage = await scope.db.prepare(`SELECT COUNT(*) AS count FROM loyalty_ledger WHERE program_id=? AND unit_id=?`).bind(existing.id, scope.unitId).first<{ count: number }>();
        if ((usage?.count ?? 0) > 0) return fail("Este programa já tem movimentações. Para preservar o saldo, não altere o tipo da regra.", 409);
      }
      if (existing) {
        await scope.db.prepare(`UPDATE loyalty_programs SET program_type=?,visits_required=?,points_per_currency_unit=?,points_required=?,reward_description=? WHERE id=? AND unit_id=? AND barbershop_id=? AND is_active=1`)
          .bind(input.programType, input.programType === "VISITS" ? input.visitsRequired : null, input.programType === "POINTS" ? input.pointsPerCurrencyUnit : null, input.programType === "POINTS" ? input.pointsRequired : null, input.rewardDescription, existing.id, scope.unitId, scope.barbershopId).run();
      } else {
        const id = crypto.randomUUID();
        await scope.db.batch([
          scope.db.prepare(`UPDATE loyalty_programs SET is_active=0 WHERE unit_id=? AND barbershop_id=? AND is_active=1`).bind(scope.unitId, scope.barbershopId),
          scope.db.prepare(`INSERT INTO loyalty_programs (id,barbershop_id,unit_id,name,program_type,visits_required,points_per_currency_unit,points_required,reward_description,is_active) VALUES (?,?,?,?,?,?,?,?,?,1)`)
            .bind(id, scope.barbershopId, scope.unitId, input.programType === "VISITS" ? `${input.visitsRequired} atendimentos` : "Pontos por valor gasto", input.programType, input.programType === "VISITS" ? input.visitsRequired : null, input.programType === "POINTS" ? input.pointsPerCurrencyUnit : null, input.programType === "POINTS" ? input.pointsRequired : null, input.rewardDescription),
        ]);
      }
      return NextResponse.json({ ok: true });
    }

    const program = await scope.db.prepare(`SELECT id,program_type,visits_required,points_required FROM loyalty_programs WHERE unit_id=? AND barbershop_id=? AND is_active=1 LIMIT 1`).bind(scope.unitId, scope.barbershopId).first<{ id: string; program_type: string; visits_required: number | null; points_required: number | null }>();
    if (!program) return fail("Configure um programa de fidelidade antes de resgatar.", 409);
    const id = crypto.randomUUID();
    const threshold = program.program_type === "VISITS" ? program.visits_required : program.points_required;
    if (!threshold || threshold < 1) return fail("A regra de recompensa está incompleta.", 409);
    const result = await scope.db.prepare(`INSERT INTO loyalty_ledger (id,barbershop_id,unit_id,customer_id,program_id,points_delta,visits_delta,entry_type,description,occurred_at) SELECT ?,?,?,?,?,CASE WHEN p.program_type='POINTS' THEN -p.points_required ELSE 0 END,CASE WHEN p.program_type='VISITS' THEN -p.visits_required ELSE 0 END,'REDEEMED',p.reward_description,? FROM loyalty_programs p JOIN customers c ON c.id=? AND c.unit_id=p.unit_id WHERE p.id=? AND p.unit_id=? AND p.barbershop_id=? AND p.is_active=1 AND c.deleted_at IS NULL AND c.is_loyalty_member=1 AND (SELECT COALESCE(SUM(l.points_delta),0) FROM loyalty_ledger l WHERE l.customer_id=c.id AND l.unit_id=c.unit_id AND l.program_id=p.id)>=CASE WHEN p.program_type='POINTS' THEN p.points_required ELSE 0 END AND (SELECT COALESCE(SUM(l.visits_delta),0) FROM loyalty_ledger l WHERE l.customer_id=c.id AND l.unit_id=c.unit_id AND l.program_id=p.id)>=CASE WHEN p.program_type='VISITS' THEN p.visits_required ELSE 0 END`)
      .bind(id, scope.barbershopId, scope.unitId, parsed.data.customerId, program.id, new Date().toISOString(), parsed.data.customerId, program.id, scope.unitId, scope.barbershopId).run();
    if (!result.meta.changes) return fail("Cliente sem saldo suficiente, inativo ou fora do programa.", 409);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("admin loyalty action error", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("idx_loyalty_one_active_program_per_unit")) return fail("O programa foi atualizado em outra operação. Atualize a tela.", 409);
    return fail("Não foi possível concluir a operação de fidelidade.", 500);
  }
}
