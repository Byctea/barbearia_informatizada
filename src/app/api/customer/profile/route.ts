import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getPlatformDb } from "@/lib/platform-admin";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(8).max(24),
});
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function customerSession() {
  const auth = await getAuth();
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await customerSession();
  if (!session) return fail("Entre na sua conta para consultar seus dados.", 401);
  if (session.user.role !== "CLIENT") return fail("Esta área é exclusiva para clientes.", 403);
  const db = await getPlatformDb();
  const user = await db.prepare("SELECT display_name,email,phone FROM users WHERE auth_subject=? AND deleted_at IS NULL")
    .bind(session.user.id).first<{ display_name: string; email: string | null; phone: string | null }>();
  if (!user) return fail("Não foi possível localizar seu cadastro.", 404);
  return NextResponse.json({ profile: { name: user.display_name, email: user.email ?? session.user.email, phone: user.phone ?? "" } });
}

export async function PATCH(request: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return fail("Entre na sua conta para atualizar seus dados.", 401);
  if (session.user.role !== "CLIENT") return fail("Esta área é exclusiva para clientes.", 403);
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.phone.replace(/\D/g, "").length < 8) return fail("Confira nome, e-mail e telefone/WhatsApp.", 400);
  const { name, email, phone } = parsed.data;
  const db = await getPlatformDb();
  const now = new Date().toISOString();
  try {
    const authUser = await db.prepare("SELECT email FROM user WHERE id=? AND role='CLIENT'").bind(session.user.id).first<{ email: string }>();
    if (!authUser) return fail("Cadastro de cliente não encontrado.", 404);
    const results = await db.batch([
      db.prepare(`UPDATE user SET name=?,email=? WHERE id=? AND role='CLIENT'`).bind(name, email.toLowerCase(), session.user.id),
      db.prepare(`UPDATE users SET display_name=?,email=?,phone=? WHERE auth_subject=? AND deleted_at IS NULL`).bind(name, email.toLowerCase(), phone, session.user.id),
      db.prepare(`UPDATE customers SET full_name=?,email=?,phone=?,updated_at=? WHERE user_id=(SELECT id FROM users WHERE auth_subject=?) AND deleted_at IS NULL`).bind(name, email.toLowerCase(), phone, now, session.user.id),
    ]);
    if (!results[0]?.meta.changes) return fail("Cadastro de cliente não encontrado.", 404);
    return NextResponse.json({ ok: true, profile: { name, email: email.toLowerCase(), phone }, message: "Seus dados foram atualizados." });
  } catch (error) {
    console.error("customer profile update failed", error);
    return fail("Não foi possível salvar. Verifique se esse e-mail já está em uso.", 409);
  }
}
