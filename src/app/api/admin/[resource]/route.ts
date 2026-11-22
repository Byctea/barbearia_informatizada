import { NextResponse } from "next/server";
import { getAdminScope } from "@/lib/admin-scope";
import { isAdminResource, makeResourceValues, resourceConfig, resourceSchemas } from "@/lib/admin-records";

type Context = { params: Promise<{ resource: string }> };
const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function GET(_request: Request, { params }: Context) {
  const { resource } = await params;
  if (!isAdminResource(resource)) return fail("Cadastro não encontrado.", 404);
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  try {
    const config = resourceConfig[resource];
    const result = await scope.db.prepare(
      `SELECT ${config.select} FROM ${config.table} WHERE barbershop_id = ? AND unit_id = ? AND ${config.activeFilter} ORDER BY ${resource === "customers" ? "full_name" : resource === "barbers" ? "display_name" : "name"} COLLATE NOCASE`,
    ).bind(scope.barbershopId, scope.unitId).all<Record<string, unknown>>();
    return NextResponse.json({ data: result.results });
  } catch (error) {
    console.error("admin list error", error);
    return fail("Não foi possível carregar os cadastros.", 500);
  }
}

export async function POST(request: Request, { params }: Context) {
  const { resource } = await params;
  if (!isAdminResource(resource)) return fail("Cadastro não encontrado.", 404);
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("Envie os dados em formato JSON.", 400); }
  const parsed = resourceSchemas[resource].safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Revise os campos do formulário.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    const config = resourceConfig[resource];
    const now = new Date().toISOString();
    const values = makeResourceValues(resource, parsed.data as Record<string, unknown>, now);
    const row: Record<string, unknown> = { ...values, id: crypto.randomUUID(), barbershop_id: scope.barbershopId, unit_id: scope.unitId, is_active: 1, created_at: now };
    const columns = config.insertColumns;
    const result = await scope.db.prepare(`INSERT INTO ${config.table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
      .bind(...columns.map((column) => row[column] ?? null)).run();
    if (resource === "products" && row.is_for_sale) await scope.db.prepare(`INSERT INTO notifications (id,barbershop_id,unit_id,user_id,type,title,message,link)
      SELECT lower(hex(randomblob(16))),m.barbershop_id,m.unit_id,m.user_id,'NEW_PRODUCT','Novo produto na loja',?,?
      FROM memberships m WHERE m.barbershop_id=? AND m.unit_id=? AND m.role='CLIENT' AND m.is_active=1`)
      .bind(`${String(row.name)} já está disponível para compra.`, `/b/${(await scope.db.prepare("SELECT slug FROM barbershops WHERE id=?").bind(scope.barbershopId).first<{slug:string}>())?.slug ?? ""}/loja`, scope.barbershopId, scope.unitId).run();
    if (!result.meta.changes) throw new Error("record_insert_failed");
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("admin create error", error);
    return fail("Não foi possível salvar o cadastro.", 500);
  }
}
