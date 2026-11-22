import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformAdmin } from "@/lib/platform-admin";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  unitName: z.string().trim().min(2).max(120).default("Unidade principal"),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().email().max(254),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
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
            u.name AS unit_name,
            (SELECT COUNT(*) FROM memberships m WHERE m.barbershop_id=b.id AND m.role='ADMIN' AND m.is_active=1) AS admin_count
     FROM barbershops b LEFT JOIN units u ON u.barbershop_id=b.id
     ORDER BY b.created_at DESC LIMIT 200`,
  ).all();
  return NextResponse.json({ barbershops: results });
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
    return NextResponse.json({
      barbershop: { id, name, slug, unitName, adminName, adminEmail },
      invitationUrl: `${baseUrl}/convite/${token}`,
      expiresAt,
    }, { status: 201 });
  } catch (error) {
    console.error("master tenant creation failed", error);
    return jsonError("Não foi possível criar a barbearia. Verifique se ela já existe e tente novamente.", 409);
  }
}
