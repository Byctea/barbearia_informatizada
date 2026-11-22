import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlatformDb } from "@/lib/platform-admin";
import { TenantInviteForm } from "@/components/tenant-invite-form";

async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length > 200) notFound();
  const db = await getPlatformDb();
  const invitation = await db.prepare(
    `SELECT i.admin_name, i.email, i.expires_at, i.accepted_at, b.name AS barbershop_name
     FROM tenant_admin_invitations i JOIN barbershops b ON b.id=i.barbershop_id
     WHERE i.token_hash=? AND b.is_active=1`,
  ).bind(await hashToken(token)).first<{ admin_name: string; email: string; expires_at: string; accepted_at: string | null; barbershop_name: string }>();
  if (!invitation || invitation.accepted_at || invitation.expires_at <= new Date().toISOString()) notFound();
  return <main className="grid min-h-screen place-items-center px-4 py-10"><section className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl sm:p-9">
    <Link href="/" className="text-sm text-[var(--accent)] hover:underline">← BarberFlow</Link>
    <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Acesso administrativo</p><h1 className="mt-2 text-3xl font-semibold">{invitation.barbershop_name}</h1><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Você foi convidado para administrar esta barbearia. Crie seu acesso ou entre com a conta indicada.</p>
    <TenantInviteForm token={token} name={invitation.admin_name} email={invitation.email} />
  </section></main>;
}
