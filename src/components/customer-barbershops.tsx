"use client";

import { useEffect, useState } from "react";

type Shop = { name: string; slug: string; city: string | null; state: string | null };
type RequestItem = { id: string; status: string; created_at: string; barbershop_name: string; slug: string };
type CustomerData = { requests?: RequestItem[]; memberships?: Shop[] };

export function CustomerBarbershops() {
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [shops, setShops] = useState<Shop[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [memberships, setMemberships] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [name, setName] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadRequests() {
    const response = await fetch("/api/customer/membership-requests?include=memberships", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json() as CustomerData;
      setRequests(data.requests ?? []);
      setMemberships(data.memberships ?? []);
    }
  }

  useEffect(() => { void loadRequests(); }, []);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (!city.trim() && !name.trim()) { setMessage("Informe uma cidade ou o nome da barbearia."); return; }
    setBusy(true); setShops([]);
    try {
      const query = new URLSearchParams();
      if (city.trim()) query.set("city", city.trim());
      if (state.trim()) query.set("state", state.trim().toUpperCase());
      if (name.trim()) query.set("name", name.trim());
      const response = await fetch(`/api/public/barbershops?${query}`);
      const data = await response.json() as { barbershops?: Shop[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível buscar barbearias.");
      setShops(data.barbershops ?? []);
      setSelectedShop(null);
      if (!data.barbershops?.length) setMessage("Não encontramos barbearias cadastradas nessa região. Você pode tentar outra cidade ou estado.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha na busca."); }
    finally { setBusy(false); }
  }

  async function requestMembership(slug: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/customer/membership-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível solicitar vínculo.");
      setMessage(data.message || "Solicitação enviada para análise.");
      await loadRequests();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao enviar solicitação."); }
    finally { setBusy(false); }
  }

  const statusLabels: Record<string, string> = { PENDING: "Aguardando análise", APPROVED: "Vínculo aprovado", REJECTED: "Solicitação recusada" };

  const linkedShops = memberships;
  return <div className="mt-6 grid gap-6 lg:grid-cols-2">
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <h2 className="text-xl font-semibold">{linkedShops.length ? "Suas barbearias" : "Encontre uma barbearia"}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{linkedShops.length ? "Acesse a barbearia onde você já tem vínculo ou encontre outra." : "Busque por nome ou região. Para se cadastrar, solicite aprovação da barbearia."}</p>
      {linkedShops.length > 0 && <div className="mt-4 space-y-3">{linkedShops.map((shop) => <article key={shop.slug} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-4"><div><h3 className="font-semibold">{shop.name}</h3><p className="text-sm text-[var(--muted)]">{[shop.city, shop.state].filter(Boolean).join(" / ")}</p></div><a href={`/b/${shop.slug}/agendar`} className="rounded-lg bg-[var(--accent)] px-4 py-3 font-semibold text-black">Ver horários e agendar</a></article>)}</div>}
      {(!linkedShops.length || showSearch) && <>
      <form onSubmit={search} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-[var(--muted)]">Nome da barbearia<input maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Barber Flow" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-3 text-[var(--foreground)]" /></label>
        <label className="text-sm text-[var(--muted)]">Cidade<input maxLength={100} value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ex.: Salvador" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-3 text-[var(--foreground)]" /></label>
        <label className="text-sm text-[var(--muted)]">Estado (opcional)<input minLength={2} maxLength={2} value={state} onChange={(event) => setState(event.target.value.toUpperCase())} placeholder="BA" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-3 text-[var(--foreground)]" /></label>
        <button disabled={busy} className="self-end rounded-lg bg-[var(--accent)] px-4 py-3 font-semibold text-black disabled:opacity-50">Buscar</button>
      </form>
      </>}
      {linkedShops.length > 0 && !showSearch && <button type="button" onClick={() => { setShowSearch(true); setMessage(""); }} className="mt-4 rounded-lg border border-[var(--accent)]/50 px-4 py-3 font-semibold text-[var(--accent-strong)]">Encontrar outra barbearia</button>}
      {message && <p role="status" className="mt-4 rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--muted)]">{message}{message.toLowerCase().includes("enviada") && <a href="/dashboard" className="ml-2 text-[var(--accent)] underline">Acompanhar no painel do cliente</a>}</p>}
      <div className="mt-4 space-y-3">{shops.map((shop) => {
        const request = requests.find((item) => item.slug === shop.slug && item.status === "PENDING");
        const selected = selectedShop?.slug === shop.slug;
        return <article key={shop.slug} className={`rounded-xl border p-4 ${selected ? "border-[var(--accent)]/70 bg-[var(--accent)]/5" : "border-[var(--border)]"}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{shop.name}</h3><p className="text-sm text-[var(--muted)]">{[shop.city, shop.state].filter(Boolean).join(" / ")}</p></div><button type="button" onClick={() => setSelectedShop(selected ? null : shop)} className="rounded-lg border border-[var(--accent)]/50 px-3 py-2 text-sm text-[var(--accent-strong)]">{selected ? "Fechar" : "Escolher barbearia"}</button></div>{selected && <div className="mt-4 border-t border-[var(--border)] pt-4"><p className="text-sm text-[var(--muted)]">Barbearia selecionada. Agora você pode escolher o serviço e o horário.</p><a href={`/b/${shop.slug}/agendar`} className="mt-3 inline-flex rounded-lg bg-[var(--accent)] px-4 py-3 font-semibold text-black">Ver horários e agendar</a><div className="mt-3">{request ? <p className="text-sm text-[var(--accent-strong)]">Solicitação de vínculo enviada; aguardando aprovação da barbearia.</p> : <button type="button" disabled={busy} onClick={() => void requestMembership(shop.slug)} className="text-sm text-[var(--muted)] underline decoration-[var(--border)] underline-offset-4 disabled:opacity-50">{busy ? "Enviando solicitação..." : "Também solicitar vínculo como cliente"}</button>}</div></div>}</article>;
      })}</div>
    </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><h2 className="text-xl font-semibold">Minhas solicitações</h2><p className="mt-1 text-sm text-[var(--muted)]">O acesso à barbearia é ativado somente quando o responsável aprova seu pedido.</p><div className="mt-4 space-y-3">{requests.length ? requests.map((item) => <article key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-4"><div><p className="font-medium">{item.barbershop_name}</p><p className="mt-1 text-xs text-[var(--muted)]">{new Date(item.created_at).toLocaleDateString("pt-BR")}</p></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs">{statusLabels[item.status] ?? item.status}</span></article>) : <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">Você ainda não enviou solicitações.</p>}</div></section>
  </div>;
}
