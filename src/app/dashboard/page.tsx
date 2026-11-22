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
    <section className="py-12"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">ÁREA SEGURA</p><h1 className="mt-2 text-3xl font-semibold">Olá, {session.user.name}</h1><p className="mt-2 text-[var(--muted)]">Você entrou como <strong className="text-[var(--foreground)]">{role}</strong>.</p>
      <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-lg font-semibold">{isAdmin ? "Painel do proprietário" : "Área do cliente"}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{isAdmin ? "Gerencie os cadastros e a agenda da barbearia." : "Acesse seus agendamentos e solicite novos horários."}</p>
      {isAdmin ? <nav className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[["Agenda", "/dashboard/agenda", "Expediente e solicitações"], ["Clientes", "/dashboard/clientes", "Cadastro e fidelidade"], ["Serviços", "/dashboard/servicos", "Preços e duração"], ["Produtos", "/dashboard/produtos", "Preços e estoque"], ["Atendimentos e vendas", "/dashboard/operacoes", "Serviços concluídos, vendas e compras"], ["Estoque", "/dashboard/operacoes", "Entradas e alertas de mínimo"]].map(([title, href, detail]) => <a key={title} href={href} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 transition hover:border-[var(--accent)]"><strong>{title}</strong><span className="mt-1 block text-sm text-[var(--muted)]">{detail}</span></a>)}</nav> : <a href="/agendar" className="mt-5 inline-flex rounded-lg bg-[var(--accent)] px-4 py-3 font-semibold text-black">Agendar ou consultar meus horários</a>}</div>
    </section>
  </main>;
}
