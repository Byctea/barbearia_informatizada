import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CustomerBarbershops } from "@/components/customer-barbershops";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CustomerBarbershopsPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/entrar");
  if (session.user.role !== "CLIENT") redirect("/dashboard");
  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-8"><header className="flex items-center justify-between border-b border-[var(--border)] pb-5"><a href="/dashboard" className="text-[var(--accent)]">← Meu painel</a><a href="/" className="font-semibold">Barber <span className="text-[var(--accent)]">Flow</span></a></header><section className="py-8"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">CLIENTE</p><h1 className="mt-2 text-3xl font-semibold">Barbearias da sua região</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Encontre onde deseja ser atendido e envie uma solicitação para o responsável aprovar.</p><CustomerBarbershops /></section></main>;
}
