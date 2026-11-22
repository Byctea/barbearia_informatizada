import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminOperations } from "@/components/admin-operations";
import { getAdminScope } from "@/lib/admin-scope";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/entrar");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  const scope = await getAdminScope();
  if (!scope) return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8"><a href="/dashboard">← Painel</a><p className="mt-6 rounded-xl border border-red-800 p-5">Sua conta ainda não está associada a uma unidade administrativa.</p></main>;
  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-8"><header className="flex items-center justify-between border-b border-[var(--border)] pb-5"><a href="/dashboard" className="text-[var(--accent)]">← Painel</a><a href="/" className="font-semibold">BARBER <span className="text-[var(--accent)]">BAR</span></a></header><section className="py-8"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">ADMINISTRAÇÃO</p><h1 className="mt-2 text-3xl font-semibold">Atendimentos, vendas e estoque</h1><p className="mt-2 text-sm text-[var(--muted)]">Registre o que aconteceu no balcão; preços e estoque são validados no servidor.</p><div className="mt-6"><AdminOperations /></div></section></main>;
}
