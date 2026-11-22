"use client";

import { FormEvent, useEffect, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

type Tenant = { id: string; name: string; slug: string | null; is_active: number; created_at: string; unit_id: string | null; unit_name: string | null; city: string | null; state: string | null; admin_count: number };
type CreatedTenant = { barbershop: { name: string; slug: string; adminEmail: string; unitName: string }; invitationUrl: string; emailNotice?: string; expiresAt: string };
const inputClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-black/20 px-4 py-3 text-[var(--foreground)]";

function PencilIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m15 5 4 4M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="M13 20h7"/></svg>; }
function TrashIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>; }

export function MasterDashboard({ name }: { name: string }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [created, setCreated] = useState<CreatedTenant | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);

  async function loadTenants() {
    const response = await fetch("/api/master/barbershops", { cache: "no-store" });
    const data = await response.json() as { barbershops?: Tenant[]; error?: string };
    if (response.ok) setTenants(data.barbershops ?? []);
    else setError(data.error || "Não foi possível carregar as barbearias.");
  }
  useEffect(() => { void loadTenants(); }, []);

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice(""); setCreated(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch("/api/master/barbershops", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formData.get("name"), unitName: formData.get("unitName"), adminName: formData.get("adminName"), adminEmail: formData.get("adminEmail"), city: formData.get("city"), state: formData.get("state") }),
    });
    const data = await response.json() as CreatedTenant & { error?: string }; setBusy(false);
    if (!response.ok) { setError(data.error || "Não foi possível criar a barbearia."); return; }
    setCreated(data); form.reset(); await loadTenants();
  }

  async function saveTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true); setError(""); setNotice("");
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/master/barbershops", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, name: formData.get("name"), unitName: formData.get("unitName"), city: formData.get("city"), state: formData.get("state"), isActive: formData.get("isActive") === "true" }) });
    const data = await response.json() as { error?: string; message?: string };
    setBusy(false);
    if (!response.ok) { setError(data.error || "Não foi possível atualizar o cadastro."); return; }
    setNotice(data.message || "Cadastro atualizado."); setEditing(null); await loadTenants();
  }

  async function deleteTenant(tenant: Tenant) {
    const confirmed = window.confirm(`Excluir ${tenant.name}? Se já houver cadastros ou histórico, a barbearia será apenas desativada para preservar os dados. Barbearias sem dados comerciais serão removidas definitivamente.`);
    if (!confirmed) return;
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/master/barbershops", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tenant.id }) });
    const data = await response.json() as { error?: string; message?: string };
    setBusy(false);
    if (!response.ok) { setError(data.error || "Não foi possível excluir a barbearia."); return; }
    setNotice(data.message || "Ação concluída."); setEditing(null); await loadTenants();
  }

  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-8">
    <header className="flex items-center justify-between border-b border-[var(--border)] pb-5"><a href="/" className="text-xl font-semibold">Barber<span className="text-[var(--accent)]">Flow</span></a><SignOutButton /></header>
    <section className="py-10"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Administração da plataforma</p><h1 className="mt-2 text-3xl font-semibold">Olá, {name}</h1><p className="mt-2 text-[var(--muted)]">Cadastre e mantenha os negócios e os acessos de seus administradores.</p></section>
    {(error || notice) && <p role={error ? "alert" : "status"} className={`mb-5 rounded-lg border p-3 text-sm ${error ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"}`}>{error || notice}</p>}
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><h2 className="text-xl font-semibold">Nova barbearia</h2><form className="mt-5 space-y-4" onSubmit={createTenant}>
        <label className="block text-sm text-[var(--muted)]">Nome da barbearia<input name="name" required minLength={2} maxLength={120} className={inputClass} placeholder="Ex.: Barbearia do Everton" /></label>
        <label className="block text-sm text-[var(--muted)]">Unidade principal<input name="unitName" required defaultValue="Unidade principal" maxLength={120} className={inputClass} /></label>
        <div className="grid grid-cols-[1fr_90px] gap-3"><label className="block text-sm text-[var(--muted)]">Cidade<input name="city" required minLength={2} maxLength={100} className={inputClass} placeholder="Ex.: Salvador" /></label><label className="block text-sm text-[var(--muted)]">UF<input name="state" required minLength={2} maxLength={2} className={`${inputClass} uppercase`} placeholder="BA" /></label></div>
        <label className="block text-sm text-[var(--muted)]">Nome do administrador<input name="adminName" required minLength={2} maxLength={120} className={inputClass} /></label>
        <label className="block text-sm text-[var(--muted)]">E-mail do administrador<input name="adminEmail" required type="email" maxLength={254} className={inputClass} /></label>
        <button disabled={busy} className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[#18130d] disabled:opacity-60">{busy ? "Salvando…" : "Criar barbearia e convite"}</button>
      </form>
      {created && <div className="mt-5 rounded-xl border border-[var(--accent)]/40 p-4 text-sm"><strong>Barbearia criada.</strong><p className="mt-2">{created.emailNotice || `Convite preparado para ${created.barbershop.adminEmail}.` } O link expira em 72 horas e só pode ser usado uma vez.</p><input readOnly value={created.invitationUrl} onFocus={(event) => event.currentTarget.select()} className="mt-3 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2" /><button onClick={() => void navigator.clipboard.writeText(created.invitationUrl)} className="mt-3 rounded-lg border border-[var(--border)] px-3 py-2">Copiar convite</button></div>}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Barbearias cadastradas</h2><button onClick={() => void loadTenants()} className="text-sm text-[var(--accent)]">Atualizar</button></div>
        <div className="mt-5 space-y-3">{tenants.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">Nenhuma barbearia cadastrada.</p> : tenants.map((tenant) => <article key={tenant.id} className="rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{tenant.name}</h3><p className="mt-1 text-sm text-[var(--muted)]">{tenant.unit_name || "Sem unidade"} · {[tenant.city, tenant.state].filter(Boolean).join(" / ") || "Endereço não configurado"}</p><p className="mt-1 break-all text-xs text-[var(--muted)]">{tenant.slug ? `/b/${tenant.slug}/entrar` : "Endereço não configurado (cadastro antigo)"}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${tenant.is_active ? "bg-emerald-500/10 text-emerald-200" : "bg-white/5 text-[var(--muted)]"}`}>{tenant.is_active ? "Ativa" : "Pausada"}</span></div>
          <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-[var(--muted)]">Administradores ativos: {tenant.admin_count}</p><div className="flex gap-2"><button type="button" title="Editar cadastro" aria-label={`Editar ${tenant.name}`} onClick={() => { setEditing(editing?.id === tenant.id ? null : tenant); setError(""); }} className="grid size-9 place-items-center rounded-lg border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent)]"><PencilIcon /></button><button type="button" title="Excluir ou desativar" aria-label={`Excluir ${tenant.name}`} disabled={busy} onClick={() => void deleteTenant(tenant)} className="grid size-9 place-items-center rounded-lg border border-red-400/30 text-red-300 hover:bg-red-500/10 disabled:opacity-50"><TrashIcon /></button></div></div>
          {editing?.id === tenant.id && <form onSubmit={saveTenant} className="mt-4 space-y-3 border-t border-[var(--border)] pt-4"><h4 className="font-medium">Editar cadastro</h4><label className="block text-sm text-[var(--muted)]">Nome da barbearia<input name="name" required minLength={2} maxLength={120} defaultValue={tenant.name} className={inputClass} /></label><label className="block text-sm text-[var(--muted)]">Unidade principal<input name="unitName" required minLength={2} maxLength={120} defaultValue={tenant.unit_name ?? "Unidade principal"} className={inputClass} /></label><div className="grid grid-cols-[1fr_90px] gap-3"><label className="block text-sm text-[var(--muted)]">Cidade<input name="city" required minLength={2} maxLength={100} defaultValue={tenant.city ?? ""} className={inputClass} /></label><label className="block text-sm text-[var(--muted)]">UF<input name="state" required minLength={2} maxLength={2} defaultValue={tenant.state ?? ""} className={`${inputClass} uppercase`} /></label></div><label className="block text-sm text-[var(--muted)]">Status<select name="isActive" defaultValue={tenant.is_active ? "true" : "false"} className={inputClass}><option value="true">Ativa</option><option value="false">Pausada</option></select></label><div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-black disabled:opacity-50">{busy ? "Salvando…" : "Salvar alterações"}</button><button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-[var(--border)] px-4 py-2">Cancelar</button></div></form>}
        </article>)}</div>
      </section>
    </div>
    <p className="mt-6 text-xs text-[var(--muted)]">Barber Flow · Painel restrito ao administrador master</p>
  </main>;
}
