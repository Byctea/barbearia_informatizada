"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

type AuthFormProps = { mode: "login" | "register" };

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    const result = isRegister
      ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: "/dashboard" })
      : await authClient.signIn.email({ email: email.trim(), password, callbackURL: "/dashboard" });

    setBusy(false);
    if (result.error) {
      setError(result.error.message || "Não foi possível concluir. Confira os dados e tente novamente.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isRegister && <label className="block text-sm text-[var(--muted)]">Nome completo<input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/20 px-4 py-3 text-[var(--foreground)] outline-none focus:border-[var(--accent)]" /></label>}
      <label className="block text-sm text-[var(--muted)]">E-mail<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/20 px-4 py-3 text-[var(--foreground)] outline-none focus:border-[var(--accent)]" /></label>
      <label className="block text-sm text-[var(--muted)]">Senha<input required type="password" minLength={10} maxLength={128} autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-black/20 px-4 py-3 text-[var(--foreground)] outline-none focus:border-[var(--accent)]" /><span className="mt-1 block text-xs">Use pelo menos 10 caracteres.</span></label>
      {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[#18130d] transition hover:bg-[var(--accent-strong)] disabled:cursor-wait disabled:opacity-60">{busy ? "Aguarde…" : isRegister ? "Criar conta de cliente" : "Entrar"}</button>
      <p className="text-center text-sm text-[var(--muted)]">{isRegister ? "Já tem cadastro? " : "Ainda não tem conta? "}<Link className="text-[var(--accent-strong)] hover:underline" href={isRegister ? "/entrar" : "/cadastro"}>{isRegister ? "Entrar" : "Criar conta"}</Link></p>
    </form>
  );
}
