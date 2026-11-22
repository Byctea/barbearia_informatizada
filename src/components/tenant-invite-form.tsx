"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function TenantInviteForm({ token, name, email }: { token: string; name: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const result = existingAccount
      ? await authClient.signIn.email({ email, password, callbackURL: "/dashboard" })
      : await authClient.signUp.email({ name: String(form.get("name") || name).trim(), email, password, callbackURL: "/dashboard" });
    if (result.error) { setBusy(false); setError(result.error.message || "Não foi possível autenticar."); return; }
    const response = await fetch("/api/master/invitations/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const data = await response.json() as { error?: string }; setBusy(false);
    if (!response.ok) { setError(data.error || "Não foi possível ativar o convite."); return; }
    router.replace("/dashboard"); router.refresh();
  }

  return <form onSubmit={handleSubmit} className="mt-6 space-y-4">
    {!existingAccount && <label className="block text-sm text-[var(--muted)]">Nome completo<input name="name" required defaultValue={name} minLength={2} maxLength={120} autoComplete="name" className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/20 px-4 py-3 text-[var(--foreground)]" /></label>}
    <label className="block text-sm text-[var(--muted)]">E-mail do convite<input readOnly value={email} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/20 px-4 py-3 text-[var(--foreground)]" /></label>
    <label className="block text-sm text-[var(--muted)]">{existingAccount ? "Sua senha atual" : "Crie uma senha"}<input required type="password" minLength={10} maxLength={128} autoComplete={existingAccount ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/20 px-4 py-3 text-[var(--foreground)]" /></label>
    {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
    <button disabled={busy} className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[#18130d] disabled:opacity-60">{busy ? "Ativando acesso…" : existingAccount ? "Aceitar convite" : "Criar conta e aceitar convite"}</button>
    <button type="button" onClick={() => { setExistingAccount(!existingAccount); setError(""); }} className="w-full text-sm text-[var(--accent-strong)]">{existingAccount ? "Ainda não tenho conta" : "Já tenho uma conta com este e-mail"}</button>
  </form>;
}
