import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAuth } from "@/lib/auth";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return fail("Entre na sua conta para continuar.", 401);
  const body = await request.json().catch(() => null) as { slug?: unknown } | null;
  if (typeof body?.slug !== "string" || body.slug.length > 80) return fail("Barbearia inválida.", 400);

  const db = (getCloudflareContext().env as CloudflareEnv).DB;
  const shop = await db.prepare("SELECT id FROM barbershops WHERE slug=? AND is_active=1")
    .bind(body.slug).first<{ id: string }>();
  if (!shop) return fail("Barbearia não encontrada ou inativa.", 404);
  const membership = await db.prepare(
    `SELECT m.barbershop_id FROM memberships m JOIN users u ON u.id=m.user_id
     JOIN units n ON n.id=m.unit_id AND n.barbershop_id=m.barbershop_id AND n.is_active=1
     WHERE u.auth_subject=? AND m.barbershop_id=? AND m.role='ADMIN' AND m.is_active=1
       AND m.unit_id IS NOT NULL LIMIT 1`,
  ).bind(session.user.id, shop.id).first<{ barbershop_id: string }>();

  if (!membership) return NextResponse.json({ ok: true, destination: `/b/${body.slug}/agendar` });
  const response = NextResponse.json({ ok: true, destination: "/dashboard" });
  response.cookies.set("barberflow_shop", shop.id, {
    httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
