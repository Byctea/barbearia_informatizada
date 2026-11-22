"use client";

import { useCallback, useEffect, useState } from "react";

type Order = {
  id: string; customer_name_snapshot: string; customer_phone_snapshot: string;
  status: string; payment_status: "PENDING" | "PAID"; payment_received_at: string | null;
  total_cents: number; items: string; notes: string | null; created_at: string;
};
type Result = { orders?: Order[]; error?: string };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const when = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
const labels: Record<string, string> = { PENDING: "Novo", ACCEPTED: "Aceito", READY: "Pronto para retirada", COMPLETED: "Concluído", CANCELLED: "Cancelado" };

export function StoreOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/store-orders", { cache: "no-store" });
    const data = await response.json() as Result;
    if (!response.ok) throw new Error(data.error ?? "Falha ao carregar pedidos.");
    setOrders(data.orders ?? []);
  }, []);
  useEffect(() => {
    void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Falha ao carregar."));
    const timer = window.setInterval(() => { void refresh().catch(() => undefined); }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const update = async (id: string, changes: { status?: string; paymentStatus?: string }) => {
    setMessage("");
    const response = await fetch("/api/admin/store-orders", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...changes }) });
    const data = await response.json() as Result;
    if (!response.ok) { setMessage(data.error ?? "Não foi possível atualizar."); return; }
    setMessage(changes.status === "CANCELLED" ? "Pedido cancelado e estoque devolvido." : changes.paymentStatus === "PAID" ? "Pagamento recebido e registrado no financeiro." : "Pedido atualizado.");
    await refresh();
  };
  const pendingPayment = orders.filter((order) => order.payment_status === "PENDING" && order.status !== "CANCELLED");
  const pendingTotal = pendingPayment.reduce((sum, order) => sum + order.total_cents, 0);

  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-8">
    <header className="border-b border-[var(--border)] pb-5"><a href="/dashboard" className="text-[var(--accent)]">← Painel</a></header>
    <section className="py-8">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-[var(--accent)]">LOJA</p>
      <h1 className="mt-2 text-3xl font-semibold">Pedidos dos clientes</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Acompanhe os pedidos, confirme o recebimento e combine a retirada pelo WhatsApp. A lista atualiza automaticamente.</p>
      {pendingPayment.length > 0 && <aside role="status" className="mt-5 rounded-xl border border-amber-400/40 bg-amber-950/30 p-4"><p className="font-semibold text-amber-100">{pendingPayment.length} pagamento(s) aguardando baixa · {money(pendingTotal)} a receber</p><p className="mt-1 text-sm text-amber-100/80">Confira o recebimento e marque cada pedido como pago. O aviso permanece até a baixa.</p></aside>}
      {message && <p role="status" className="mt-4 rounded-lg border border-[var(--border)] p-3 text-sm">{message}</p>}
      <div className="mt-6 space-y-3">
        {orders.length ? orders.map((order) => <article key={order.id} className={`rounded-xl border bg-[var(--surface)] p-4 ${order.payment_status === "PENDING" && order.status !== "CANCELLED" ? "border-amber-400/40" : "border-[var(--border)]"}`}>
          <div className="flex flex-wrap justify-between gap-3"><div>
            <p className="font-semibold">{order.customer_name_snapshot} <span className="text-xs text-[var(--muted)]">· {when(order.created_at)}</span></p>
            <p className="mt-2 text-sm text-[var(--muted)]">{order.items}</p>
            <p className="mt-2 text-sm">Total: <strong>{money(order.total_cents)}</strong> · Pedido: {labels[order.status] ?? order.status}</p>
            <p className={`mt-1 text-sm font-semibold ${order.payment_status === "PENDING" && order.status !== "CANCELLED" ? "text-amber-200" : "text-emerald-200"}`}>
              {order.status === "CANCELLED" ? "Pedido cancelado" : order.payment_status === "PENDING" ? "Pendente: receber pagamento" : `Pagamento recebido${order.payment_received_at ? ` em ${when(order.payment_received_at)}` : ""}`}
            </p>
            {order.notes && <p className="mt-2 text-sm text-[var(--muted)]">Obs.: {order.notes}</p>}
          </div><div className="flex flex-wrap items-center gap-2">
            <a className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" target="_blank" rel="noreferrer" href={`https://wa.me/55${order.customer_phone_snapshot.replace(/\D/g, "")}`}>WhatsApp</a>
            {order.payment_status === "PENDING" && order.status !== "CANCELLED" && <button onClick={() => void update(order.id, { paymentStatus: "PAID" })} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Dar baixa: recebido</button>}
            {order.status === "PENDING" && <button onClick={() => void update(order.id, { status: "ACCEPTED" })} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-black">Aceitar pedido</button>}
            {order.status === "ACCEPTED" && <button onClick={() => void update(order.id, { status: "READY" })} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-black">Marcar pronto</button>}
            {["READY", "ACCEPTED"].includes(order.status) && <button disabled={order.payment_status !== "PAID"} title={order.payment_status !== "PAID" ? "Registre o pagamento antes de concluir." : undefined} onClick={() => void update(order.id, { status: "COMPLETED" })} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-40">Concluir retirada</button>}
            {["PENDING", "ACCEPTED", "READY"].includes(order.status) && order.payment_status === "PENDING" && <button onClick={() => void update(order.id, { status: "CANCELLED" })} className="rounded-lg border border-red-400/40 px-3 py-2 text-sm text-red-200">Cancelar</button>}
          </div></div>
        </article>) : <p className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">Nenhum pedido da loja ainda.</p>}
      </div>
    </section>
  </main>;
}
