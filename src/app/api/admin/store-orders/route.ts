import { NextResponse } from "next/server";
import { getAdminScope } from "@/lib/admin-scope";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET() {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  try {
    const result = await scope.db.prepare(`
      SELECT o.id,o.customer_name_snapshot,o.customer_phone_snapshot,o.status,o.payment_status,o.payment_received_at,o.total_cents,o.notes,o.created_at,
        GROUP_CONCAT(i.product_name_snapshot || ' × ' || i.quantity, ', ') AS items
      FROM store_orders o JOIN store_order_items i ON i.order_id=o.id AND i.unit_id=o.unit_id
      WHERE o.barbershop_id=? AND o.unit_id=?
      GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100
    `).bind(scope.barbershopId, scope.unitId).all();
    return NextResponse.json({ orders: result.results });
  } catch (error) {
    console.error("store orders list error", error);
    return fail("Não foi possível carregar os pedidos da loja.", 500);
  }
}

export async function PATCH(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown; paymentStatus?: unknown } | null;
  if (!body || typeof body.id !== "string") return fail("Pedido inválido.", 400);
  const now = new Date().toISOString();
  try {
    if (body.paymentStatus === "PAID") {
      const results = await scope.db.batch([
        scope.db.prepare(`UPDATE store_orders SET payment_status='PAID',payment_received_at=?,updated_at=? WHERE id=? AND barbershop_id=? AND unit_id=? AND payment_status='PENDING' AND status<>'CANCELLED'`)
          .bind(now, now, body.id, scope.barbershopId, scope.unitId),
        scope.db.prepare(`INSERT INTO finance_entries (id,barbershop_id,unit_id,entry_type,category,description,amount_cents,occurred_on,payment_method,store_order_id,status,notes)
          SELECT ?,?,?, 'INCOME','PRODUCT','Pedido da loja',o.total_cents,date(?,'-3 hours'),'OTHER',o.id,'CONFIRMED',o.customer_name_snapshot
          FROM store_orders o WHERE o.id=? AND o.unit_id=? AND o.payment_status='PAID' AND o.total_cents>0
            AND NOT EXISTS (SELECT 1 FROM finance_entries f WHERE f.store_order_id=o.id)`)
          .bind(crypto.randomUUID(), scope.barbershopId, scope.unitId, now, body.id, scope.unitId),
      ]);
      if (!results[0]?.meta.changes) return fail("O pedido não está pendente de pagamento ou já foi alterado. Atualize a lista.", 409);
      return NextResponse.json({ ok: true });
    }
    if (!["ACCEPTED", "READY", "COMPLETED", "CANCELLED"].includes(String(body.status))) return fail("Situação inválida.", 400);
    const next = body.status as string;
    const allowed: Record<string, string[]> = { ACCEPTED: ["PENDING"], READY: ["ACCEPTED"], COMPLETED: ["READY", "ACCEPTED"], CANCELLED: ["PENDING", "ACCEPTED", "READY"] };
    const prior = allowed[next];
    const wherePayment = next === "COMPLETED" ? " AND payment_status='PAID'" : next === "CANCELLED" ? " AND payment_status='PENDING'" : "";
    const result = await scope.db.prepare(`UPDATE store_orders SET status=?,updated_at=? WHERE id=? AND barbershop_id=? AND unit_id=? AND status IN (${prior.map(() => "?").join(",")})${wherePayment}`)
      .bind(next, now, body.id, scope.barbershopId, scope.unitId, ...prior).run();
    if (!result.meta.changes) return fail(next === "COMPLETED" ? "Marque o pagamento recebido antes de concluir o pedido." : next === "CANCELLED" ? "Pedido com pagamento recebido não pode ser cancelado por esta tela." : "O pedido não foi encontrado ou já mudou de situação. Atualize a lista.", 409);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("store order update error", error);
    return fail("Não foi possível atualizar o pedido.", 500);
  }
}
