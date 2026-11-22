import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/entrar");

  const isAdmin = session.user.role === "ADMIN";
  const role = isAdmin ? "Administrador" : "Cliente";
  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-8">
    <header className="flex items-center justify-between border-b border-[var(--border)] pb-5"><a href="/" className="text-lg font-semibold">BARBER <span className="text-[var(--accent)]">BAR</span></a><SignOutButton /></header>
    <section className="py-12"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Área segura</p><h1 className="mt-2 text-3xl font-semibold">Olá, {session.user.name}</h1><p className="mt-2 text-[var(--muted)]">Você entrou como <strong className="text-[var(--foreground)]">{role}</strong>.</p>
      <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-lg font-semibold">{isAdmin ? "Painel do proprietário" : "Área do cliente"}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{isAdmin ? "Seu acesso administrativo está ativo. Cadastros, agenda e gestão financeira serão adicionados nas próximas fases." : "Sua conta de cliente está ativa. Consulta de serviços e agendamento serão adicionados nas próximas fases."}</p></div>
    </section>
  </main>;
}
