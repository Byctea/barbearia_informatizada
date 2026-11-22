import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getPlatformDb } from "@/lib/platform-admin";
async function hash(value: string) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join(""); }
export async function POST(request: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Entre na conta criada para este convite." }, { status: 401 });
  const body = await request.json().catch(() => null) as { token?: unknown; phone?: unknown } | null;
  if (typeof body?.token !== "string" || typeof body.phone !== "string" || body.phone.replace(/\D/g, "").length < 8 || body.phone.length > 24)
    return NextResponse.json({ error: "Informe um convite e telefone/WhatsApp válidos." }, { status: 400 });
  const db = await getPlatformDb();
  const invite = await db.prepare(`SELECT id,barbershop_id,unit_id,email,customer_name FROM customer_invitations WHERE token_hash=? AND accepted_at IS NULL AND expires_at>?`)
    .bind(await hash(body.token), new Date().toISOString()).first<{ id: string; barbershop_id: string; unit_id: string; email: string; customer_name: string }>();
  if (!invite) return NextResponse.json({ error: "Convite inválido, expirado ou já utilizado." }, { status: 410 });
  if (session.user.email.toLowerCase() !== invite.email.toLowerCase()) return NextResponse.json({ error: "Use a conta do e-mail que recebeu o convite." }, { status: 403 });
  const now = new Date().toISOString();
  const user = await db.prepare("SELECT id FROM users WHERE auth_subject=? AND deleted_at IS NULL").bind(session.user.id).first<{ id: string }>();
  if (!user) return NextResponse.json({ error: "Cadastro do usuário ainda não está disponível; entre novamente e tente outra vez." }, { status: 409 });
  try {
    const results = await db.batch([
      db.prepare("UPDATE customer_invitations SET accepted_at=? WHERE id=? AND accepted_at IS NULL AND expires_at>?").bind(now, invite.id, now),
      db.prepare("UPDATE users SET phone=? WHERE id=?").bind(body.phone.trim(), user.id),
      db.prepare(`INSERT INTO memberships (id,barbershop_id,unit_id,user_id,role,is_active) VALUES (?,?,?,?,'CLIENT',1)
        ON CONFLICT(barbershop_id,user_id,unit_id) DO UPDATE SET role='CLIENT',is_active=1`).bind(crypto.randomUUID(), invite.barbershop_id, invite.unit_id, user.id),
      db.prepare(`UPDATE customers SET full_name=?,phone=?,email=?,updated_at=? WHERE user_id=? AND barbershop_id=? AND unit_id=? AND deleted_at IS NULL`)
        .bind(session.user.name || invite.customer_name, body.phone.trim(), session.user.email, now, user.id, invite.barbershop_id, invite.unit_id),
      db.prepare(`INSERT INTO customers (id,barbershop_id,unit_id,user_id,full_name,phone,email,created_at,updated_at)
        SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM customers WHERE user_id=? AND barbershop_id=? AND unit_id=? AND deleted_at IS NULL)`)
        .bind(crypto.randomUUID(), invite.barbershop_id, invite.unit_id, user.id, session.user.name || invite.customer_name, body.phone.trim(), session.user.email, now, now, user.id, invite.barbershop_id, invite.unit_id),
    ]);
    if (!results[0]?.meta.changes) return NextResponse.json({ error: "Convite já utilizado." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("customer invitation claim failed", error);
    return NextResponse.json({ error: "Não foi possível ativar o vínculo." }, { status: 409 });
  }
}
