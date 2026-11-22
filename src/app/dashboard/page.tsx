import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { getAuth } from "@/lib/auth";
import { getPlatformAdmin, getPlatformDb } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/entrar");
  if (await getPlatformAdmin()) redirect("/master");
  const selectedShopId = (await cookies()).get("barberflow_shop")?.value ?? null;
  const db = await getPlatformDb();
  const shop = await db.prepare(
    `SELECT b.name FROM memberships m JOIN users u ON u.id=m.user_id JOIN barbershops b ON b.id=m.barbershop_id
     WHERE u.auth_subject=? AND m.is_active=1 AND b.is_active=1 AND (? IS NULL OR b.id=?) ORDER BY m.created_at LIMIT 1`,
  ).bind(session.user.id, selectedShopId, selectedShopId).first<{ name: string }>();
  const isAdmin = session.user.role === "ADMIN";
  const role = isAdmin ? "Administrador" : "Cliente";

  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-8">
    <header className="flex items-center justify-between border-b border-[var(--border)] pb-5"><a href="/" className="text-lg font-semibold">{shop?.name || "BarberFlow"}</a><SignOutButton /></header>
    <section className="py-12"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">ÁREA SEGURA</p><h1 className="mt-2 text-3xl font-semibold">Olá, {session.user.name}</h1><p className="mt-2 text-[var(--muted)]">Você entrou como <strong className="text-[var(--foreground)]">{role}</strong>.</p>
      <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-lg font-semibold">{isAdmin ? "Painel do proprietário" : "Área do cliente"}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{isAdmin ? "Gerencie os cadastros e a agenda da barbearia." : "Acesse seus agendamentos e solicite novos horários."}</p>
      {isAdmin ? <nav className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[["Agenda", "/dashboard/agenda", "Solicitações, conflitos e aprovações"], ["Equipe", "/dashboard/barbeiros", "Cadastre funcionários e parceiros"], ["Clientes", "/dashboard/clientes", "Cadastro e fidelidade"], ["Fidelidade", "/dashboard/fidelidade", "Recompensas e retorno de clientes"], ["Serviços", "/dashboard/servicos", "Preços e duração"], ["Produtos", "/dashboard/produtos", "Cadastro e preços"], ["Atendimentos", "/dashboard/atendimentos", "Serviços realizados e histórico"], ["Vendas", "/dashboard/vendas", "Venda de produtos e pagamentos"], ["Compras", "/dashboard/compras", "Entradas e custos de aquisição"], ["Estoque", "/dashboard/estoque", "Saldos e alertas de estoque mínimo"], ["Financeiro", "/dashboard/financeiro", "Receitas, despesas e fluxo de caixa"], ["Relatórios", "/dashboard/relatorios", "Indicadores e desempenho por período"]].map(([title, href, detail]) => <a key={title} href={href} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 transition hover:border-[var(--accent)]"><strong>{title}</strong><span className="mt-1 block text-sm text-[var(--muted)]">{detail}</span></a>)}</nav> : <a href="/agendar" className="mt-5 inline-flex rounded-lg bg-[var(--accent)] px-4 py-3 font-semibold text-black">Agendar ou consultar meus horários</a>}</div>
    </section>
  </main>;
}
