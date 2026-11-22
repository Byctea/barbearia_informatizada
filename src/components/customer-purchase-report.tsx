"use client";

import { useEffect, useState } from "react";

type Customer = { id: string; full_name: string; phone: string | null; pending_cents: number; paid_cents: number };
type Order = { id: string; status: string; payment_status: "PENDING" | "PAID"; payment_received_at: string | null; total_cents: number; items: string; created_at: string };
type Payload = { customers?: Customer[]; customer?: Customer; orders?: Order[]; error?: string };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const when = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));

export function CustomerPurchaseReport() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    void fetch("/api/admin/reports/customer-orders", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as Payload;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar clientes.");
      setCustomers(result.customers ?? []);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Falha ao carregar clientes."));
  }, []);
  const loadCustomer = async (id: string) => {
    setSelectedId(id); setCustomer(null); setOrders([]); setError("");
    if (!id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/reports/customer-orders?customerId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const result = await response.json() as Payload;
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar este cliente.");
      setCustomer(result.customer ?? null); setOrders(result.orders ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao carregar o relatório."); }
    finally { setLoading(false); }
  };
  const pending = orders.filter((order) => order.payment_status === "PENDING");
  const paid = orders.filter((order) => order.payment_status === "PAID");
  const pendingTotal = pending.reduce((sum, order) => sum + order.total_cents, 0);
  const paidTotal = paid.reduce((sum, order) => sum + order.total_cents, 0);

  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
    <div className="no-print"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--accent)]">CONTAS DE CLIENTES</p><h2 className="mt-2 text-xl font-semibold">Relatório de compras e pagamentos</h2><p className="mt-1 text-sm text-[var(--muted)]">Veja as compras pendentes e pagas de um cliente e imprima ou salve o relatório em PDF.</p>
      <label className="mt-4 block max-w-lg text-sm">Cliente<select value={selectedId} onChange={(event) => void loadCustomer(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"><option value="">Selecione um cliente</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.full_name}{item.phone ? ` · ${item.phone}` : ""}</option>)}</select></label>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      {customer && <button onClick={() => window.print()} disabled={loading} className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-black">Imprimir / salvar em PDF</button>}
    </div>
    {loading && <p className="mt-4 text-sm text-[var(--muted)]">Carregando compras…</p>}
    {customer && <div className="customer-report-print mt-6 rounded-xl border border-[var(--border)] p-5">
      <header className="border-b border-[var(--border)] pb-4"><p className="text-xs uppercase tracking-widest text-[var(--muted)]">Barber Flow · Relatório de compras</p><h3 className="mt-2 text-2xl font-semibold">{customer.full_name}</h3><p className="mt-1 text-sm text-[var(--muted)]">Telefone: {customer.phone || "Não informado"} · Emitido em {when(new Date().toISOString())}</p></header>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-amber-400/30 p-3"><p className="text-sm text-[var(--muted)]">Pendente de pagamento</p><strong className="mt-1 block text-xl">{money(pendingTotal)}</strong></div><div className="rounded-lg border border-emerald-400/30 p-3"><p className="text-sm text-[var(--muted)]">Compras pagas</p><strong className="mt-1 block text-xl">{money(paidTotal)}</strong></div></div>
      <h4 className="mt-6 font-semibold text-amber-200">Pendentes ({pending.length})</h4>
      {pending.length ? <div className="mt-2 space-y-2">{pending.map((order) => <article key={order.id} className="flex justify-between gap-4 border-b border-[var(--border)] py-2 text-sm"><div><p className="font-medium">{order.items}</p><p className="text-[var(--muted)]">{when(order.created_at)} · aguardando pagamento</p></div><strong>{money(order.total_cents)}</strong></article>)}</div> : <p className="mt-2 text-sm text-[var(--muted)]">Sem compras pendentes.</p>}
      <h4 className="mt-6 font-semibold text-emerald-200">Pagas ({paid.length})</h4>
      {paid.length ? <div className="mt-2 space-y-2">{paid.map((order) => <article key={order.id} className="flex justify-between gap-4 border-b border-[var(--border)] py-2 text-sm"><div><p className="font-medium">{order.items}</p><p className="text-[var(--muted)]">{when(order.created_at)} · recebido{order.payment_received_at ? ` em ${when(order.payment_received_at)}` : ""}</p></div><strong>{money(order.total_cents)}</strong></article>)}</div> : <p className="mt-2 text-sm text-[var(--muted)]">Sem compras pagas.</p>}
      <footer className="mt-6 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">Este relatório considera pedidos da loja da unidade selecionada; pedidos cancelados não entram nos totais.</footer>
    </div>}
  </section>;
}
