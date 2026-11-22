"use client";

import { FormEvent, useEffect, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

type Tenant = { id: string; name: string; slug: string | null; is_active: number; created_at: string; unit_name: string | null; admin_count: number };
type CreatedTenant = { barbershop: { name: string; slug: string; adminEmail: string; unitName: string }; invitationUrl: string; expiresAt: string };

export function MasterDashboard({ name }: { name: string }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [created, setCreated] = useState<CreatedTenant | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadTenants() {
    const response = await fetch("/api/master/barbershops", { cache: "no-store" });
    const data = await response.json() as { barbershops?: Tenant[]; error?: string };
    if (response.ok) setTenants(data.barbershops ?? []);
    else setError(data.error || "Não foi possível carregar as barbearias.");
  }

  useEffect(() => { void loadTenants(); }, []);

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setCreated(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch("/api/master/barbershops", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formData.get("name"), unitName: formData.get("unitName"), adminName: formData.get("adminName"), adminEmail: formData.get("adminEmail") }),
    });
    const data = await response.json() as CreatedTenant & { error?: string }; setBusy(false);
    if (!response.ok) { setError(data.error || "Não foi possível criar a barbearia."); return; }
    setCreated(data); form.reset(); await loadTenants();
  }

  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-8">
    <header className="flex items-center justify-between border-b border-[var(--border)] pb-5"><a href="/" className="text-xl font-semibold">Barber<span className="text-[var(--accent)]">Flow</span></a><SignOutButton /></header>
    <section className="py-10"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Administração da plataforma</p><h1 className="mt-2 text-3xl font-semibold">Olá, {name}</h1><p className="mt-2 text-[var(--muted)]">Cadastre cada negócio e gere o acesso privado do administrador responsável.</p></section>
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-xl font-semibold">Nova barbearia</h2><form className="mt-5 space-y-4" onSubmit={createTenant}>
        <label className="block text-sm text-[var(--muted)]">Nome da barbearia<input name="name" required minLength={2} maxLength={120} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/20 px-4 py-3 text-[var(--foreground)]" placeholder="Ex.: Barbearia do Everton" /></label>
        <label className="block text-sm text-[var(--muted)]">Unidade principal<input name="unitName" required defaultValue="Unidade principal" maxLength={120} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/20 px-4 py-3 text-[var(--foreground)]" /></label>
        <label className="block text-sm text-[var(--muted)]">Nome do administrador<input name="adminName" required minLength={2} maxLength={120} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/20 px-4 py-3 text-[var(--foreground)]" /></label>
        <label className="block text-sm text-[var(--muted)]">E-mail do administrador<input name="adminEmail" required type="email" maxLength={254} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/20 px-4 py-3 text-[var(--foreground)]" /></label>
        {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[#18130d] disabled:opacity-60">{busy ? "Criando…" : "Criar barbearia e convite"}</button>
      </form>
      {created && <div className="mt-5 rounded-xl border border-[var(--accent)]/40 p-4 text-sm"><strong>Barbearia criada.</strong><p className="mt-2">Envie este convite ao administrador ({created.barbershop.adminEmail}). Ele expira em 72 horas e só pode ser usado uma vez.</p><input readOnly value={created.invitationUrl} onFocus={(event) => event.currentTarget.select()} className="mt-3 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2" /><button onClick={() => navigator.clipboard.writeText(created.invitationUrl)} className="mt-3 rounded-lg border border-[var(--border)] px-3 py-2">Copiar convite</button></div>}
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Barbearias cadastradas</h2><button onClick={() => void loadTenants()} className="text-sm text-[var(--accent)]">Atualizar</button></div>
        <div className="mt-5 space-y-3">{tenants.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">Nenhuma barbearia foi criada por este painel ainda.</p> : tenants.map((tenant) => <article key={tenant.id} className="rounded-xl border border-[var(--border)] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{tenant.name}</h3><p className="mt-1 text-sm text-[var(--muted)]">{tenant.unit_name || "Sem unidade"} · /b/{tenant.slug || "sem-endereço"}/entrar</p></div><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs">{tenant.is_active ? "Ativa" : "Pausada"}</span></div><p className="mt-3 text-xs text-[var(--muted)]">Administradores ativos: {tenant.admin_count}</p></article>)}</div>
      </section>
    </div>
    <p className="mt-6 text-xs text-[var(--muted)]">BarberFlow · Painel restrito ao administrador master</p>
  </main>;
}
