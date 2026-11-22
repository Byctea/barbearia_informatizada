import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminScope } from "@/lib/admin-scope";
import { invitationEmail, sendTransactionalEmail } from "@/lib/email";

const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254) });
async function hash(value: string) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join(""); }
export async function POST(request: Request) {
  const scope = await getAdminScope();
  if (!scope) return NextResponse.json({ error: "Acesso administrativo necessário." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe nome e e-mail válidos." }, { status: 400 });
  const shop = await scope.db.prepare("SELECT name,slug FROM barbershops WHERE id=?").bind(scope.barbershopId).first<{ name: string; slug: string }>();
  if (!shop) return NextResponse.json({ error: "Barbearia não encontrada." }, { status: 404 });
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  const id = crypto.randomUUID();
  const expires = new Date(Date.now() + 72 * 60 * 60_000).toISOString();
  await scope.db.prepare(`INSERT INTO customer_invitations (id,barbershop_id,unit_id,email,customer_name,token_hash,invited_by,expires_at)
    VALUES (?,?,?,?,?,?,?,?)`).bind(id, scope.barbershopId, scope.unitId, parsed.data.email.toLowerCase(), parsed.data.name, await hash(token), scope.userId, expires).run();
  const url = `${new URL(request.url).origin}/convite-cliente/${token}`;
  const delivery = await sendTransactionalEmail(parsed.data.email, `Convite para ${shop.name} | Barber Flow`, invitationEmail(parsed.data.name, url, shop.name));
  return NextResponse.json({ ok: true, emailSent: delivery.sent, invitationUrl: delivery.sent ? undefined : url,
    message: delivery.sent ? `Convite enviado para ${parsed.data.email}.` : `Convite criado; configure o envio de e-mail. Link: ${url}` }, { status: 201 });
}
