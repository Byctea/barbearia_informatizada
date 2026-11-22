import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminRecords } from "@/components/admin-records";
import { getAuth } from "@/lib/auth";
import { getAdminScope } from "@/lib/admin-scope";
import type { AdminResource } from "@/lib/admin-records";
import { AdminOperations, type OperationsView } from "@/components/admin-operations";

export const dynamic = "force-dynamic";
const pages: Record<string, { resource?: AdminResource; operation?: OperationsView; title: string }> = {
  clientes: { resource: "customers", title: "Clientes" },
  servicos: { resource: "services", title: "Serviços" },
  produtos: { resource: "products", title: "Produtos" },
  atendimentos: { operation: "atendimentos", title: "Atendimentos" },
  vendas: { operation: "vendas", title: "Vendas" },
  compras: { operation: "compras", title: "Compras" },
  estoque: { operation: "estoque", title: "Estoque" },
};

export default async function ResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource: slug } = await params;
  const page = pages[slug];
  if (!page) redirect("/dashboard");
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/entrar");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  const scope = await getAdminScope();
  if (page.operation) return <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-8"><header className="flex items-center justify-between border-b border-[var(--border)] pb-5"><a href="/dashboard" className="text-[var(--accent)]">← Painel</a><a href="/" className="font-semibold">BARBER <span className="text-[var(--accent)]">BAR</span></a></header><section className="py-8"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">ADMINISTRAÇÃO</p><h1 className="mt-2 text-3xl font-semibold">{page.title}</h1><p className="mt-2 text-sm text-[var(--muted)]">{page.operation === "atendimentos" ? "Registro e conclusão de serviços realizados." : page.operation === "vendas" ? "Vendas de produtos com baixa automática no estoque." : page.operation === "compras" ? "Entradas de produtos e registro de custos de compra." : "Consulta de saldos e alertas de estoque mínimo."}</p><nav className="mt-5 flex flex-wrap gap-2">{[["Atendimentos", "/dashboard/atendimentos"], ["Vendas", "/dashboard/vendas"], ["Compras", "/dashboard/compras"], ["Estoque", "/dashboard/estoque"]].map(([label, href]) => <a key={href} href={href} className={`rounded-full border px-3 py-2 text-sm ${href === `/dashboard/${slug}` ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)]"}`}>{label}</a>)}</nav>{!scope ? <p className="mt-6 rounded-xl border border-red-800 p-5">Sua conta ainda não está associada a uma unidade administrativa.</p> : <div className="mt-6"><AdminOperations view={page.operation} /></div>}</section></main>;
  if (!page.resource) redirect("/dashboard");
  return <AdminRecords resource={page.resource} title={page.title} hasMembership={Boolean(scope)} />;
}
