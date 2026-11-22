"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type LinkRequest = { id: string; status: string; created_at: string; barbershop_name: string; slug: string };
type ShopResult = { name: string; slug: string; city: string | null; state: string | null };
type Appointment = { id: string; starts_at: string; status: string; payment_status: string; price_cents: number; service_name: string; barber_name: string; shop_name: string; shop_slug: string };
type Purchase = { id: string; status: string; payment_status: "PENDING" | "PAID"; total_cents: number; items: string; created_at: string; shop_name: string; shop_slug: string };
type ActiveShop = { name: string; slug: string; city: string | null; state: string | null };
type Payload = { requests?: LinkRequest[]; appointments?: Appointment[]; purchases?: Purchase[]; activeShops?: ActiveShop[]; error?: string };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(value));
const linkLabels: Record<string, string> = { PENDING: "Aguardando aprovação", APPROVED: "Vínculo aprovado", REJECTED: "Solicitação recusada" };
const bookingLabels: Record<string, string> = { REQUESTED: "Aguardando análise", AWAITING_PAYMENT: "Aguardando pagamento", CONFIRMED: "Confirmado", CANCELLED: "Cancelado", DECLINED: "Recusado", EXPIRED: "Expirado", COMPLETED: "Concluído", NO_SHOW: "Não compareceu" };
const orderLabels: Record<string, string> = { PENDING: "Aguardando confirmação", ACCEPTED: "Aceito", READY: "Pronto para retirada", COMPLETED: "Retirada concluída", CANCELLED: "Cancelado" };

export function CustomerActivityHub() {
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [activeShops, setActiveShops] = useState<ActiveShop[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [shopSearch, setShopSearch] = useState({ name: "", city: "", state: "" });
  const [phone, setPhone] = useState("");
  const [shopResults, setShopResults] = useState<ShopResult[]>([]);
  const [shopMessage, setShopMessage] = useState("");
  const [shopBusy, setShopBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/customer/activity", { cache: "no-store" });
      const data = await response.json() as Payload;
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar suas atividades.");
      setRequests(data.requests ?? []);
      setActiveShops(data.activeShops ?? []);
      setAppointments(data.appointments ?? []);
      setPurchases(data.purchases ?? []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar suas atividades.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const pendingLinks = requests.filter((item) => item.status === "PENDING");
  const pendingAppointments = appointments.filter((appointment) => ["REQUESTED", "AWAITING_PAYMENT", "CONFIRMED"].includes(appointment.status) && appointment.payment_status !== "PAID");
  const pendingOrders = purchases.filter((order) => order.payment_status === "PENDING" && order.status !== "CANCELLED");
  const pendingOrderTotal = pendingOrders.reduce((sum, order) => sum + order.total_cents, 0);
  const paidOrders = useMemo(() => purchases.filter((order) => order.payment_status === "PAID"), [purchases]);

  const searchShops = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setShopMessage("");
    if (!shopSearch.name.trim() && !shopSearch.city.trim()) { setShopMessage("Informe o nome de uma barbearia ou a cidade."); return; }
    setShopBusy(true); setShopResults([]);
    try {
      const query = new URLSearchParams();
      if (shopSearch.name.trim()) query.set("name", shopSearch.name.trim());
      if (shopSearch.city.trim()) query.set("city", shopSearch.city.trim());
      if (shopSearch.state.trim()) query.set("state", shopSearch.state.trim().toUpperCase());
      const response = await fetch(`/api/public/barbershops?${query}`);
      const data = await response.json() as { barbershops?: ShopResult[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível buscar barbearias.");
      setShopResults(data.barbershops ?? []);
      if (!data.barbershops?.length) setShopMessage("Nenhuma barbearia encontrada com esses filtros.");
    } catch (reason) { setShopMessage(reason instanceof Error ? reason.message : "Falha na busca."); }
    finally { setShopBusy(false); }
  };

  const requestShop = async (slug: string) => {
    setShopBusy(true); setShopMessage("");
    try {
      const response = await fetch("/api/customer/membership-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, phone }) });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível solicitar vínculo.");
      setShopMessage("Pedido enviado. A pendência já está no seu painel e será atualizada após a análise da barbearia.");
      await refresh();
    } catch (reason) { setShopMessage(reason instanceof Error ? reason.message : "Falha ao solicitar vínculo."); }
    finally { setShopBusy(false); }
  };

  return <section className="mt-6 space-y-5">
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--accent)]">CENTRAL DO CLIENTE</p><h2 className="mt-1 text-xl font-semibold">Suas atividades e pendências</h2><p className="mt-1 text-sm text-[var(--muted)]">Solicitações, agendamentos, compras e pagamentos em um só lugar.</p></div><button onClick={() => void refresh()} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Atualizar</button></div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/30 p-3 text-sm text-red-200">{error}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className={`rounded-xl border p-4 ${pendingLinks.length ? "border-amber-400/40" : "border-[var(--border)]"}`}><p className="text-sm text-[var(--muted)]">Vínculos pendentes</p><strong className="mt-1 block text-2xl">{pendingLinks.length}</strong></article>
        <article className={`rounded-xl border p-4 ${pendingAppointments.length ? "border-amber-400/40" : "border-[var(--border)]"}`}><p className="text-sm text-[var(--muted)]">Agendamentos em aberto</p><strong className="mt-1 block text-2xl">{pendingAppointments.length}</strong></article>
        <article className={`rounded-xl border p-4 ${pendingOrders.length ? "border-amber-400/40" : "border-[var(--border)]"}`}><p className="text-sm text-[var(--muted)]">Compras a pagar</p><strong className="mt-1 block text-2xl">{pendingOrders.length}</strong><span className="text-xs text-[var(--muted)]">{money(pendingOrderTotal)}</span></article>
        <article className="rounded-xl border border-[var(--border)] p-4"><p className="text-sm text-[var(--muted)]">Compras pagas</p><strong className="mt-1 block text-2xl">{paidOrders.length}</strong><span className="text-xs text-[var(--muted)]">{money(paidOrders.reduce((sum, order) => sum + order.total_cents, 0))}</span></article>
      </div>
      {loading && <p className="mt-4 text-sm text-[var(--muted)]">Carregando suas atividades…</p>}
    </section>

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Solicitações de vínculo</h3><p className="text-sm text-[var(--muted)]">Pesquise, solicite vínculo e acompanhe a aprovação nesta tela.</p></div></div>
      <label className="mt-4 block max-w-sm text-sm text-[var(--muted)]">Seu telefone / WhatsApp (necessário para cadastro na barbearia)<input required type="tel" minLength={8} maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2.5 text-[var(--foreground)]" /></label>
      <form onSubmit={searchShops} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_90px_auto]"><label className="text-sm text-[var(--muted)]">Nome<input value={shopSearch.name} onChange={(event) => setShopSearch((current) => ({ ...current, name: event.target.value }))} maxLength={100} placeholder="Nome da barbearia" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2.5 text-[var(--foreground)]" /></label><label className="text-sm text-[var(--muted)]">Cidade<input value={shopSearch.city} onChange={(event) => setShopSearch((current) => ({ ...current, city: event.target.value }))} maxLength={100} placeholder="Cidade" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2.5 text-[var(--foreground)]" /></label><label className="text-sm text-[var(--muted)]">UF<input value={shopSearch.state} onChange={(event) => setShopSearch((current) => ({ ...current, state: event.target.value.toUpperCase() }))} minLength={2} maxLength={2} placeholder="BA" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2.5 uppercase text-[var(--foreground)]" /></label><button disabled={shopBusy} className="self-end rounded-lg bg-[var(--accent)] px-4 py-2.5 font-semibold text-black disabled:opacity-50">{shopBusy ? "Aguarde…" : "Buscar"}</button></form>
      {shopMessage && <p role="status" className="mt-3 text-sm text-[var(--muted)]">{shopMessage}</p>}
      {shopResults.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{shopResults.map((shop) => { const current = requests.find((item) => item.slug === shop.slug); const linked = activeShops.some((item) => item.slug === shop.slug); const blocked = linked || current?.status === "PENDING"; return <article key={shop.slug} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3"><div><p className="font-medium">{shop.name}</p><p className="text-xs text-[var(--muted)]">{[shop.city, shop.state].filter(Boolean).join(" / ")}</p>{linked && <p className="mt-1 text-xs text-emerald-200">Vínculo ativo</p>}{current?.status === "PENDING" && <p className="mt-1 text-xs text-amber-200">Vínculo aguardando aprovação</p>}{current?.status === "APPROVED" && !linked && <p className="mt-1 text-xs text-emerald-200">Vínculo aprovado</p>}</div><div className="flex gap-2"><a href={`/b/${shop.slug}/loja`} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Ver loja</a><button type="button" disabled={shopBusy || blocked} onClick={() => void requestShop(shop.slug)} className="rounded-lg border border-[var(--accent)]/40 px-3 py-2 text-sm text-[var(--accent)] disabled:opacity-50">{linked || current?.status === "APPROVED" ? "Já vinculada" : current?.status === "PENDING" ? "Pendente" : current?.status === "REJECTED" ? "Solicitar novamente" : "Solicitar vínculo"}</button></div></article>; })}</div>}
      {requests.length ? <div className="mt-4 space-y-2">{requests.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3"><div><p className="font-medium">{item.barbershop_name}</p><p className="mt-1 text-xs text-[var(--muted)]">Solicitado em {new Date(item.created_at).toLocaleDateString("pt-BR")}</p></div><span className={`rounded-full px-3 py-1 text-xs ${item.status === "PENDING" ? "bg-amber-500/10 text-amber-200" : "bg-white/5 text-[var(--muted)]"}`}>{linkLabels[item.status] ?? item.status}</span></article>)}</div> : <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">Você ainda não enviou solicitações de vínculo.</p>}
    </section>

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h3 className="text-lg font-semibold">Agendamentos e solicitações</h3>
      {appointments.length ? <div className="mt-4 space-y-2">{appointments.map((appointment) => { const active = ["REQUESTED", "AWAITING_PAYMENT", "CONFIRMED"].includes(appointment.status); const paymentLabel = appointment.payment_status === "PAID" ? "Pago" : active ? "Pagamento pendente" : "Pagamento não informado"; return <article key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3"><div><p className="font-medium">{appointment.shop_name} · {appointment.service_name}</p><p className="mt-1 text-sm text-[var(--muted)]">{dateTime(appointment.starts_at)} · {appointment.barber_name}</p></div><div className="text-right"><p className="font-medium">{money(appointment.price_cents)}</p><p className={`text-xs ${appointment.payment_status === "PAID" ? "text-emerald-200" : active ? "text-amber-200" : "text-[var(--muted)]"}`}>{bookingLabels[appointment.status] ?? appointment.status} · {paymentLabel}</p></div><a href={`/b/${appointment.shop_slug}/agendar`} className="text-sm text-[var(--accent)]">Abrir agenda</a></article>; })}</div> : <p className="mt-3 text-sm text-[var(--muted)]">Nenhum agendamento ou solicitação registrado.</p>}
    </section>

    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h3 className="text-lg font-semibold">Compras e pagamentos</h3>
      {purchases.length ? <div className="mt-4 space-y-2">{purchases.map((order) => <article key={order.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${order.payment_status === "PENDING" && order.status !== "CANCELLED" ? "border-amber-400/40" : "border-[var(--border)]"}`}><div><p className="font-medium">{order.shop_name} · {order.items}</p><p className="mt-1 text-sm text-[var(--muted)]">Pedido de {new Date(order.created_at).toLocaleDateString("pt-BR")} · {orderLabels[order.status] ?? order.status}</p></div><div className="text-right"><p className="font-medium">{money(order.total_cents)}</p><p className={`text-xs ${order.payment_status === "PAID" ? "text-emerald-200" : order.status === "CANCELLED" ? "text-[var(--muted)]" : "text-amber-200"}`}>{order.payment_status === "PAID" ? "Pagamento confirmado" : order.status === "CANCELLED" ? "Cancelado" : "Pendente de pagamento"}</p></div><a href={`/b/${order.shop_slug}/loja`} className="text-sm text-[var(--accent)]">Abrir loja</a></article>)}</div> : <p className="mt-3 text-sm text-[var(--muted)]">Nenhuma compra registrada.</p>}
    </section>
  </section>;
}
