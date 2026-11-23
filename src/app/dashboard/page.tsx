import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { StorePaymentAlert } from "@/components/store-payment-alert";
import { CustomerActivityHub } from "@/components/customer-activity-hub";
import { NotificationCenter } from "@/components/notification-center";
import { CustomerProfile } from "@/components/customer-profile";
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
  const isAdmin = session.user.role === "ADMIN";
  const role = isAdmin ? "Administrador" : "Cliente";
  const shops = isAdmin ? [] : (await db.prepare(
    `SELECT b.name,b.slug FROM memberships m JOIN users u ON u.id=m.user_id JOIN barbershops b ON b.id=m.barbershop_id
     WHERE u.auth_subject=? AND m.role='CLIENT' AND m.is_active=1 AND b.is_active=1 AND b.slug IS NOT NULL
     GROUP BY b.id ORDER BY m.created_at`,
  ).bind(session.user.id).all<{ name: string; slug: string }>()).results;
  const shop = shops.find((item) => item.slug === selectedShopId) ?? shops[0] ?? null;
  const modules = [["Pedidos da loja", "/dashboard/pedidos", "Confira pendências de recebimento e atualize pedidos dos clientes"], ["Agenda", "/dashboard/agenda", "Solicitações, conflitos e aprovações"], ["Vínculos de clientes", "/dashboard/vinculos/solicitacoes", "Aprove ou recuse pedidos para entrar na barbearia"], ["Equipe", "/dashboard/barbeiros", "Cadastre funcionários e parceiros"], ["Clientes", "/dashboard/clientes", "Cadastro e fidelidade"], ["Fidelidade", "/dashboard/fidelidade", "Recompensas e retorno de clientes"], ["Serviços", "/dashboard/servicos", "Preços e duração"], ["Produtos", "/dashboard/produtos", "Cadastro e preços"], ["Atendimentos", "/dashboard/atendimentos", "Serviços realizados e histórico"], ["Vendas", "/dashboard/vendas", "Venda de produtos e pagamentos"], ["Compras", "/dashboard/compras", "Entradas e custos de aquisição"], ["Estoque", "/dashboard/estoque", "Saldos e alertas de estoque mínimo"], ["Financeiro", "/dashboard/financeiro", "Receitas, despesas e fluxo de caixa"], ["Relatórios", "/dashboard/relatorios", "Indicadores e desempenho por período"]];

  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-8">
    <header className="flex items-center justify-between border-b border-[var(--border)] pb-5"><a href="/" className="text-lg font-semibold">{shop?.name || "Barber Flow"}</a><SignOutButton /></header>
    <section className="py-12"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">ÁREA SEGURA</p><h1 className="mt-2 text-3xl font-semibold">Olá, {session.user.name}</h1><p className="mt-2 text-[var(--muted)]">Você entrou como <strong className="text-[var(--foreground)]">{role}</strong>.</p>
      <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-lg font-semibold">{isAdmin ? "Painel do proprietário" : "Área do cliente"}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{isAdmin ? "Gerencie os cadastros e a agenda da barbearia." : "Acompanhe aqui seus vínculos, agendamentos, compras e pagamentos."}</p>
        <NotificationCenter />
        {isAdmin ? <><StorePaymentAlert /><nav className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{modules.map(([title, href, detail]) => <a key={title} href={href} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 transition hover:border-[var(--accent)]"><strong>{title}</strong><span className="mt-1 block text-sm text-[var(--muted)]">{detail}</span></a>)}</nav></> : <>
          <CustomerProfile />
          <CustomerActivityHub />
          {shops.length ? <section className="mt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">Minhas barbearias</h3><a href="/dashboard/vinculos" className="text-sm text-[var(--accent)]">Encontrar outra barbearia</a></div><div className="mt-3 grid gap-3 sm:grid-cols-2">{shops.map((item) => <article key={item.slug} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4"><strong>{item.name}</strong><div className="mt-3 flex flex-wrap gap-2"><a href={`/b/${item.slug}/agendar`} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-black">Agendar</a><a href={`/b/${item.slug}/loja`} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Comprar produtos</a></div></article>)}</div></section> : <a href="/dashboard/vinculos" className="mt-5 inline-flex rounded-lg border border-[var(--accent)]/50 px-4 py-3 font-semibold text-[var(--accent-strong)]">Encontrar uma barbearia</a>}
        </>}
      </div>
    </section>
  </main>;
}
