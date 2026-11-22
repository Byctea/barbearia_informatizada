import { NextResponse } from "next/server";
import { getAdminScope } from "@/lib/admin-scope";
import { isAdminResource, makeResourceValues, resourceConfig, resourceSchemas } from "@/lib/admin-records";

type Context = { params: Promise<{ resource: string; id: string }> };
const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function PATCH(request: Request, { params }: Context) {
  const { resource, id } = await params;
  if (!isAdminResource(resource)) return fail("Cadastro não encontrado.", 404);
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  let body: unknown;
  try { body = await request.json(); } catch { return fail("Envie os dados em formato JSON.", 400); }
  const parsed = resourceSchemas[resource].safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Revise os campos do formulário.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    const config = resourceConfig[resource];
    const values = makeResourceValues(resource, parsed.data as Record<string, unknown>, new Date().toISOString());
    const columns = config.updateColumns;
    const result = await scope.db.prepare(
      `UPDATE ${config.table} SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE id = ? AND barbershop_id = ? AND unit_id = ? AND ${config.activeFilter}`,
    ).bind(...columns.map((column) => values[column] ?? null), id, scope.barbershopId, scope.unitId).run();
    if (!result.meta.changes) return fail("Cadastro não encontrado.", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("admin update error", error);
    return fail("Não foi possível atualizar o cadastro.", 500);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { resource, id } = await params;
  if (!isAdminResource(resource)) return fail("Cadastro não encontrado.", 404);
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  try {
    const config = resourceConfig[resource];
    const statement = config.deletedAt
      ? `UPDATE ${config.table} SET deleted_at = ?, updated_at = ? WHERE id = ? AND barbershop_id = ? AND unit_id = ? AND deleted_at IS NULL`
      : `UPDATE ${config.table} SET is_active = 0 WHERE id = ? AND barbershop_id = ? AND unit_id = ? AND is_active = 1`;
    const values = config.deletedAt
      ? [new Date().toISOString(), new Date().toISOString(), id, scope.barbershopId, scope.unitId]
      : [id, scope.barbershopId, scope.unitId];
    const result = await scope.db.prepare(statement).bind(...values).run();
    if (!result.meta.changes) return fail("Cadastro não encontrado ou já inativo.", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("admin delete error", error);
    return fail("Não foi possível inativar o cadastro. Ele pode estar vinculado a um histórico.", 409);
  }
}
