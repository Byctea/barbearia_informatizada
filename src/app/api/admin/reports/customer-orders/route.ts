import { NextResponse } from "next/server";
import { getAdminScope } from "@/lib/admin-scope";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return fail("Acesso administrativo necessário.", 403);
  const customerId = new URL(request.url).searchParams.get("customerId");
  try {
    if (!customerId) {
      const result = await scope.db.prepare(`
        SELECT c.id,c.full_name,c.phone,
          COALESCE(SUM(CASE WHEN o.payment_status='PENDING' AND o.status<>'CANCELLED' THEN o.total_cents ELSE 0 END),0) AS pending_cents,
          COALESCE(SUM(CASE WHEN o.payment_status='PAID' THEN o.total_cents ELSE 0 END),0) AS paid_cents
        FROM customers c LEFT JOIN store_orders o ON o.customer_id=c.id AND o.unit_id=c.unit_id
        WHERE c.barbershop_id=? AND c.unit_id=? AND c.deleted_at IS NULL
        GROUP BY c.id ORDER BY c.full_name COLLATE NOCASE
      `).bind(scope.barbershopId, scope.unitId).all();
      return NextResponse.json({ customers: result.results });
    }
    const customer = await scope.db.prepare(`SELECT id,full_name,phone FROM customers WHERE id=? AND barbershop_id=? AND unit_id=? AND deleted_at IS NULL`)
      .bind(customerId, scope.barbershopId, scope.unitId).first<{ id: string; full_name: string; phone: string | null }>();
    if (!customer) return fail("Cliente não encontrado nesta unidade.", 404);
    const result = await scope.db.prepare(`
      SELECT o.id,o.status,o.payment_status,o.payment_received_at,o.total_cents,o.created_at,
        GROUP_CONCAT(i.product_name_snapshot || ' × ' || i.quantity, ', ') AS items
      FROM store_orders o JOIN store_order_items i ON i.order_id=o.id AND i.unit_id=o.unit_id
      WHERE o.customer_id=? AND o.barbershop_id=? AND o.unit_id=? AND o.status<>'CANCELLED'
      GROUP BY o.id ORDER BY o.created_at DESC
    `).bind(customerId, scope.barbershopId, scope.unitId).all();
    return NextResponse.json({ customer, orders: result.results });
  } catch (error) {
    console.error("customer orders report error", error);
    return fail("Não foi possível montar o relatório do cliente.", 500);
  }
}
