import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getPlatformDb } from "@/lib/platform-admin";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return fail("Entre na conta indicada no convite para continuar.", 401);
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  if (!body || typeof body.token !== "string" || body.token.length > 200) return fail("Convite inválido ou expirado.", 400);

  const db = await getPlatformDb();
  const tokenHash = await hashToken(body.token);
  const invitation = await db.prepare(
    `SELECT id, barbershop_id, unit_id, email, expires_at, accepted_at
     FROM tenant_admin_invitations WHERE token_hash=?`,
  ).bind(tokenHash).first<{ id: string; barbershop_id: string; unit_id: string; email: string; expires_at: string; accepted_at: string | null }>();
  if (!invitation || invitation.accepted_at || invitation.expires_at <= new Date().toISOString()) return fail("Convite inválido, expirado ou já utilizado.", 410);
  if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) return fail("Este convite foi enviado para outro e-mail.", 403);

  const now = new Date().toISOString();
  try {
    const results = await db.batch([
      db.prepare(
        `UPDATE tenant_admin_invitations SET accepted_at=?, accepted_by=?
         WHERE id=? AND accepted_at IS NULL AND expires_at>?`,
      ).bind(now, session.user.id, invitation.id, now),
      db.prepare(
        `UPDATE user SET role='ADMIN' WHERE id=? AND EXISTS (
           SELECT 1 FROM tenant_admin_invitations i WHERE i.id=? AND i.accepted_by=? AND i.accepted_at=?
         )`,
      ).bind(session.user.id, invitation.id, session.user.id, now),
      db.prepare(
        `INSERT OR IGNORE INTO users (id, auth_subject, email, display_name)
         SELECT id, id, email, name FROM user WHERE id=?`,
      ).bind(session.user.id),
      db.prepare(
        `INSERT OR IGNORE INTO memberships (id, barbershop_id, unit_id, user_id, role)
         SELECT ?, barbershop_id, unit_id, accepted_by, 'ADMIN' FROM tenant_admin_invitations
         WHERE id=? AND accepted_by=? AND accepted_at=?`,
      ).bind(crypto.randomUUID(), invitation.id, session.user.id, now),
    ]);
    if (!results[0].meta.changes) return fail("O convite já foi utilizado. Solicite um novo ao responsável.", 409);
    const response = NextResponse.json({ ok: true, barbershopId: invitation.barbershop_id });
    response.cookies.set("barberflow_shop", invitation.barbershop_id, {
      httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    console.error("tenant invitation claim failed", error);
    return fail("Não foi possível ativar o acesso. Peça um novo convite ao responsável.", 409);
  }
}
