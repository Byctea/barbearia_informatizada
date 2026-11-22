import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getPlatformDb } from "@/lib/platform-admin";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return fail("Entre na sua conta para consultar suas atividades.", 401);
  if (session.user.role !== "CLIENT") return fail("Esta consulta está disponível para contas de cliente.", 403);
  const db = await getPlatformDb();
  try {
    const user = await db.prepare("SELECT id FROM users WHERE auth_subject=? AND deleted_at IS NULL").bind(session.user.id).first<{ id: string }>();
    if (!user) return NextResponse.json({ requests: [], appointments: [], purchases: [] });
    const [requests, appointments, purchases, activeShops] = await Promise.all([
      db.prepare(`
        SELECT r.id,r.status,r.created_at,b.name AS barbershop_name,b.slug
        FROM customer_membership_requests r JOIN barbershops b ON b.id=r.barbershop_id
        WHERE r.user_id=? ORDER BY r.created_at DESC LIMIT 100
      `).bind(user.id).all(),
      db.prepare(`
        SELECT a.id,a.starts_at,a.status,a.payment_status,a.price_cents,s.name AS service_name,
          barber.display_name AS barber_name,b.name AS shop_name,b.slug AS shop_slug
        FROM appointments a JOIN customers c ON c.id=a.customer_id AND c.unit_id=a.unit_id
        JOIN services s ON s.id=a.service_id AND s.unit_id=a.unit_id
        JOIN barbers barber ON barber.id=a.barber_id AND barber.unit_id=a.unit_id
        JOIN barbershops b ON b.id=a.barbershop_id JOIN users u ON u.id=c.user_id
        WHERE u.id=? AND c.deleted_at IS NULL
        ORDER BY a.starts_at DESC LIMIT 100
      `).bind(user.id).all(),
      db.prepare(`
        SELECT o.id,o.status,o.payment_status,o.total_cents,o.created_at,b.name AS shop_name,b.slug AS shop_slug,
          GROUP_CONCAT(i.product_name_snapshot || ' × ' || i.quantity, ', ') AS items
        FROM store_orders o JOIN customers c ON c.id=o.customer_id AND c.unit_id=o.unit_id
        JOIN barbershops b ON b.id=o.barbershop_id JOIN users u ON u.id=c.user_id
        JOIN store_order_items i ON i.order_id=o.id AND i.unit_id=o.unit_id
        WHERE u.id=? AND c.deleted_at IS NULL
        GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100
      `).bind(user.id).all(),
      db.prepare(`
        SELECT b.name,b.slug,COALESCE(unit.city,b.city) AS city,COALESCE(unit.state,b.state) AS state
        FROM memberships m JOIN barbershops b ON b.id=m.barbershop_id
        LEFT JOIN units unit ON unit.id=m.unit_id AND unit.barbershop_id=m.barbershop_id
        WHERE m.user_id=? AND m.role='CLIENT' AND m.is_active=1 AND b.is_active=1 AND b.slug IS NOT NULL
        GROUP BY b.id ORDER BY b.name COLLATE NOCASE
      `).bind(user.id).all(),
    ]);
    return NextResponse.json({ requests: requests.results, appointments: appointments.results, purchases: purchases.results, activeShops: activeShops.results });
  } catch (error) {
    console.error("customer activity query failed", error);
    return fail("Não foi possível carregar suas atividades.", 500);
  }
}
