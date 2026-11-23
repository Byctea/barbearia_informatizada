"use client";

import { useEffect, useState } from "react";

type Profile = { name: string; email: string; phone: string };
type Result = { profile?: Profile; message?: string; error?: string };
const inputClass = "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground)]";

export function CustomerProfile() {
  const [profile, setProfile] = useState<Profile>({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    void fetch("/api/customer/profile", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as Result;
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar seus dados.");
      if (data.profile) setProfile(data.profile);
    }).catch((reason: unknown) => { setError(true); setMessage(reason instanceof Error ? reason.message : "Falha ao carregar perfil."); });
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setError(false);
    try {
      const response = await fetch("/api/customer/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(profile) });
      const data = await response.json() as Result;
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar seus dados.");
      if (data.profile) setProfile(data.profile);
      setMessage(data.message ?? "Seus dados foram atualizados.");
    } catch (reason) { setError(true); setMessage(reason instanceof Error ? reason.message : "Falha ao salvar perfil."); }
    finally { setBusy(false); }
  }

  return <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
    <h2 className="text-lg font-semibold">Meus dados</h2>
    <p className="mt-1 text-sm text-[var(--muted)]">Atualize seu nome, e-mail e telefone. O novo e-mail será usado nos próximos acessos.</p>
    {message && <p role={error ? "alert" : "status"} className={`mt-3 rounded-lg border p-3 text-sm ${error ? "border-red-400/30 text-red-200" : "border-emerald-400/30 text-emerald-100"}`}>{message}</p>}
    <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Nome completo<input required minLength={2} maxLength={120} autoComplete="name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} className={inputClass} /></label>
      <label className="text-sm">E-mail<input required type="email" maxLength={254} autoComplete="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} className={inputClass} /></label>
      <label className="text-sm">Telefone / WhatsApp<input required type="tel" minLength={8} maxLength={24} autoComplete="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} className={inputClass} /></label>
      <div className="flex items-end"><button disabled={busy || !profile.name || !profile.email || !profile.phone} className="rounded-lg bg-[var(--accent)] px-4 py-3 font-semibold text-black disabled:opacity-50">{busy ? "Salvando…" : "Salvar meus dados"}</button></div>
    </form>
  </section>;
}
