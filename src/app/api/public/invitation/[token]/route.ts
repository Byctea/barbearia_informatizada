import { NextResponse } from "next/server";
import { getPlatformDb } from "@/lib/platform-admin";

async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length > 200) return NextResponse.json({ error: "Convite inválido." }, { status: 404 });
  const db = await getPlatformDb();
  const invitation = await db.prepare(
    `SELECT i.admin_name, i.email, i.expires_at, i.accepted_at, b.name AS barbershop_name
     FROM tenant_admin_invitations i JOIN barbershops b ON b.id=i.barbershop_id
     WHERE i.token_hash=? AND b.is_active=1`,
  ).bind(await hashToken(token)).first<{ admin_name: string; email: string; expires_at: string; accepted_at: string | null; barbershop_name: string }>();
  if (!invitation || invitation.accepted_at || invitation.expires_at <= new Date().toISOString()) return NextResponse.json({ error: "Convite inválido, expirado ou já utilizado." }, { status: 404 });
  return NextResponse.json({ invitation: { name: invitation.admin_name, email: invitation.email, barbershopName: invitation.barbershop_name } });
}
