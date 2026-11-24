"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Product = { id: string; name: string; category: string; image_url: string | null; sale_price_cents: number; stock_quantity: number };
type Order = { id: string; status: string; payment_status: "PENDING" | "PAID"; payment_received_at: string | null; total_cents: number; items: string; created_at: string };
type Result = { data?: Product[]; orders?: Order[]; unit?: { name: string; barbershopName?: string; phone: string | null }; error?: string; message?: string; totalCents?: number };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const statuses: Record<string, string> = { PENDING: "Aguardando confirmação da barbearia", ACCEPTED: "Pedido aceito", READY: "Pronto para retirada", COMPLETED: "Retirada concluída", CANCELLED: "Cancelado" };
const when = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));

export function ClientStore({ customerName, shopSlug }: { customerName: string; shopSlug: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [unit, setUnit] = useState<{ name: string; barbershopName?: string; phone: string | null } | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const query = `?shop=${encodeURIComponent(shopSlug)}`;
  const refresh = useCallback(async () => {
    const [storeRes, ordersRes] = await Promise.all([fetch(`/api/store/products${query}`, { cache: "no-store" }), fetch(`/api/store-orders${query}`, { cache: "no-store" })]);
    const store = await storeRes.json() as Result;
    if (!storeRes.ok) throw new Error(store.error ?? "Falha ao carregar a loja.");
    setProducts(store.data ?? []); setUnit(store.unit ?? null);
    if (ordersRes.ok) { const mine = await ordersRes.json() as Result; setOrders(mine.orders ?? []); }
  }, [query]);
  useEffect(() => {
    void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Falha ao carregar loja."));
    const timer = window.setInterval(() => { void refresh().catch(() => undefined); }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const total = useMemo(() => products.reduce((sum, product) => sum + product.sale_price_cents * (cart[product.id] ?? 0), 0), [products, cart]);
  const pendingOrders = orders.filter((order) => order.payment_status === "PENDING" && order.status !== "CANCELLED");
  const paidOrders = orders.filter((order) => order.payment_status === "PAID");
  const pendingTotal = pendingOrders.reduce((sum, order) => sum + order.total_cents, 0);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/appointments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "store-order", barbershopSlug: shopSlug, items: Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId, quantity })), customerName, phone, notes }) });
      const data = await response.json() as Result;
      if (!response.ok) throw new Error(data.error ?? "Não foi possível enviar o pedido.");
      setCart({}); setNotes(""); setMessage(data.message ?? "Pedido enviado."); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao enviar pedido."); }
    finally { setBusy(false); }
  };
  const whatsapp = unit?.phone ? `https://wa.me/55${unit.phone.replace(/\D/g, "")}` : "";

  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-8">
    <header className="flex items-center justify-between border-b border-[var(--border)] pb-5"><a href={`/b/${shopSlug}/agendar`} className="text-[var(--accent)]">← Agendamentos</a><a href="/dashboard" className="text-sm">Minha conta</a></header>
    <section className="py-8">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-[var(--accent)]">LOJA DA BARBEARIA</p>
      <h1 className="mt-2 text-3xl font-semibold">{unit?.barbershopName ?? unit?.name ?? "Barbearia"}</h1>
      {unit?.barbershopName && unit.name !== unit.barbershopName && <p className="mt-1 text-sm text-[var(--muted)]">Unidade: {unit.name}</p>}
      <p className="mt-2 text-sm text-[var(--muted)]">Escolha seus produtos, monte o carrinho e envie o pedido. A barbearia confirma o pagamento e a retirada pelo WhatsApp.</p>
      {pendingOrders.length > 0 && <aside role="status" className="mt-5 rounded-xl border border-amber-400/40 bg-amber-950/30 p-4"><p className="font-semibold text-amber-100">Você tem {pendingOrders.length} compra(s) pendente(s) de pagamento · {money(pendingTotal)}</p><p className="mt-1 text-sm text-amber-100/80">Combine o pagamento com a barbearia. Esta pendência será atualizada quando o barbeiro confirmar o recebimento.</p></aside>}
      {message && <p role="status" className="mt-4 rounded-lg border border-[var(--border)] p-3 text-sm">{message}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Produtos disponíveis</h2><p className="mt-1 text-sm text-[var(--muted)]">Itens cadastrados pela sua barbearia.</p></div><span className="text-sm text-[var(--muted)]">{products.length} produto(s)</span></div>
          {products.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-48 w-full object-cover" loading="lazy" /> : <div className="grid h-40 place-items-center bg-[var(--surface-raised)] text-5xl text-[var(--accent)]" aria-hidden="true">✂</div>}<div className="p-4"><p className="text-xs uppercase tracking-wide text-[var(--accent)]">{product.category}</p><h3 className="mt-1 font-semibold">{product.name}</h3><p className="mt-2 text-lg font-semibold">{money(product.sale_price_cents)}</p><p className="mt-1 text-xs text-[var(--muted)]">{product.stock_quantity} disponível(is)</p><div className="mt-3 flex items-center gap-2"><button type="button" onClick={() => setCart((current) => ({ ...current, [product.id]: Math.max(0, (current[product.id] ?? 0) - 1) }))} className="rounded-lg border border-[var(--border)] px-3 py-2" aria-label={`Remover ${product.name}`}>−</button><span className="min-w-6 text-center">{cart[product.id] ?? 0}</span><button type="button" disabled={(cart[product.id] ?? 0) >= product.stock_quantity} onClick={() => setCart((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }))} className="rounded-lg border border-[var(--border)] px-3 py-2 disabled:opacity-40" aria-label={`Adicionar ${product.name}`}>+</button></div></div></article>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] p-8 text-sm text-[var(--muted)]">Nenhum produto disponível para compra agora.</p>}
        </section>
        <aside><form onSubmit={submit} className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--surface)] p-5 lg:sticky lg:top-5"><h2 className="text-xl font-semibold">Seu carrinho</h2><ul className="mt-4 space-y-2 text-sm">{products.filter((product) => (cart[product.id] ?? 0) > 0).map((product) => <li key={product.id} className="flex justify-between gap-3"><span>{product.name} × {cart[product.id]}</span><span>{money(product.sale_price_cents * (cart[product.id] ?? 0))}</span></li>)}</ul><p className="mt-4 border-t border-[var(--border)] pt-4 font-semibold">Total: {money(total)}</p><label className="mt-4 block text-sm">Telefone / WhatsApp<input required type="tel" minLength={8} maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3" /></label><label className="mt-3 block text-sm">Observações<input maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3" /></label><button disabled={busy || total <= 0} className="mt-4 w-full rounded-lg bg-[var(--accent)] px-4 py-3 font-semibold text-black disabled:opacity-50">{busy ? "Enviando pedido…" : "Fazer pedido"}</button><p className="mt-3 text-xs text-[var(--muted)]">O pedido fica pendente até a barbearia confirmar. O estoque é reservado ao enviar; se a loja cancelar, as unidades voltam ao estoque.</p>{whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="mt-3 block text-center text-sm text-[var(--accent)]">Falar com a barbearia</a>}</form></aside>
      </div>
      <section className="mt-10"><h2 className="text-2xl font-semibold">Minhas compras</h2>
        <h3 className="mt-5 font-semibold text-amber-200">Pendentes de pagamento ({pendingOrders.length})</h3>
        {pendingOrders.length ? <div className="mt-3 space-y-3">{pendingOrders.map((order) => <article key={order.id} className="rounded-xl border border-amber-400/30 bg-[var(--surface)] p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{order.items}</p><p className="mt-1 text-sm text-[var(--muted)]">{when(order.created_at)} · {statuses[order.status] ?? order.status}</p></div><div className="text-right"><p className="font-semibold">{money(order.total_cents)}</p><p className="mt-1 text-sm text-amber-200">Aguardando pagamento</p></div></div></article>)}</div> : <p className="mt-2 text-sm text-[var(--muted)]">Nenhuma compra aguardando pagamento.</p>}
        <h3 className="mt-7 font-semibold text-emerald-200">Pagas ({paidOrders.length})</h3>
        {paidOrders.length ? <div className="mt-3 space-y-3">{paidOrders.map((order) => <article key={order.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{order.items}</p><p className="mt-1 text-sm text-[var(--muted)]">{when(order.created_at)} · {statuses[order.status] ?? order.status}</p></div><div className="text-right"><p className="font-semibold">{money(order.total_cents)}</p><p className="mt-1 text-sm text-emerald-200">Pago{order.payment_received_at ? ` em ${when(order.payment_received_at)}` : ""}</p></div></div></article>)}</div> : <p className="mt-2 text-sm text-[var(--muted)]">Suas compras pagas aparecerão aqui.</p>}
      </section>
    </section>
  </main>;
}
