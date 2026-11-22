import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAuth } from "@/lib/auth";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET(request: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return fail("Entre na sua conta para consultar solicitações.", 401);
  const db = (getCloudflareContext().env as CloudflareEnv).DB;
  const includeMemberships = new URL(request.url).searchParams.get("include") === "memberships";
  const { results } = await db.prepare(
    `SELECT r.id, r.status, r.created_at, b.name AS barbershop_name, b.slug
     FROM customer_membership_requests r JOIN users u ON u.id=r.user_id
     JOIN barbershops b ON b.id=r.barbershop_id WHERE u.auth_subject=?
     ORDER BY r.created_at DESC LIMIT 50`,
  ).bind(session.user.id).all();
  if (!includeMemberships) return NextResponse.json({ requests: results });
  const memberships = await db.prepare(
    `SELECT b.name, b.slug, COALESCE(u.city,b.city) AS city, COALESCE(u.state,b.state) AS state
     FROM memberships m JOIN users u ON u.id=m.user_id JOIN barbershops b ON b.id=m.barbershop_id
     LEFT JOIN units unit ON unit.id=m.unit_id AND unit.barbershop_id=m.barbershop_id
     WHERE u.auth_subject=? AND m.role='CLIENT' AND m.is_active=1 AND b.is_active=1 AND b.slug IS NOT NULL
     GROUP BY b.id ORDER BY b.name COLLATE NOCASE LIMIT 100`,
  ).bind(session.user.id).all();
  return NextResponse.json({ requests: results, memberships: memberships.results });
}

export async function POST(request: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return fail("Entre na sua conta para solicitar vínculo.", 401);
  if (session.user.role !== "CLIENT") return fail("Esta solicitação é exclusiva para contas de cliente.", 403);
  const body = await request.json().catch(() => null) as { slug?: unknown } | null;
  if (typeof body?.slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(body.slug)) return fail("Barbearia inválida.", 400);
  const db = (getCloudflareContext().env as CloudflareEnv).DB;
  const user = await db.prepare("SELECT id FROM users WHERE auth_subject=? AND deleted_at IS NULL").bind(session.user.id).first<{ id: string }>();
  const shop = await db.prepare(
    `SELECT b.id AS barbershop_id, u.id AS unit_id FROM barbershops b
     JOIN units u ON u.barbershop_id=b.id AND u.is_active=1
     WHERE b.slug=? AND b.is_active=1 ORDER BY u.created_at LIMIT 1`,
  ).bind(body.slug).first<{ barbershop_id: string; unit_id: string }>();
  if (!user) return fail("Não foi possível localizar seu perfil. Entre novamente.", 400);
  if (!shop) return fail("Barbearia não encontrada ou sem unidade ativa.", 404);
  const membership = await db.prepare("SELECT id FROM memberships WHERE user_id=? AND barbershop_id=? AND unit_id=? AND role='CLIENT' AND is_active=1")
    .bind(user.id, shop.barbershop_id, shop.unit_id).first<{ id: string }>();
  if (membership) return fail("Você já tem vínculo ativo com esta barbearia.", 409);
  const id = crypto.randomUUID();
  try {
    await db.prepare(
      `INSERT INTO customer_membership_requests (id,user_id,barbershop_id,unit_id)
       VALUES (?,?,?,?) ON CONFLICT(user_id,barbershop_id) DO UPDATE SET
       unit_id=excluded.unit_id,status='PENDING',created_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),reviewed_at=NULL,reviewed_by=NULL`,
    ).bind(id, user.id, shop.barbershop_id, shop.unit_id).run();
    return NextResponse.json({ ok: true, message: "Solicitação enviada. A barbearia analisará seu pedido." }, { status: 201 });
  } catch (error) {
    console.error("customer membership request failed", error);
    return fail("Não foi possível enviar a solicitação.", 500);
  }
}
