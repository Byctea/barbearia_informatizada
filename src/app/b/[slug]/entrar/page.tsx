import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getPlatformDb } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function TenantLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getPlatformDb();
  const shop = await db.prepare("SELECT name FROM barbershops WHERE slug=? AND is_active=1").bind(slug).first<{ name: string }>();
  if (!shop) notFound();
  return <main className="grid min-h-screen place-items-center px-4 py-10"><section className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl sm:p-9">
    <Link href="/" className="text-sm text-[var(--accent)] hover:underline">← BarberFlow</Link>
    <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Acesso da barbearia</p><h1 className="mt-2 text-3xl font-semibold">{shop.name}</h1><p className="mb-7 mt-2 text-sm leading-6 text-[var(--muted)]">Entre para acessar sua conta e os recursos disponíveis nesta barbearia.</p>
    <AuthForm mode="login" tenantSlug={slug} />
  </section></main>;
}
