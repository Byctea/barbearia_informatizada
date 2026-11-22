import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return <main className="grid min-h-screen place-items-center px-4 py-10"><section className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl sm:p-9">
    <Link href="/" className="text-sm text-[var(--accent)] hover:underline">← Voltar ao início</Link>
    <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Conta de cliente</p><h1 className="mt-2 text-3xl font-semibold">Crie sua conta</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Sua conta começa como cliente. Depois do cadastro, escolha uma barbearia da sua região e envie uma solicitação para se vincular a ela. Quer trabalhar como barbeiro? Fale com o responsável pelo Barber Flow para solicitar a liberação.</p><p className="mb-7 mt-3 text-sm text-[var(--accent-strong)]">Barbeiros: <a className="underline" href="https://wa.me/5571982264690?text=Ol%C3%A1%2C%20quero%20solicitar%20acesso%20como%20barbeiro%20no%20Barber%20Flow" target="_blank" rel="noreferrer">chame no WhatsApp (71) 98226-4690</a>.</p>
    <AuthForm mode="register" />
  </section></main>;
}
