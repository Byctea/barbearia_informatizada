import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { invitationEmail, sendTransactionalEmail } from "@/lib/email";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  unitName: z.string().trim().min(2).max(120).default("Unidade principal"),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().email().max(254),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
});
const editSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(2).max(120),
  unitName: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  isActive: z.boolean(),
});
const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status });
const slugify = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const newId = () => crypto.randomUUID();

async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function GET() {
  const master = await getPlatformAdmin();
  if (!master) return jsonError("Acesso master necessário.", 403);
  const { results } = await master.db.prepare(
    `SELECT b.id, b.name, b.slug, b.is_active, b.created_at,
            u.id AS unit_id, u.name AS unit_name, COALESCE(u.city,b.city) AS city, COALESCE(u.state,b.state) AS state,
            (SELECT COUNT(*) FROM memberships m WHERE m.barbershop_id=b.id AND m.role='ADMIN' AND m.is_active=1) AS admin_count
     FROM barbershops b LEFT JOIN units u ON u.id=(SELECT unit.id FROM units unit WHERE unit.barbershop_id=b.id ORDER BY unit.created_at LIMIT 1)
     ORDER BY b.created_at DESC LIMIT 200`,
  ).all();
  return NextResponse.json({ barbershops: results });
}

export async function PATCH(request: Request) {
  const master = await getPlatformAdmin();
  if (!master) return jsonError("Acesso master necessário.", 403);
  const parsed = editSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Confira nome, unidade, cidade, UF e status.", 400);
  const { id, name, unitName, city, state, isActive } = parsed.data;
  const now = new Date().toISOString();
  try {
    const shop = await master.db.prepare("SELECT id FROM barbershops WHERE id=?").bind(id).first<{ id: string }>();
    if (!shop) return jsonError("Barbearia não encontrada.", 404);
    const unit = await master.db.prepare("SELECT id FROM units WHERE barbershop_id=? ORDER BY created_at LIMIT 1").bind(id).first<{ id: string }>();
    await master.db.batch([
      master.db.prepare("UPDATE barbershops SET name=?,city=?,state=?,is_active=?,updated_at=? WHERE id=?").bind(name, city, state, isActive ? 1 : 0, now, id),
      ...(unit ? [master.db.prepare("UPDATE units SET name=?,city=?,state=? WHERE id=? AND barbershop_id=?").bind(unitName, city, state, unit.id, id)] : []),
    ]);
    return NextResponse.json({ ok: true, message: "Cadastro atualizado." });
  } catch (error) {
    console.error("master tenant update failed", error);
    return jsonError("Não foi possível atualizar a barbearia.", 500);
  }
}

export async function DELETE(request: Request) {
  const master = await getPlatformAdmin();
  if (!master) return jsonError("Acesso master necessário.", 403);
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  if (typeof body?.id !== "string" || !body.id) return jsonError("Barbearia inválida.", 400);
  const id = body.id;
  const dataExists = `
    EXISTS (SELECT 1 FROM barbers WHERE barbershop_id=barbershops.id) OR
    EXISTS (SELECT 1 FROM customers WHERE barbershop_id=barbershops.id) OR
    EXISTS (SELECT 1 FROM services WHERE barbershop_id=barbershops.id) OR
    EXISTS (SELECT 1 FROM products WHERE barbershop_id=barbershops.id) OR
    EXISTS (SELECT 1 FROM appointments WHERE barbershop_id=barbershops.id) OR
    EXISTS (SELECT 1 FROM visits WHERE barbershop_id=barbershops.id) OR
    EXISTS (SELECT 1 FROM sales WHERE barbershop_id=barbershops.id) OR
    EXISTS (SELECT 1 FROM stock_movements WHERE barbershop_id=barbershops.id) OR
    EXISTS (SELECT 1 FROM finance_entries WHERE barbershop_id=barbershops.id) OR
    EXISTS (SELECT 1 FROM loyalty_programs WHERE barbershop_id=barbershops.id) OR
    EXISTS (SELECT 1 FROM store_orders WHERE barbershop_id=barbershops.id) OR
    EXISTS (SELECT 1 FROM customer_membership_requests WHERE barbershop_id=barbershops.id) OR
    EXISTS (SELECT 1 FROM memberships WHERE barbershop_id=barbershops.id AND role='CLIENT')`;
  try {
    const found = await master.db.prepare("SELECT id FROM barbershops WHERE id=?").bind(id).first<{ id: string }>();
    if (!found) return jsonError("Barbearia não encontrada.", 404);
    const deleted = await master.db.prepare(`DELETE FROM barbershops WHERE id=? AND NOT (${dataExists})`).bind(id).run();
    if (deleted.meta.changes) return NextResponse.json({ ok: true, deleted: true, message: "Barbearia excluída." });
    const now = new Date().toISOString();
    await master.db.prepare("UPDATE barbershops SET is_active=0,updated_at=? WHERE id=?").bind(now, id).run();
    return NextResponse.json({ ok: true, deleted: false, message: "Esta barbearia já possui cadastros ou histórico. Ela foi desativada para preservar os dados e pode ser reativada pela edição." });
  } catch (error) {
    console.error("master tenant delete failed", error);
    return jsonError("Não foi possível excluir a barbearia. Se ela tiver histórico, desative-a para preservar os dados.", 409);
  }
}

export async function POST(request: Request) {
  const master = await getPlatformAdmin();
  if (!master) return jsonError("Acesso master necessário.", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Confira nome, unidade e e-mail do administrador.", 400);

  const { name, unitName, adminName, adminEmail, city, state } = parsed.data;
  const slugBase = slugify(name);
  if (!slugBase) return jsonError("O nome precisa ter letras ou números para gerar o endereço.", 400);
  const id = newId();
  const unitId = newId();
  const inviteId = newId();
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const tokenHash = await hashToken(token);
  const slug = `${slugBase}-${id.slice(0, 6)}`;
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  try {
    await master.db.batch([
      master.db.prepare("INSERT INTO barbershops (id, name, slug, city, state) VALUES (?, ?, ?, ?, ?)").bind(id, name, slug, city, state),
      master.db.prepare("INSERT INTO units (id, barbershop_id, name, city, state) VALUES (?, ?, ?, ?, ?)").bind(unitId, id, unitName, city, state),
      master.db.prepare(
        `INSERT INTO tenant_admin_invitations (id, barbershop_id, unit_id, admin_name, email, token_hash, invited_by, expires_at)
         VALUES (?, ?, ?, ?, lower(?), ?, ?, ?)`,
      ).bind(inviteId, id, unitId, adminName, adminEmail, tokenHash, master.userId, expiresAt),
    ]);
    const baseUrl = new URL(request.url).origin;
    const invitationUrl = `${baseUrl}/convite/${token}`;
    const emailResult = await sendTransactionalEmail(adminEmail, `Convite para administrar ${name} | Barber Flow`, invitationEmail(adminName, invitationUrl, name));
    return NextResponse.json({
      barbershop: { id, name, slug, unitName, adminName, adminEmail },
      invitationUrl,
      emailSent: emailResult.sent,
      emailNotice: emailResult.sent ? "Convite enviado por e-mail." : "Convite criado, mas o e-mail não foi enviado: configure RESEND_API_KEY e EMAIL_FROM no Worker.",
      expiresAt,
    }, { status: 201 });
  } catch (error) {
    console.error("master tenant creation failed", error);
    return jsonError("Não foi possível criar a barbearia. Verifique se ela já existe e tente novamente.", 409);
  }
}
