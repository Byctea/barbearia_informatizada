import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return <main className="grid min-h-screen place-items-center px-4 py-10"><section className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl sm:p-9">
    <Link href="/" className="text-sm text-[var(--accent)] hover:underline">← Voltar ao início</Link>
    <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Novo cliente</p><h1 className="mt-2 text-3xl font-semibold">Crie sua conta</h1><p className="mb-7 mt-2 text-sm leading-6 text-[var(--muted)]">O cadastro público cria somente um perfil CLIENTE. O acesso administrativo é concedido separadamente pelo responsável.</p>
    <AuthForm mode="register" />
  </section></main>;
}
