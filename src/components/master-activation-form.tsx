"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function MasterActivationForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/master/bootstrap", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok) { setError(data.error || "Não foi possível ativar o painel."); return; }
    router.replace("/master"); router.refresh();
  }

  return <form onSubmit={submit} className="mt-6 space-y-4">
    <label className="block text-sm text-[var(--muted)]">Token de ativação<input required minLength={24} maxLength={512} type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/20 px-4 py-3 text-[var(--foreground)]" /></label>
    {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
    <button disabled={busy} className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[#18130d] disabled:opacity-60">{busy ? "Ativando…" : "Ativar como administrador master"}</button>
  </form>;
}
