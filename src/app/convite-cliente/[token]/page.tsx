import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default async function CustomerInvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { token } = await params;
  const { mode } = await searchParams;
  return <main className="grid min-h-screen place-items-center px-4 py-10"><section className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl sm:p-9">
    <Link href="/" className="text-sm text-[var(--accent)] hover:underline">Barber Flow</Link>
    <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Convite de cliente</p>
    <h1 className="mt-2 text-3xl font-semibold">Acesse sua barbearia</h1>
    <p className="mb-7 mt-2 text-sm leading-6 text-[var(--muted)]">Crie sua conta ou entre com o e-mail que recebeu o convite. O telefone será vinculado ao seu cadastro na barbearia.</p>
    <AuthForm mode={mode === "login" ? "login" : "register"} customerInviteToken={token} />
  </section></main>;
}
